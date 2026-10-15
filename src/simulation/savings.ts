import { configFor } from '../domain/parameters'
import type { SimulationDay, TariffBand } from '../domain/types'

export interface BandLedger {
  band: TariffBand
  importPrice: number
  exportPrice: number
  /** MWh bought / sold without storage and with storage, over the window. */
  baseImportMWh: number
  caseImportMWh: number
  baseExportMWh: number
  caseExportMWh: number
}
export interface SavingsBreakdown {
  bands: BandLedger[]
  baseCostCny: number
  caseCostCny: number
  baselineUnservedMWh: number
  billDifferenceCny: number
  estimatedSavingsCny: number | null
  storedDeltaMWh: number
  offlineStoredMWh: number
}

/**
 * Splits the bill difference between the no-storage baseline and the storage case by tariff
 * band, for minutes [0, endMinute). Rebuilds the baseline from the same frames the engine
 * produced (demand − available renewables, capped at the PCC limits), so the totals reconcile
 * with `metrics.baselineCostCny` and `metrics.costCny`.
 */
export function savingsBreakdown(day: SimulationDay, endMinute: number): SavingsBreakdown {
  const C = configFor(day.parameters)
  const bands = new Map<TariffBand, BandLedger>()
  let baseCostCny = 0,
    caseCostCny = 0,
    baselineUnservedMWh = 0
  const end = Math.max(0, Math.min(day.frames.length, endMinute))
  for (let i = 0; i < end; i++) {
    const f = day.frames[i]
    const m = f.metrics
    const net = m.demandMW - (m.renewableMW + m.curtailedMW)
    const baseImport = Math.min(C.gridImportLimitMW, Math.max(0, net))
    const baseExport = Math.min(C.gridExportLimitMW, Math.max(0, -net))
    baselineUnservedMWh += Math.max(0, net - C.gridImportLimitMW) * C.dtHours
    let b = bands.get(f.tariff.band)
    if (!b) {
      b = {
        band: f.tariff.band,
        importPrice: f.tariff.importCnyPerKWh,
        exportPrice: f.tariff.exportCnyPerKWh,
        baseImportMWh: 0,
        caseImportMWh: 0,
        baseExportMWh: 0,
        caseExportMWh: 0,
      }
      bands.set(f.tariff.band, b)
    }
    b.baseImportMWh += baseImport * C.dtHours
    b.caseImportMWh += m.gridImportMW * C.dtHours
    b.baseExportMWh += baseExport * C.dtHours
    b.caseExportMWh += m.gridExportMW * C.dtHours
    const kWh = 1000 * C.dtHours
    baseCostCny +=
      (baseImport * f.tariff.importCnyPerKWh - baseExport * f.tariff.exportCnyPerKWh) * kWh
    caseCostCny +=
      (m.gridImportMW * f.tariff.importCnyPerKWh - m.gridExportMW * f.tariff.exportCnyPerKWh) * kWh
  }
  const order: TariffBand[] = ['peak', 'flat', 'valley']
  const atEnd = day.frames[Math.min(end, day.frames.length - 1)].metrics
  const stored = end === day.frames.length ? day.summary.finalStoredMWh : atEnd.storedMWh
  const billDifferenceCny = baseCostCny - caseCostCny
  // Offline energy is frozen, so the last snapshot also represents day-end offline energy.
  const offlineStoredMWh = Math.max(
    0,
    atEnd.storedMWh - (atEnd.onlineCapacityMWh * atEnd.onlineSocPct) / 100,
  )
  return {
    bands: order.map((band) => bands.get(band)).filter((b): b is BandLedger => !!b),
    baseCostCny,
    caseCostCny,
    baselineUnservedMWh,
    billDifferenceCny,
    estimatedSavingsCny:
      baselineUnservedMWh > 1e-9 ||
      day.diagnostics.solver.status === 'not-converged' ||
      day.frames.slice(0, end).some((f) => f.metrics.unservedMW > 1e-9)
        ? null
        : billDifferenceCny,
    storedDeltaMWh: stored - day.summary.initialStoredMWh,
    offlineStoredMWh,
  }
}
