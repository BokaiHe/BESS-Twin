import { CONFIG, tariffPeriodAt } from './config'
import type { Tariff } from './types'

export const MODEL_VERSION = 'parameters-v1'
export const INPUT_DATA_ID = 'demo-2026-06-18-v1'
export const ENERGY_TOLERANCE_MWH = 0.000004
export const UNSERVED_TOLERANCE_MWH = 0.001
export const PARAMETER_RULES = {
  batteryMW: { min: 0, max: 20, step: 0.5, default: 10, unit: 'MW' },
  batteryMWh: { min: 0, max: 80, step: 1, default: 20, unit: 'MWh' },
  pvDCMWp: { min: 0, max: 80, step: 1, default: 20, unit: 'MWp' },
  windMW: { min: 0, max: 60, step: 1, default: 12, unit: 'MW' },
  gridImportMW: { min: 0, max: 50, step: 0.5, default: 15, unit: 'MW' },
  gridExportMW: { min: 0, max: 50, step: 0.5, default: 15, unit: 'MW' },
  valleyPrice: { min: 0, max: 3, step: 0.01, default: 0.35, unit: 'CNY/kWh' },
  flatPrice: { min: 0, max: 3, step: 0.01, default: 0.68, unit: 'CNY/kWh' },
  peakPrice: { min: 0, max: 3, step: 0.01, default: 1.08, unit: 'CNY/kWh' },
  socMinPct: { min: 0, max: 40, step: 1, default: 10, unit: '%' },
  socMaxPct: { min: 60, max: 100, step: 1, default: 90, unit: '%' },
  chargeEfficiencyPct: { min: 80, max: 100, step: 1, default: 95, unit: '%' },
  dischargeEfficiencyPct: { min: 80, max: 100, step: 1, default: 95, unit: '%' },
  reserveMWh: { min: 0, max: 10, step: 0.5, default: 1, unit: 'MWh' },
} as const
export type ParameterKey = keyof typeof PARAMETER_RULES
export type SimulationParameters = Readonly<Record<ParameterKey, number>>
export const DEFAULT_PARAMETERS: SimulationParameters = Object.freeze(
  Object.fromEntries(
    Object.entries(PARAMETER_RULES).map(([key, rule]) => [key, rule.default]),
  ) as Record<ParameterKey, number>,
)

/** Reject invalid external inputs; UI editing rounds explicitly before submission. */
export function normalizeParameters(input: SimulationParameters): SimulationParameters {
  if (!input || Object.keys(input).some((key) => !(key in PARAMETER_RULES)))
    throw new RangeError('Unknown parameters')
  const entries = Object.entries(PARAMETER_RULES).map(([key, rule]) => {
    const value = input[key as ParameterKey]
    if (
      !Number.isFinite(value) ||
      value < rule.min ||
      value > rule.max ||
      Math.abs(value / rule.step - Math.round(value / rule.step)) > 1e-7
    )
      throw new RangeError(`Invalid parameter: ${key}`)
    return [key, Number(value.toFixed(6))]
  })
  return Object.freeze(Object.fromEntries(entries) as Record<ParameterKey, number>)
}
export function parameterKey(input: SimulationParameters): string {
  return JSON.stringify(normalizeParameters(input))
}
export function configFor(p: SimulationParameters) {
  return Object.freeze({
    ...CONFIG,
    batteryUnitMW: p.batteryMW / 4,
    batteryUnitMWh: p.batteryMWh / 4,
    pvDCMWp: p.pvDCMWp,
    pvACMW: p.pvDCMWp / 1.25,
    windUnitMW: p.windMW / 3,
    gridImportLimitMW: p.gridImportMW,
    gridExportLimitMW: p.gridExportMW,
    socMin: p.socMinPct / 100,
    socMax: p.socMaxPct / 100,
    chargeEfficiency: p.chargeEfficiencyPct / 100,
    dischargeEfficiency: p.dischargeEfficiencyPct / 100,
    reserveBufferMWh: p.reserveMWh,
  })
}
export function tariffFor(p: SimulationParameters, minute: number): Tariff {
  const band = tariffPeriodAt(minute).band
  return { band, importCnyPerKWh: p[`${band}Price`], exportCnyPerKWh: 0.28 }
}
export interface SolverState {
  readonly status: 'converged' | 'not-converged' | 'not-applicable'
  readonly iterations: number
  readonly toleranceMWh: number
  readonly residualMWh: number
  readonly initialStoredMWh: number
  readonly finalStoredMWh: number
  readonly initialization: 'sunny' | 'cloudy'
}
export interface SimulationDiagnostics {
  readonly solver: SolverState
}
