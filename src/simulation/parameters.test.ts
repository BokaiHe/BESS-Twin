import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARAMETERS as D,
  configFor,
  normalizeParameters,
  parameterKey,
  ENERGY_TOLERANCE_MWH,
  type SimulationParameters,
} from '../domain/parameters'
import { topologyFor } from '../domain/topology'
import type { ScenarioId } from '../domain/types'
import { createSimulationEngine, snapshotAt } from './engine'
import { compareDays } from './comparison'
import { savingsBreakdown } from './savings'

const cases: [string, ScenarioId, Partial<SimulationParameters>][] = [
  ['no storage', 'cloudy', { batteryMW: 0, batteryMWh: 0 }],
  ['zero energy with rated power', 'sunny', { batteryMWh: 0 }],
  ['energy without converter', 'sunny', { batteryMW: 0, batteryMWh: 80 }],
  [
    'no generation and no grid',
    'cloudy',
    { pvDCMWp: 0, windMW: 0, gridImportMW: 0, gridExportMW: 0 },
  ],
  [
    'surplus and no export',
    'sunny',
    { pvDCMWp: 80, windMW: 60, gridExportMW: 0, batteryMW: 20, batteryMWh: 80 },
  ],
  [
    'limited grid, narrow SOC and losses',
    'cloudy',
    {
      gridImportMW: 2,
      gridExportMW: 0,
      socMinPct: 40,
      socMaxPct: 60,
      chargeEfficiencyPct: 80,
      dischargeEfficiencyPct: 80,
      reserveMWh: 10,
    },
  ],
  [
    'large system fault',
    'fault',
    { batteryMW: 20, batteryMWh: 80, gridImportMW: 50, gridExportMW: 50 },
  ],
  [
    'perfect efficiency, reversed prices',
    'sunny',
    {
      chargeEfficiencyPct: 100,
      dischargeEfficiencyPct: 100,
      socMinPct: 0,
      socMaxPct: 100,
      valleyPrice: 3,
      flatPrice: 0,
      peakPrice: 0,
      reserveMWh: 0,
    },
  ],
]
describe.each(cases)('%s', (_, scenario, patch) => {
  it('keeps every minute finite, balanced and inside the configured equipment limits', () => {
    const p = normalizeParameters({ ...D, ...patch }),
      c = configFor(p)
    const day = createSimulationEngine(p).simulateDay(scenario)
    const topology = topologyFor(p)
    let bill = 0,
      unserved = 0,
      curtailed = 0
    for (const f of day.frames) {
      const m = f.metrics
      expect(Object.values(m).every((v) => v === null || Number.isFinite(v))).toBe(true)
      expect(
        m.renewableMW +
          m.gridImportMW +
          m.batteryDischargeMW -
          m.servedMW -
          m.gridExportMW -
          m.batteryChargeMW,
      ).toBeCloseTo(0, 7)
      expect(m.servedMW + m.unservedMW).toBeCloseTo(m.demandMW, 8)
      expect(m.unservedMW).toBeGreaterThanOrEqual(-1e-8)
      expect(m.curtailedMW).toBeGreaterThanOrEqual(-1e-8)
      expect(m.gridImportMW).toBeLessThanOrEqual(p.gridImportMW + 1e-8)
      expect(m.gridExportMW).toBeLessThanOrEqual(p.gridExportMW + 1e-8)
      expect(m.batteryDischargeMW * m.batteryChargeMW).toBeCloseTo(0, 8)
      expect(m.storedMWh).toBeGreaterThanOrEqual(p.batteryMWh * c.socMin - 1e-7)
      expect(m.storedMWh).toBeLessThanOrEqual(p.batteryMWh * c.socMax + 1e-7)
      if (!p.batteryMW || !p.batteryMWh) expect(m.batteryChargeMW + m.batteryDischargeMW).toBe(0)
      for (const node of topology.nodes) {
        const state = f.nodes[node.id]
        const incoming = topology.edges
          .filter((e) => e.to === node.id)
          .reduce((s, e) => s + f.edges[e.id].powerMW, 0)
        const outgoing = topology.edges
          .filter((e) => e.from === node.id)
          .reduce((s, e) => s + f.edges[e.id].powerMW, 0)
        expect(state.injectionMW + incoming - outgoing).toBeCloseTo(0, 7)
        if (node.kind === 'bess') {
          expect(Math.abs(state.injectionMW)).toBeLessThanOrEqual(c.batteryUnitMW + 1e-8)
          const delta =
            state.injectionMW < 0
              ? (-state.injectionMW * c.chargeEfficiency) / 60
              : -state.injectionMW / c.dischargeEfficiency / 60
          expect(((state.nextSocPct! - state.socPct!) * c.batteryUnitMWh) / 100).toBeCloseTo(
            delta,
            8,
          )
          if (scenario === 'fault' && f.minute >= 1050 && node.id === 'bess-4')
            expect(state.injectionMW).toBe(0)
        }
      }
      for (const edge of topology.edges) {
        const state = f.edges[edge.id]
        expect(Math.abs(state.powerMW)).toBeLessThanOrEqual(edge.capacityMW + 1e-7)
        expect(state.activeUtilizationPct).toBeCloseTo(
          edge.capacityMW ? (Math.abs(state.powerMW) / edge.capacityMW) * 100 : 0,
          8,
        )
      }
      if (scenario === 'fault' && f.minute >= 1050)
        expect(m.onlinePowerLimitMW).toBeLessThanOrEqual(p.batteryMW * 0.75 + 1e-9)
      bill +=
        ((m.gridImportMW * f.tariff.importCnyPerKWh - m.gridExportMW * f.tariff.exportCnyPerKWh) *
          1000) /
        60
      unserved += m.unservedMW / 60
      curtailed += m.curtailedMW / 60
    }
    expect(day.summary.costCny).toBeCloseTo(bill, 6)
    expect(day.summary.unservedMWh).toBeCloseTo(unserved, 8)
    expect(day.summary.curtailedMWh).toBeCloseTo(curtailed, 8)
    expect(savingsBreakdown(day, 1440).caseCostCny).toBeCloseTo(bill, 6)
    const at = snapshotAt(day, 720)
    snapshotAt(day, 0)
    expect(snapshotAt(day, 720)).toBe(at)
    if (scenario !== 'fault' && day.diagnostics.solver.status === 'converged')
      expect(
        Math.abs(day.summary.finalStoredMWh - day.summary.initialStoredMWh),
      ).toBeLessThanOrEqual(ENERGY_TOLERANCE_MWH)
  }, 30000)
})

it('rejects invalid, missing, unknown or off-step parameters with a stable normalized identity', () => {
  for (const patch of [
    { batteryMW: NaN },
    { batteryMWh: 81 },
    { gridImportMW: -1 },
    { valleyPrice: Infinity },
    { batteryMW: 0.001 },
    { alien: 1 },
    { socMinPct: 50 },
  ])
    expect(() => normalizeParameters({ ...D, ...patch })).toThrow()
  expect(() => normalizeParameters({} as SimulationParameters)).toThrow()
  expect(parameterKey({ ...D })).toBe(parameterKey(D))
})
it('faults use the same-parameter sunny start and preserve all pre-fault physics', () => {
  const engine = createSimulationEngine({
    ...D,
    batteryMW: 16,
    batteryMWh: 48,
    pvDCMWp: 30,
    windMW: 18,
  })
  const sunny = engine.simulateDay('sunny'),
    fault = engine.simulateDay('fault')
  expect(fault.summary.initialStoredMWh).toBe(sunny.summary.initialStoredMWh)
  expect(fault.diagnostics.solver.initialization).toBe('sunny')
  for (let i = 0; i < 1050; i++) expect(fault.frames[i].metrics).toEqual(sunny.frames[i].metrics)
  for (let i = 1050; i < 1440; i++)
    expect(fault.frames[i].nodes['bess-4'].socPct).toBe(fault.frames[1050].nodes['bess-4'].socPct)
})
it('exposes capped non-convergence and prevents unvalidated savings', () => {
  const day = createSimulationEngine(D, { maxIterations: 1 }).simulateDay('sunny')
  expect(day.diagnostics.solver.status).toBe('not-converged')
  expect(day.diagnostics.solver.iterations).toBe(1)
  expect(day.diagnostics.solver.residualMWh).toBeGreaterThan(ENERGY_TOLERANCE_MWH)
  expect(day.frames[1439].metrics.estimatedSavingsCny).toBeNull()
  expect(savingsBreakdown(day, 1440).estimatedSavingsCny).toBeNull()
  expect(compareDays(day, day).comparableSavingsCny).toBeNull()
})
it('compares supply and stored-energy boundaries before labeling a bill difference savings', () => {
  const a = createSimulationEngine(D).simulateDay('cloudy')
  const b = createSimulationEngine({ ...D, batteryMW: 0, batteryMWh: 0 }).simulateDay('cloudy')
  expect(compareDays(a, a).comparableSavingsCny).toBe(0)
  expect(compareDays(a, b).status).toBe('different-supply')
  expect(compareDays(a, b).comparableSavingsCny).toBeNull()
  const fault = createSimulationEngine(D).simulateDay('fault')
  expect(compareDays(fault, fault).status).toBe('non-periodic')
  expect(compareDays(a, fault).status).toBe('different-scenario')
})
it('tariff inputs change the ledger without changing the documented fixed-window dispatch', () => {
  const a = createSimulationEngine(D).simulateDay('sunny')
  const b = createSimulationEngine({ ...D, peakPrice: 3 }).simulateDay('sunny')
  expect(b.summary.costCny).toBeGreaterThan(a.summary.costCny)
  expect(b.frames[720].metrics.storedMWh).toBe(a.frames[720].metrics.storedMWh)
  expect(b.frames[1100].tariff.importCnyPerKWh).toBe(3)
})

it('reports the time and tariff of the first daily import maximum', () => {
  const a = createSimulationEngine(D).simulateDay('sunny')
  const b = createSimulationEngine({ ...D, batteryMWh: 40 }).simulateDay('sunny')
  const result = compareDays(a, b)
  for (const [day, peak] of [
    [a, result.originalPeak],
    [b, result.proposalPeak],
  ] as const) {
    expect(peak.powerMW).toBe(Math.max(...day.frames.map((f) => f.metrics.gridImportMW)))
    expect(peak.minute).toBe(
      day.frames.find((f) => f.metrics.gridImportMW === peak.powerMW)!.minute,
    )
    expect(peak.band).toBe(day.frames[peak.minute].tariff.band)
  }
  expect(result.originalPeak.band).toBe('flat')
  expect(result.proposalPeak.band).toBe('flat')
  expect(result.originalPeakMW).toBe(result.proposalPeakMW)
})
