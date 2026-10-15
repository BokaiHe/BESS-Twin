import { TARIFF_PERIODS } from '../domain/config'
import { topologyFor } from '../domain/topology'
import {
  DEFAULT_PARAMETERS,
  ENERGY_TOLERANCE_MWH,
  normalizeParameters,
  configFor,
  tariffFor,
  type SimulationParameters,
  type SolverState,
} from '../domain/parameters'
import type {
  Alarm,
  EdgeState,
  NodeId,
  NodeState,
  ScenarioId,
  SimulationDay,
  Snapshot,
  StrategyCode,
} from '../domain/types'
import { profileAt, type ProfilePoint } from './profiles'

const EPS = 1e-9
const MINUTES = 1440
export function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}
export function createSimulationEngine(
  input: SimulationParameters = DEFAULT_PARAMETERS,
  options: { maxIterations?: number } = {},
) {
  const parameters = normalizeParameters(input)
  const C = configFor(parameters)
  const { nodes: NODES, edges: EDGES } = topologyFor(parameters)
  const INSTALLED_MW = parameters.batteryMW
  const INSTALLED_MWH = parameters.batteryMWh
  const tariffs = Array.from({ length: MINUTES }, (_, minute) => tariffFor(parameters, minute))
  const tariffAt = (minute: number) => tariffs[minute]
  const maxIterations = options.maxIterations ?? 8
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 32)
    throw new RangeError('Invalid solver iteration limit')
  const N = C.batteryUnits
  const unitMin = C.batteryUnitMWh * C.socMin
  const unitMax = C.batteryUnitMWh * C.socMax
  const dt = C.dtHours
  const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0)
  const PEAK_WINDOWS = TARIFF_PERIODS.filter((p) => p.band === 'peak')
  // These depend only on the minute, not on any binary-search candidate or SOC.
  const chargeHorizons = tariffs.map((tariff, minute) => {
    const upcoming = PEAK_WINDOWS.filter((w) => w.start > minute)
    return tariff.band === 'valley' ? upcoming : upcoming.slice(0, 1)
  })
  let profileMs = 0
  let lastTimings = { profileMs: 0, periodicMs: 0, planningMs: 0, totalMs: 0 }
  /** Dispatch proportionally to capability; every unit respects its own SOC / power limit. */
  function allocate(request: number, capacities: number[]): number[] {
    const capacity = sum(capacities)
    return capacity > EPS
      ? capacities.map((c) => (c * Math.min(request, capacity)) / capacity)
      : capacities.map(() => 0)
  }

  /**
   * Perfect day-ahead forecast (demo assumption): weather and load are known for the scripted day.
   * Equipment faults are NOT forecast; the plan is recomputed when one happens.
   */
  interface Forecast {
    readonly profiles: readonly ProfilePoint[]
    /** demand − available renewable (MW); negative = surplus. */
    readonly net: readonly number[]
    /** Cumulative DC energy the cluster could absorb from renewable surplus, [0, m). */
    readonly surplusPrefix: readonly number[]
    /** DC energy needed from minute m to the end of day to keep import ≤ the PCC limit. */
    readonly reserve: readonly number[]
  }

  const forecasts = new Map<ScenarioId, Forecast>()
  function buildForecast(scenarioId: ScenarioId): Forecast {
    const cached = forecasts.get(scenarioId)
    if (cached) return cached
    const started = performance.now()
    const profiles = Array.from({ length: MINUTES }, (_, m) => profileAt(scenarioId, m, C))
    const net = profiles.map((p) => p.factoryMW + p.residentialMW - p.pvAcMW - p.windMW)
    const surplusPrefix = [0]
    for (let m = 0; m < MINUTES; m++)
      surplusPrefix.push(
        surplusPrefix[m] + Math.min(INSTALLED_MW, Math.max(0, -net[m])) * C.chargeEfficiency * dt,
      )
    const reserve = new Array<number>(MINUTES + 1).fill(0)
    for (let m = MINUTES - 1; m >= 0; m--)
      reserve[m] =
        reserve[m + 1] + (Math.max(0, net[m] - C.gridImportLimitMW) * dt) / C.dischargeEfficiency
    profileMs += performance.now() - started
    const forecast = { profiles, net, surplusPrefix, reserve }
    forecasts.set(scenarioId, forecast)
    return forecast
  }

  type OnlineMask = (minute: number) => boolean[]
  const healthyMask = new Array<boolean>(N).fill(true)
  const trippedMask = Array.from({ length: N }, (_, i) => i !== C.faultUnit)
  const allOnline: OnlineMask = () => healthyMask
  const faultMask: OnlineMask = (minute) => (minute >= C.faultMinute ? trippedMask : healthyMask)

  interface Decision {
    charges: number[]
    discharges: number[]
    dischargeCaps: number[]
    code: StrategyCode
    target: number | null
    reserveMWh: number
    /** Discharge the plan asked for in a peak minute (for feasibility checks). */
    peakRequest: number
  }

  /**
   * One-minute rule-based dispatch.
   * Priority: PCC import limit (may use reserve) → absorb renewable surplus → peak flattening
   * towards `level` using only energy above the reserve → just-enough grid charging before
   * the next peak window, after counting the renewable surplus still expected before it.
   */
  function decide(
    fc: Forecast,
    minute: number,
    energy: readonly number[],
    online: readonly boolean[],
    level: number,
    needCache: Map<number, number>,
  ): Decision {
    const net = fc.net[minute]
    const band = tariffAt(minute).band
    const dischargeCaps = energy.map((e, i) =>
      online[i]
        ? Math.max(0, Math.min(C.batteryUnitMW, ((e - unitMin) * C.dischargeEfficiency) / dt))
        : 0,
    )
    const chargeCaps = energy.map((e, i) =>
      online[i]
        ? Math.max(0, Math.min(C.batteryUnitMW, (unitMax - e) / (C.chargeEfficiency * dt)))
        : 0,
    )
    const onlineCount = online.filter(Boolean).length
    const usable = sum(energy.map((e, i) => (online[i] ? e - unitMin : 0)))
    const reserveMWh = fc.reserve[minute] + C.reserveBufferMWh
    const hard = Math.max(0, net - C.gridImportLimitMW)
    let discharge = hard
    let charge = 0
    let code: StrategyCode = hard > EPS ? 'hard-shave' : 'standby'
    let target: number | null = null
    let peakRequest = 0

    if (net < -EPS) {
      charge = Math.min(-net, sum(chargeCaps))
      code = charge > EPS ? 'absorb' : 'export-surplus'
    } else if (band === 'peak') {
      peakRequest = Math.max(hard, net - level)
      const discretionaryMW = (Math.max(0, usable - reserveMWh) * C.dischargeEfficiency) / dt
      discharge = Math.max(hard, Math.min(Math.max(0, net - level), discretionaryMW))
      if (hard > EPS) code = 'hard-shave'
      else if (discharge > EPS) code = 'peak-discharge'
      else if (net - level > EPS) code = 'hold-reserve'
    } else if (hard <= EPS && onlineCount > 0) {
      // Valley energy is cheapest, so valley charging prepares for every remaining peak window;
      // flat-period charging only tops up for the next one. Renewable surplus expected before a
      // window is counted first, so the grid never pre-fills space the sun or wind would use.
      const horizon = chargeHorizons[minute]
      const fleetMW = onlineCount * C.batteryUnitMW
      let cumulativeNeed = 0
      let required = -Infinity
      for (const window of horizon) {
        const key = window.start * 10 + onlineCount
        let need = needCache.get(key)
        if (need === undefined) {
          need = 0
          for (let m = window.start; m < window.end; m++)
            need += (Math.min(fleetMW, Math.max(0, fc.net[m] - level)) * dt) / C.dischargeEfficiency
          needCache.set(key, need)
        }
        cumulativeNeed += need
        const freeSurplus = fc.surplusPrefix[window.start] - fc.surplusPrefix[minute]
        required = Math.max(
          required,
          onlineCount * unitMin +
            cumulativeNeed +
            fc.reserve[window.end] +
            C.reserveBufferMWh -
            freeSurplus,
        )
      }
      if (horizon.length) {
        const goal = Math.min(onlineCount * unitMax, required)
        const stored = sum(energy.filter((_, i) => online[i]))
        const gap = Math.max(0, goal - stored)
        // Charge as early as possible in the cheap period, within the PCC import headroom.
        const rate = Math.min(
          C.gridChargeMW,
          C.gridImportLimitMW - net,
          gap / (C.chargeEfficiency * dt),
          sum(chargeCaps),
        )
        if (gap > EPS) target = goal
        if (rate > EPS) {
          charge = rate
          code = band === 'valley' ? 'valley-charge' : 'flat-charge'
        }
      }
    }
    return {
      charges: allocate(charge, chargeCaps),
      discharges: allocate(discharge, dischargeCaps),
      dischargeCaps,
      code,
      target,
      reserveMWh,
      peakRequest,
    }
  }

  function integrate(energy: readonly number[], d: Decision): number[] {
    return energy.map(
      (e, i) =>
        e + d.charges[i] * C.chargeEfficiency * dt - (d.discharges[i] / C.dischargeEfficiency) * dt,
    )
  }

  /** Lowest peak import level (MW) the cluster can hold from `start` to the end of the day. */
  function planLevel(
    fc: Forecast,
    start: number,
    energy: readonly number[],
    mask: OnlineMask,
  ): number {
    const feasible = (level: number) => {
      let e = [...energy]
      const cache = new Map<number, number>()
      for (let m = start; m < MINUTES; m++) {
        const d = decide(fc, m, e, mask(m), level, cache)
        if (
          sum(d.discharges) <
          Math.max(d.peakRequest, Math.max(0, fc.net[m] - C.gridImportLimitMW)) - 1e-6
        )
          return false
        e = integrate(e, d)
      }
      return true
    }
    let lo = 0
    let hi: number = C.gridImportLimitMW
    if (!feasible(hi)) return hi
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      if (feasible(mid)) hi = mid
      else lo = mid
    }
    return Math.ceil(hi * 100) / 100
  }

  /** Equal-SOC start state that the scripted day returns to at 24:00 (periodic steady state). */
  const startCache = new Map<ScenarioId, { unit: number; solver: SolverState }>()
  function periodicStartEnergy(scenarioId: ScenarioId) {
    const key = scenarioId === 'cloudy' ? 'cloudy' : 'sunny'
    const cached = startCache.get(key)
    if (cached) return cached
    const fc = buildForecast(key)
    let unit = Math.min(unitMax, Math.max(unitMin, C.batteryUnitMWh * C.initialSocGuess))
    let iterations = 0,
      residualMWh = 0,
      initialStoredMWh = unit * N,
      finalStoredMWh = unit * N
    let status: SolverState['status'] = 'not-converged'
    if (!INSTALLED_MW || !INSTALLED_MWH) status = 'not-applicable'
    else
      for (let i = 0; i < maxIterations; i++) {
        let e = new Array<number>(N).fill(unit)
        const level = planLevel(fc, 0, e, allOnline)
        const cache = new Map<number, number>()
        for (let m = 0; m < MINUTES; m++)
          e = integrate(e, decide(fc, m, e, allOnline(m), level, cache))
        initialStoredMWh = unit * N
        finalStoredMWh = sum(e)
        residualMWh = Math.abs(finalStoredMWh - initialStoredMWh)
        iterations = i + 1
        if (residualMWh <= ENERGY_TOLERANCE_MWH) {
          status = 'converged'
          unit = finalStoredMWh / N
          break
        }
        if (i + 1 < maxIterations) unit = finalStoredMWh / N
      }
    const result: { unit: number; solver: SolverState } = {
      unit,
      solver: {
        status,
        iterations,
        toleranceMWh: ENERGY_TOLERANCE_MWH,
        residualMWh,
        initialStoredMWh,
        finalStoredMWh,
        initialization: key,
      },
    }
    startCache.set(key, result)
    return result
  }

  function simulateDay(scenarioId: ScenarioId): SimulationDay {
    const started = performance.now()
    profileMs = 0
    const fc = buildForecast(scenarioId)
    const mask = scenarioId === 'fault' ? faultMask : allOnline
    const periodicStarted = performance.now()
    const initial = periodicStartEnergy(scenarioId)
    const periodicMs = performance.now() - periodicStarted
    const initialEnergy = new Array<number>(N).fill(initial.unit)
    const initialStored = sum(initialEnergy)
    let energy = [...initialEnergy]
    let temps = new Array<number>(N).fill(28)
    // The plan assumes all equipment stays healthy; a fault triggers a re-plan.
    const planningStarted = performance.now()
    let level = planLevel(fc, 0, energy, allOnline)
    let planningMs = performance.now() - planningStarted
    const planned = level
    let replanned = false
    let needCache = new Map<number, number>()
    let warningAt: number | null = null
    const frames: Snapshot[] = []
    let cost = 0,
      baselineCost = 0,
      baselineUnserved = 0
    let importMWh = 0,
      exportMWh = 0,
      unservedMWh = 0,
      clippingMWh = 0,
      curtailedMWh = 0

    for (let minute = 0; minute < MINUTES; minute++) {
      const profile = fc.profiles[minute]
      const tariff = tariffAt(minute)
      const online = mask(minute)
      if (scenarioId === 'fault' && minute === C.faultMinute) {
        const replanStarted = performance.now()
        level = planLevel(fc, minute, energy, mask)
        planningMs += performance.now() - replanStarted
        needCache = new Map()
        replanned = true
      }
      const d = decide(fc, minute, energy, online, level, needCache)
      const onlineCount = online.filter(Boolean).length
      const demand = profile.factoryMW + profile.residentialMW
      const availableRenewable = profile.pvAcMW + profile.windMW
      const discharge = sum(d.discharges),
        charge = sum(d.charges)
      const residual = fc.net[minute] + charge - discharge
      const gridImport = Math.min(C.gridImportLimitMW, Math.max(0, residual))
      const gridExport = Math.min(C.gridExportLimitMW, Math.max(0, -residual))
      const unserved = Math.max(0, residual - gridImport)
      const curtailed = Math.max(0, -residual - gridExport)
      const generationRatio =
        availableRenewable > EPS ? (availableRenewable - curtailed) / availableRenewable : 0
      const pv = profile.pvAcMW * generationRatio,
        wind = profile.windMW * generationRatio
      const served = demand - unserved
      const servedRatio = demand > 0 ? served / demand : 1
      const factory = profile.factoryMW * servedRatio,
        residential = profile.residentialMW * servedRatio
      const nextEnergy = integrate(energy, d)

      // Thermal demo model: first-order lag towards a power-dependent temperature.
      // The faulted unit heats up from the precursor minute until its protection trips.
      const nextTemps = temps.map((t, i) => {
        let goal = online[i] ? 27 + Math.abs(d.discharges[i] - d.charges[i]) * 2.2 : 31
        if (
          scenarioId === 'fault' &&
          i === C.faultUnit &&
          minute >= C.faultPrecursorMinute &&
          online[i]
        )
          goal += (minute - C.faultPrecursorMinute) * 2.4
        return t + (goal - t) * 0.1
      })
      const alarms: Alarm[] = []
      if (scenarioId === 'fault') {
        const faultNode = `bess-${C.faultUnit + 1}` as NodeId
        if (minute >= C.faultMinute)
          alarms.push({
            id: 'bess-04-trip',
            code: 'bess-overheat-trip',
            severity: 'critical',
            nodeId: faultNode,
            startedAtMinute: C.faultMinute,
          })
        else if (temps[C.faultUnit] >= C.tempWarningC) {
          warningAt ??= minute
          alarms.push({
            id: 'bess-04-temp',
            code: 'bess-temp-high',
            severity: 'warning',
            nodeId: faultNode,
            startedAtMinute: warningAt,
          })
        }
      }

      const injections: Partial<Record<NodeId, number>> = {
        grid: gridImport - gridExport,
        pv,
        factory: -factory,
        residential: -residential,
      }
      for (let i = 0; i < C.windUnits; i++)
        injections[`wind-${i + 1}` as NodeId] = wind / C.windUnits
      for (let i = 0; i < N; i++)
        injections[`bess-${i + 1}` as NodeId] = d.discharges[i] - d.charges[i]
      const nodes = Object.fromEntries(
        NODES.map((n) => {
          const state: NodeState = {
            id: n.id,
            injectionMW: injections[n.id] ?? 0,
            status: 'online',
            quality: 'good',
          }
          if (n.kind !== 'bess') return [n.id, state]
          const i = Number(n.id.split('-')[1]) - 1
          return [
            n.id,
            {
              ...state,
              status: online[i] ? 'online' : 'offline',
              socPct: C.batteryUnitMWh ? (energy[i] / C.batteryUnitMWh) * 100 : 0,
              nextSocPct: C.batteryUnitMWh ? (nextEnergy[i] / C.batteryUnitMWh) * 100 : 0,
              temperatureC: temps[i],
              sohPct: 99,
              availableDischargeMW: d.dischargeCaps[i],
            },
          ]
        }),
      ) as Record<NodeId, NodeState>
      const edgePowers: Record<string, number> = {
        'grid-pcc': gridImport - gridExport,
        'pcc-bus': gridImport - gridExport,
        'pv-bus': pv,
        'bus-distribution': served,
        'distribution-factory': factory,
        'distribution-lv': residential,
        'lv-residential': residential,
      }
      for (let i = 0; i < C.windUnits; i++) edgePowers[`wind-${i + 1}-bus`] = wind / C.windUnits
      for (let i = 0; i < N; i++) edgePowers[`bus-bess-${i + 1}`] = d.charges[i] - d.discharges[i]
      const edges = Object.fromEntries(
        EDGES.map((e) => [
          e.id,
          {
            id: e.id,
            powerMW: edgePowers[e.id],
            activeUtilizationPct: e.capacityMW
              ? (Math.abs(edgePowers[e.id]) / e.capacityMW) * 100
              : 0,
            quality: 'good',
          },
        ]),
      ) as Record<string, EdgeState>
      const onlineStored = sum(energy.filter((_, i) => online[i]))
      const timestamp = `2026-06-18T${Math.floor(minute / 60)
        .toString()
        .padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}:00+08:00`
      frames.push({
        parameters,
        schemaVersion: 2,
        source: 'simulation',
        timestamp,
        receivedAt: timestamp,
        quality: 'good',
        minute,
        scenarioId,
        nodes,
        edges,
        alarms,
        tariff,
        strategy: {
          code: d.code,
          peakLevelMW: level,
          chargeTargetMWh: d.target,
          reserveMWh: d.reserveMWh,
          replanned,
        },
        metrics: {
          pvMW: pv,
          windMW: wind,
          renewableMW: pv + wind,
          pvDcPotentialMW: profile.pvDcMW,
          pvClippingMW: profile.clippingMW,
          curtailedMW: curtailed,
          demandMW: demand,
          servedMW: served,
          unservedMW: unserved,
          gridImportMW: gridImport,
          gridExportMW: gridExport,
          batteryChargeMW: charge,
          batteryDischargeMW: discharge,
          socPct: INSTALLED_MWH ? (sum(energy) / INSTALLED_MWH) * 100 : 0,
          onlineSocPct:
            onlineCount && C.batteryUnitMWh
              ? (onlineStored / (onlineCount * C.batteryUnitMWh)) * 100
              : 0,
          onlinePowerLimitMW: onlineCount * C.batteryUnitMW,
          availableDischargeMW: sum(d.dischargeCaps),
          onlineCapacityMWh: onlineCount * C.batteryUnitMWh,
          storedMWh: sum(energy),
          storedDeltaMWh: sum(energy) - initialStored,
          costCny: cost,
          baselineCostCny: baselineCost,
          estimatedSavingsCny:
            baselineUnserved > EPS || unservedMWh > EPS || initial.solver.status === 'not-converged'
              ? null
              : baselineCost - cost,
          baselineUnservedMWh: baselineUnserved,
        },
      })
      cost +=
        (gridImport * tariff.importCnyPerKWh - gridExport * tariff.exportCnyPerKWh) * 1000 * dt
      const net = fc.net[minute]
      const baseImport = Math.min(C.gridImportLimitMW, Math.max(0, net)),
        baseExport = Math.min(C.gridExportLimitMW, Math.max(0, -net))
      baselineCost +=
        (baseImport * tariff.importCnyPerKWh - baseExport * tariff.exportCnyPerKWh) * 1000 * dt
      baselineUnserved += Math.max(0, net - C.gridImportLimitMW) * dt
      importMWh += gridImport * dt
      exportMWh += gridExport * dt
      unservedMWh += unserved * dt
      clippingMWh += profile.clippingMW * dt
      curtailedMWh += curtailed * dt
      energy = nextEnergy
      temps = nextTemps
    }
    const solver =
      scenarioId === 'fault'
        ? initial.solver
        : {
            ...initial.solver,
            initialStoredMWh: initialStored,
            finalStoredMWh: sum(energy),
            residualMWh: Math.abs(sum(energy) - initialStored),
            status:
              initial.solver.status === 'converged' &&
              Math.abs(sum(energy) - initialStored) > ENERGY_TOLERANCE_MWH
                ? ('not-converged' as const)
                : initial.solver.status,
          }
    if (solver.status === 'not-converged')
      for (const frame of frames)
        (frame.metrics as { estimatedSavingsCny: number | null }).estimatedSavingsCny = null
    lastTimings = { profileMs, periodicMs, planningMs, totalMs: performance.now() - started }
    return freezeDeep({
      parameters,
      diagnostics: {
        solver,
      },
      id: scenarioId,
      frames,
      summary: {
        importMWh,
        exportMWh,
        unservedMWh,
        clippingMWh,
        curtailedMWh,
        costCny: cost,
        baselineCostCny: baselineCost,
        baselineUnservedMWh: baselineUnserved,
        initialStoredMWh: initialStored,
        finalStoredMWh: sum(energy),
        peakLevelMW: planned,
      },
    })
  }

  return { simulateDay, getTimings: () => ({ ...lastTimings }) }
}
const defaultEngine = createSimulationEngine()
export const simulateDay = defaultEngine.simulateDay

export function snapshotAt(day: SimulationDay, minute: number): Snapshot {
  if (!Number.isInteger(minute) || minute < 0 || minute >= day.frames.length)
    throw new RangeError('Minute must be an integer within [0, 1439].')
  return day.frames[minute]
}
