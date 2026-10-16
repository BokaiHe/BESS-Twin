import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMETERS } from '../domain/parameters'
import type { SimulationDay, Snapshot } from '../domain/types'
import { createSimulationEngine, simulateDay } from './engine'
import { energyFlows, FLOW_SOURCES, FLOW_SINKS, type EnergyFlows } from './energyFlows'
const sum = (a: number[]) => a.reduce((total, n) => total + n, 0)
function reconciles(r: EnergyFlows) {
  for (const key of FLOW_SOURCES)
    expect(sum(r.flows.filter((f) => f.from === key).map((f) => f.mwh))).toBeCloseTo(
      r.sources[key],
      9,
    )
  for (const key of FLOW_SINKS)
    expect(sum(r.flows.filter((f) => f.to === key).map((f) => f.mwh))).toBeCloseTo(r.sinks[key], 9)
  expect(sum(Object.values(r.sources))).toBeCloseTo(sum(Object.values(r.sinks)), 9)
  expect(r.diagnostics.maxBalanceErrorMW).toBeLessThanOrEqual(1e-6)
  expect(r.flows.every((f) => f.mwh > 0)).toBe(true)
}
for (const id of ['sunny', 'cloudy', 'fault'] as const) {
  describe(`${id} energy attribution`, () => {
    const day = simulateDay(id)
    it('reconciles every minute and forbids unreported battery export in current dispatch', () => {
      for (let i = 0; i < 1440; i++) {
        const r = energyFlows(day, i, i + 1)
        reconciles(r)
        expect(r.diagnostics.batteryExportMWh).toBe(0)
      }
    })
    it('reconciles arbitrary half-open windows, inventory and full-day summaries', () => {
      for (const [start, end] of [
        [0, 0],
        [0, 720],
        [720, 1050],
        [1050, 1440],
        [1439, 1440],
        [1440, 1440],
        [0, 1440],
      ]) {
        const r = energyFlows(day, start, end)
        reconciles(r)
        const expectedLoss = sum(
          day.frames
            .slice(start, end)
            .map(
              (f) =>
                (f.metrics.batteryChargeMW * (1 - day.parameters.chargeEfficiencyPct / 100) +
                  f.metrics.batteryDischargeMW *
                    (100 / day.parameters.dischargeEfficiencyPct - 1)) /
                60,
            ),
        )
        expect(r.storage.lossMWh).toBeCloseTo(expectedLoss, 9)
      }
      const all = energyFlows(day, 0, 1440)
      expect(all.sources.gridImport).toBeCloseTo(day.summary.importMWh, 9)
      expect(all.sinks.gridExport).toBeCloseTo(day.summary.exportMWh, 9)
      expect(all.lost).toEqual({
        curtailed: expect.closeTo(day.summary.curtailedMWh, 9),
        clipping: expect.closeTo(day.summary.clippingMWh, 9),
        unserved: expect.closeTo(day.summary.unservedMWh, 9),
      })
      expect(all.storage.finalMWh).toBe(day.summary.finalStoredMWh)
      const early = energyFlows(day, 0, 720),
        late = energyFlows(day, 720, 1440)
      expect(early.storage.finalMWh).toBe(day.frames[720].metrics.storedMWh)
      expect(early.sources.gridImport + late.sources.gridImport).toBeCloseTo(
        all.sources.gridImport,
        9,
      )
      expect(early.storage.lossMWh + late.storage.lossMWh).toBeCloseTo(all.storage.lossMWh, 9)
    })
  })
}
it('keeps daytime absorption and evening discharge separate at noon', () => {
  const day = simulateDay('sunny'),
    noon = energyFlows(day, 0, 720),
    full = energyFlows(day, 0, 1440)
  expect(full.flows.some((f) => f.from === 'pv' && f.to === 'batteryCharge')).toBe(true)
  expect(full.flows.some((f) => f.from === 'batteryDischarge' && f.to === 'load')).toBe(true)
  expect(noon.flows.some((f) => f.from === 'batteryDischarge')).toBe(false)
})
for (const [name, change] of [
  ['zero storage', { batteryMW: 0, batteryMWh: 0 }],
  ['surplus renewables', { batteryMW: 0, batteryMWh: 0, pvDCMWp: 80, windMW: 60, gridExportMW: 0 }],
  ['no supply', { batteryMW: 0, batteryMWh: 0, pvDCMWp: 0, windMW: 0, gridImportMW: 0 }],
] as const)
  it(`${name}: no phantom storage or missing demand in the balance`, () => {
    const day = createSimulationEngine({ ...DEFAULT_PARAMETERS, ...change }).simulateDay('sunny')
    const r = energyFlows(day, 0, 1440)
    reconciles(r)
    expect(r.flows.some((f) => f.from === 'batteryDischarge' || f.to === 'batteryCharge')).toBe(
      false,
    )
    expect(r.storage.lossMWh).toBe(0)
    if (name === 'surplus renewables') expect(r.lost.curtailed).toBeGreaterThan(0)
    if (name === 'no supply') {
      expect(r.flows).toEqual([])
      expect(r.lost.unserved).toBeGreaterThan(0)
    }
  })
function synthetic(metrics: Partial<Snapshot['metrics']>, deltaMWh: number): SimulationDay {
  const day = simulateDay('sunny'),
    frame = day.frames[0]
  return {
    ...day,
    frames: [
      {
        ...frame,
        metrics: {
          ...frame.metrics,
          pvMW: 0,
          windMW: 0,
          gridImportMW: 0,
          batteryDischargeMW: 0,
          servedMW: 0,
          batteryChargeMW: 0,
          gridExportMW: 0,
          ...metrics,
        },
      },
    ],
    summary: { ...day.summary, finalStoredMWh: frame.metrics.storedMWh + deltaMWh },
  }
}
it('uses renewable priority and proportional PV/wind attribution without mutating data', () => {
  const day = synthetic(
    { pvMW: 6, windMW: 4, servedMW: 6, batteryChargeMW: 3, gridExportMW: 1 },
    (3 * 0.95) / 60,
  )
  const before = JSON.stringify(day),
    r = energyFlows(day, 0, 1)
  reconciles(r)
  expect(r.flows.find((f) => f.from === 'pv' && f.to === 'load')!.mwh).toBeCloseTo(3.6 / 60, 12)
  expect(r.flows.find((f) => f.from === 'wind' && f.to === 'batteryCharge')!.mwh).toBeCloseTo(
    1.2 / 60,
    12,
  )
  expect(JSON.stringify(day)).toBe(before)
  expect(energyFlows(day, 0, 1)).toEqual(r)
})
it('reports and balances a future battery export rather than dropping it', () => {
  const day = synthetic(
    { pvMW: 2, windMW: 1, batteryDischargeMW: 5, servedMW: 4, gridExportMW: 4 },
    -5 / 0.95 / 60,
  )
  const r = energyFlows(day, 0, 1)
  reconciles(r)
  expect(r.diagnostics.batteryExportMWh).toBeCloseTo(4 / 60, 12)
})
it('rejects invalid windows and unbalanced or non-finite input instead of inventing flows', () => {
  const day = simulateDay('sunny')
  for (const [start, end] of [
    [-1, 5],
    [1, 0],
    [0, 1441],
    [0, 0.5],
    [NaN, 0],
  ])
    expect(() => energyFlows(day, start, end)).toThrow(RangeError)
  expect(() => energyFlows(synthetic({ servedMW: 5 }, 0), 0, 1)).toThrow('imbalance')
  expect(() => energyFlows(synthetic({ pvMW: NaN }, 0), 0, 1)).toThrow('Invalid flow power')
})
