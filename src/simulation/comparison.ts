import { ENERGY_TOLERANCE_MWH, UNSERVED_TOLERANCE_MWH } from '../domain/parameters'
import type { SimulationDay } from '../domain/types'

export type ComparisonStatus =
  'comparable' | 'different-scenario' | 'different-supply' | 'not-converged' | 'non-periodic'
/** Earliest minute in case the daily maximum is reached more than once. */
export function peakImport(day: SimulationDay) {
  const frame = day.frames.reduce((peak, f) =>
    f.metrics.gridImportMW > peak.metrics.gridImportMW ? f : peak,
  )
  return { powerMW: frame.metrics.gridImportMW, minute: frame.minute, band: frame.tariff.band }
}
/** Compare complete days only; never credit unsupplied demand or borrowed initial energy. */
export function compareDays(original: SimulationDay, proposal: SimulationDay) {
  let status: ComparisonStatus = 'comparable'
  if (original.id !== proposal.id) status = 'different-scenario'
  else if ([original, proposal].some((d) => d.diagnostics.solver.status === 'not-converged'))
    status = 'not-converged'
  else if (
    Math.abs(original.summary.unservedMWh - proposal.summary.unservedMWh) > UNSERVED_TOLERANCE_MWH
  )
    status = 'different-supply'
  else if (
    [original, proposal].some(
      (d) => Math.abs(d.summary.finalStoredMWh - d.summary.initialStoredMWh) > ENERGY_TOLERANCE_MWH,
    )
  )
    status = 'non-periodic'
  const billDifferenceCny = original.summary.costCny - proposal.summary.costCny
  return {
    status,
    billDifferenceCny,
    comparableSavingsCny: status === 'comparable' ? billDifferenceCny : null,
    hasUnserved: [original, proposal].some((d) => d.summary.unservedMWh > UNSERVED_TOLERANCE_MWH),
    originalPeakMW: peakImport(original).powerMW,
    proposalPeakMW: peakImport(proposal).powerMW,
    originalPeak: peakImport(original),
    proposalPeak: peakImport(proposal),
  }
}
