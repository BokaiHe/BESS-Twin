import type { Tariff, TariffBand } from './types'

export const CONFIG = Object.freeze({
  pvDCMWp: 20,
  pvACMW: 16,
  windUnitMW: 4,
  windUnits: 3,
  batteryUnits: 4,
  batteryUnitMW: 2.5,
  batteryUnitMWh: 5,
  socMin: 0.1,
  socMax: 0.9,
  /** Only the first guess: each scenario starts from its periodic (day-end = day-start) SOC. */
  initialSocGuess: 0.5,
  chargeEfficiency: 0.95,
  dischargeEfficiency: 0.95,
  gridImportLimitMW: 15,
  gridExportLimitMW: 15,
  /** Maximum cluster charging power drawn from the grid in valley / flat periods. */
  gridChargeMW: 4,
  reserveBufferMWh: 1,
  faultUnit: 3,
  faultMinute: 17 * 60 + 30,
  /** Over-temperature precursor on the faulted unit starts before the trip. */
  faultPrecursorMinute: 17 * 60 + 5,
  tempWarningC: 45,
  dtHours: 1 / 60,
})
export const INSTALLED_MW = CONFIG.batteryUnits * CONFIG.batteryUnitMW
export const INSTALLED_MWH = CONFIG.batteryUnits * CONFIG.batteryUnitMWh

export const TARIFF_PERIODS: readonly { start: number; end: number; band: TariffBand }[] = [
  { start: 0, end: 420, band: 'valley' },
  { start: 420, end: 600, band: 'flat' },
  { start: 600, end: 720, band: 'peak' },
  { start: 720, end: 1020, band: 'flat' },
  { start: 1020, end: 1260, band: 'peak' },
  { start: 1260, end: 1440, band: 'flat' },
]
const TARIFFS: Record<TariffBand, Tariff> = {
  valley: { band: 'valley', importCnyPerKWh: 0.35, exportCnyPerKWh: 0.28 },
  flat: { band: 'flat', importCnyPerKWh: 0.68, exportCnyPerKWh: 0.28 },
  peak: { band: 'peak', importCnyPerKWh: 1.08, exportCnyPerKWh: 0.28 },
}
export function tariffPeriodAt(minute: number) {
  const period = TARIFF_PERIODS.find((p) => minute >= p.start && minute < p.end)
  if (!period) throw new RangeError('Minute must be within [0, 1440).')
  return period
}
export function tariffAt(minute: number): Tariff {
  return TARIFFS[tariffPeriodAt(minute).band]
}
export function timeLabel(minute: number): string {
  const m = Math.max(0, Math.min(1440, Math.floor(minute)))
  return `${Math.floor(m / 60)
    .toString()
    .padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`
}
