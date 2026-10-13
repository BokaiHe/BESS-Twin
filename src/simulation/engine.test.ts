import { describe, expect, it } from 'vitest'
import { CONFIG as C, tariffAt } from '../domain/config'
import { EDGES, NODES } from '../domain/topology'
import type { ScenarioId } from '../domain/types'
import { SimulationSource } from '../data/simulationSource'
import { simulateDay, snapshotAt } from './engine'
import { profileAt } from './profiles'

const ids: ScenarioId[] = ['sunny', 'cloudy', 'fault']
const days = Object.fromEntries(ids.map((id) => [id, simulateDay(id)]))

describe.each(ids)('%s: full-day physical acceptance', (id) => {
  const day = days[id]
  it('has exactly 1440 immutable chronological minute snapshots', () => {
    expect(day.frames).toHaveLength(1440)
    day.frames.forEach((f, minute) => {
      expect(f.minute).toBe(minute)
      expect(Object.isFrozen(f.nodes)).toBe(true)
      expect(Object.isFrozen(f.metrics)).toBe(true)
      if (minute)
        expect(Date.parse(f.timestamp) - Date.parse(day.frames[minute - 1].timestamp)).toBe(60_000)
    })
  })
  it('conserves active power globally and at EVERY topology node', () => {
    for (const f of day.frames) {
      const m = f.metrics
      expect(
        m.renewableMW +
          m.gridImportMW +
          m.batteryDischargeMW -
          m.servedMW -
          m.batteryChargeMW -
          m.gridExportMW,
      ).toBeCloseTo(0, 9)
      expect(m.servedMW + m.unservedMW).toBeCloseTo(m.demandMW, 9)
      for (const n of NODES) {
        let residual = f.nodes[n.id].injectionMW
        for (const e of EDGES) {
          if (e.to === n.id) residual += f.edges[e.id].powerMW
          if (e.from === n.id) residual -= f.edges[e.id].powerMW
        }
        expect(residual, `${f.minute} ${n.id}`).toBeCloseTo(0, 9)
      }
    }
  })
  it('keeps per-unit SOC within 10–90% and obeys energy integration with efficiency', () => {
    for (const f of day.frames) {
      for (const n of Object.values(f.nodes).filter((n) => n.socPct !== undefined)) {
        expect(n.socPct!).toBeGreaterThanOrEqual(10 - 1e-8)
        expect(n.socPct!).toBeLessThanOrEqual(90 + 1e-8)
        expect(n.nextSocPct!).toBeGreaterThanOrEqual(10 - 1e-8)
        expect(n.nextSocPct!).toBeLessThanOrEqual(90 + 1e-8)
        const p = n.injectionMW
        const delta =
          (((p >= 0 ? -p / C.dischargeEfficiency : -p * C.chargeEfficiency) * C.dtHours) / 5) * 100
        expect(n.nextSocPct! - n.socPct!).toBeCloseTo(delta, 8)
        if (f.minute < 1439)
          expect(day.frames[f.minute + 1].nodes[n.id].socPct).toBeCloseTo(n.nextSocPct!, 9)
      }
    }
  })
  it('respects import/export, inverter, line and battery power limits without simultaneous opposing flows', () => {
    for (const f of day.frames) {
      const m = f.metrics
      expect(m.gridImportMW).toBeLessThanOrEqual(15 + 1e-9)
      expect(m.gridExportMW).toBeLessThanOrEqual(15 + 1e-9)
      expect(m.gridImportMW * m.gridExportMW).toBe(0)
      expect(m.batteryChargeMW * m.batteryDischargeMW).toBe(0)
      expect(m.batteryDischargeMW).toBeLessThanOrEqual(m.availableDischargeMW + 1e-9)
      expect(m.pvMW).toBeLessThanOrEqual(16 + 1e-9)
      for (const e of EDGES)
        expect(Math.abs(f.edges[e.id].powerMW)).toBeLessThanOrEqual(e.capacityMW + 1e-9)
    }
  })
  it('meets all demand in the intentionally feasible supplied scripts', () => {
    expect(day.summary.unservedMWh).toBeCloseTo(0, 9)
    expect(Math.max(...day.frames.map((f) => f.metrics.unservedMW))).toBeLessThan(1e-8)
  })
  it('only spends energy above the reserve on discretionary peak discharge', () => {
    for (const f of day.frames.filter((f) => f.strategy.code === 'peak-discharge')) {
      const remaining = Object.values(f.nodes)
        .filter((n) => n.socPct !== undefined && n.status === 'online')
        .reduce((total, n) => total + (n.nextSocPct! / 100 - C.socMin) * 5, 0)
      expect(remaining).toBeGreaterThanOrEqual(f.strategy.reserveMWh - 1e-8)
    }
  })
  it('integrates tariff costs and energy once, independent of reads', () => {
    let cost = 0,
      imported = 0
    for (const f of day.frames) {
      expect(f.metrics.costCny).toBeCloseTo(cost, 7)
      cost +=
        ((f.metrics.gridImportMW * f.tariff.importCnyPerKWh -
          f.metrics.gridExportMW * f.tariff.exportCnyPerKWh) *
          1000) /
        60
      imported += f.metrics.gridImportMW / 60
    }
    expect(day.summary.costCny).toBeCloseTo(cost, 7)
    expect(day.summary.importMWh).toBeCloseTo(imported, 7)
  })
})

describe('script design, fault causality and replay', () => {
  it('uses 16 MWac clipping independently of network curtailment', () => {
    const f = days.sunny.frames[720]
    expect(f.metrics.pvDcPotentialMW).toBeCloseTo(19.6)
    expect(f.metrics.pvClippingMW).toBeCloseTo(3.6)
    expect(f.metrics.pvMW).toBeCloseTo(16)
    expect(days.sunny.summary.clippingMWh).toBeGreaterThan(0)
  })
  it('staggers industrial and residential peaks', () => {
    expect(profileAt('sunny', 660).factoryMW).toBe(14)
    expect(profileAt('sunny', 1140).residentialMW).toBe(5)
    expect(Math.max(...days.sunny.frames.map((f) => f.metrics.demandMW))).toBeLessThan(19)
  })
  it('demonstrates battery necessity on the cloudy day and invalidates an infeasible financial baseline', () => {
    expect(days.cloudy.summary.baselineUnservedMWh).toBeGreaterThan(0)
    expect(days.cloudy.frames[1439].metrics.estimatedSavingsCny).toBeNull()
    expect(
      days.cloudy.frames.some(
        (f) => f.strategy.code === 'hard-shave' && f.metrics.batteryDischargeMW > 0,
      ),
    ).toBe(true)
    expect(days.sunny.summary.baselineUnservedMWh).toBeCloseTo(0, 9)
  })
  it('changes no weather, load or pre-event electrical behavior on the fault day', () => {
    for (let minute = 0; minute < 1440; minute++) {
      expect(profileAt('fault', minute)).toEqual(profileAt('sunny', minute))
      if (minute < C.faultMinute)
        expect(days.fault.frames[minute].metrics).toEqual(days.sunny.frames[minute].metrics)
    }
  })
  it('isolates unit 04, preserves its energy and reduces online rating to 7.5 MW / 15 MWh', () => {
    const faultSoc = days.fault.frames[C.faultMinute].nodes['bess-4'].socPct
    for (const f of days.fault.frames.slice(C.faultMinute)) {
      expect(f.nodes['bess-4'].injectionMW).toBe(0)
      expect(f.nodes['bess-4'].status).toBe('offline')
      expect(f.nodes['bess-4'].socPct).toBe(faultSoc)
      expect(f.metrics.onlinePowerLimitMW).toBe(7.5)
      expect(f.metrics.onlineCapacityMWh).toBe(15)
      expect(f.strategy.replanned).toBe(true)
      expect(f.metrics.batteryDischargeMW).toBeLessThanOrEqual(7.5 + 1e-9)
      expect(f.alarms.map((a) => a.code)).toEqual(['bess-overheat-trip'])
    }
    expect(
      days.fault.frames.some(
        (f, i) =>
          i >= C.faultMinute &&
          f.metrics.gridImportMW > days.sunny.frames[i].metrics.gridImportMW + 0.1,
      ),
    ).toBe(true)
    expect(
      days.fault.frames.some(
        (f, i) =>
          i > C.faultMinute &&
          Math.abs(f.metrics.socPct - days.sunny.frames[i].metrics.socPct) > 0.1,
      ),
    ).toBe(true)
  })
  it('is deterministic, seek-order independent and immune to accidental snapshot mutation', () => {
    const original = snapshotAt(days.cloudy, 1140)
    for (const m of [0, 1439, 1050, 12, 1140]) snapshotAt(days.cloudy, m)
    expect(snapshotAt(days.cloudy, 1140)).toBe(original)
    expect(() => Object.assign(original.metrics, { socPct: 0 })).toThrow()
    expect(simulateDay('cloudy')).toEqual(days.cloudy)
    for (const m of [-1, 1440, 1.5, NaN])
      expect(() => snapshotAt(days.cloudy, m)).toThrow(RangeError)
  })
  it('caches source datasets and exposes the same contract for every scenario', async () => {
    const source = new SimulationSource()
    expect(await source.loadDay('sunny')).toBe(await source.loadDay('sunny'))
    expect((await source.loadDay('fault')).frames[0].schemaVersion).toBe(2)
  })
  it('switches tariffs at exact minute boundaries', () => {
    expect(tariffAt(419).band).toBe('valley')
    expect(tariffAt(420).band).toBe('flat')
    expect(tariffAt(1019).band).toBe('flat')
    expect(tariffAt(1020).band).toBe('peak')
    expect(() => tariffAt(1440)).toThrow(RangeError)
  })
})

describe('dispatch strategy tells the intended story', () => {
  it('stores midday solar surplus instead of exporting it on the sunny day', () => {
    const noon = days.sunny.frames[720]
    expect(noon.strategy.code).toBe('absorb')
    expect(noon.metrics.batteryChargeMW).toBeGreaterThan(2)
    // No grid charging overnight: the sun will fill the battery for free.
    expect(days.sunny.frames.some((f) => f.strategy.code === 'valley-charge')).toBe(false)
  })
  it('charges from the cheap valley on the cloudy day, before the evening peak', () => {
    const valley = days.cloudy.frames.slice(0, 420)
    expect(valley.some((f) => f.strategy.code === 'valley-charge')).toBe(true)
    expect(days.cloudy.frames[1020].metrics.socPct).toBeGreaterThan(80)
  })
  it.each(ids)('%s: discharges through the 19:00 evening peak instead of idling', (id) => {
    expect(days[id].frames[1140].metrics.batteryDischargeMW).toBeGreaterThan(1)
  })
  it.each(['sunny', 'cloudy'] as const)(
    '%s: flattens peak-period import to one planned level',
    (id) => {
      const day = days[id]
      const level = day.summary.peakLevelMW
      const discharging = day.frames.filter((f) => f.strategy.code === 'peak-discharge')
      expect(discharging.length).toBeGreaterThan(120)
      for (const f of discharging) expect(f.metrics.gridImportMW).toBeCloseTo(level, 6)
      expect(level).toBeLessThan(C.gridImportLimitMW - 3)
    },
  )
  it.each(['sunny', 'cloudy'] as const)('%s: is a periodic day (end SOC = start SOC)', (id) => {
    const s = days[id].summary
    expect(s.finalStoredMWh).toBeCloseTo(s.initialStoredMWh, 4)
    expect(days[id].frames[1439].metrics.storedDeltaMWh).toBeCloseTo(0, 2)
  })
  it('produces positive savings against a comparable no-storage baseline', () => {
    expect(days.sunny.summary.baselineCostCny - days.sunny.summary.costCny).toBeGreaterThan(5000)
  })
  it('re-plans after the fault, raising the import level instead of breaking limits', () => {
    const before = days.fault.frames[C.faultMinute - 1].strategy
    const after = days.fault.frames[C.faultMinute].strategy
    expect(before.replanned).toBe(false)
    expect(after.peakLevelMW).toBeGreaterThan(before.peakLevelMW)
  })
  it('heats BESS-04 and raises a warning before the 17:30 trip', () => {
    const pre = days.fault.frames.slice(C.faultPrecursorMinute, C.faultMinute)
    const warned = pre.filter((f) => f.alarms.some((a) => a.code === 'bess-temp-high'))
    expect(warned.length).toBeGreaterThan(3)
    expect(days.fault.frames[C.faultMinute - 1].nodes['bess-4'].temperatureC!).toBeGreaterThan(50)
    // The healthy reference day never warns.
    expect(days.sunny.frames.every((f) => f.alarms.length === 0)).toBe(true)
  })
})

describe('savings breakdown', () => {
  it.each(ids)('%s: per-band ledger reconciles with the engine cost totals', async (id) => {
    const { savingsBreakdown } = await import('./savings')
    const day = days[id]
    for (const end of [0, 600, 1140, 1440]) {
      const b = savingsBreakdown(day, end)
      const ref = end < 1440 ? day.frames[end].metrics : null
      const baseRef = ref ? ref.baselineCostCny : day.summary.baselineCostCny
      const caseRef = ref ? ref.costCny : day.summary.costCny
      expect(b.baseCostCny).toBeCloseTo(baseRef, 4)
      expect(b.caseCostCny).toBeCloseTo(caseRef, 4)
      const fromBands = b.bands.reduce(
        (s, x) =>
          s +
          ((x.baseImportMWh - x.caseImportMWh) * x.importPrice -
            (x.baseExportMWh - x.caseExportMWh) * x.exportPrice) *
            1000,
        0,
      )
      expect(fromBands).toBeCloseTo(b.baseCostCny - b.caseCostCny, 4)
    }
  })
})

describe('savings comparability and fault inventory', () => {
  it('keeps a raw bill difference but removes savings once the baseline leaves demand unserved', async () => {
    const { savingsBreakdown } = await import('./savings')
    const early = savingsBreakdown(days.cloudy, 600)
    const full = savingsBreakdown(days.cloudy, 1440)
    expect(early.estimatedSavingsCny).not.toBeNull()
    expect(full.baselineUnservedMWh).toBeGreaterThan(1)
    expect(full.estimatedSavingsCny).toBeNull()
    expect(full.billDifferenceCny).toBeCloseTo(
      days.cloudy.summary.baselineCostCny - days.cloudy.summary.costCny,
      6,
    )
  })
  it('reports fault inventory for the selected window, including frozen energy', async () => {
    const { savingsBreakdown } = await import('./savings')
    const before = savingsBreakdown(days.fault, C.faultMinute - 1)
    const tripped = savingsBreakdown(days.fault, C.faultMinute)
    const full = savingsBreakdown(days.fault, 1440)
    expect(before.offlineStoredMWh).toBeCloseTo(0, 8)
    expect(tripped.offlineStoredMWh).toBeGreaterThan(0)
    expect(full.offlineStoredMWh).toBeCloseTo(tripped.offlineStoredMWh, 8)
    expect(full.storedDeltaMWh).toBeCloseTo(
      days.fault.summary.finalStoredMWh - days.fault.summary.initialStoredMWh,
      8,
    )
    expect(full.storedDeltaMWh).toBeGreaterThan(3)
    expect(savingsBreakdown(days.sunny, 1440).storedDeltaMWh).toBeCloseTo(0, 4)
  })
})
