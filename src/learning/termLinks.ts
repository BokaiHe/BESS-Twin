import type { ParameterKey } from '../domain/parameters'
import type { StrategyCode } from '../domain/types'
import type { GlossaryId } from './glossary'
export const parameterTerms: Record<ParameterKey, GlossaryId> = {
  batteryMW: 'mw',
  batteryMWh: 'mwh',
  pvDCMWp: 'pv-capacity',
  windMW: 'wind-capacity',
  gridImportMW: 'grid-import',
  gridExportMW: 'grid-export',
  valleyPrice: 'valley',
  flatPrice: 'flat',
  peakPrice: 'peak',
  socMinPct: 'soc-min',
  socMaxPct: 'soc-max',
  chargeEfficiencyPct: 'charge-efficiency',
  dischargeEfficiencyPct: 'discharge-efficiency',
  reserveMWh: 'reserve',
}
export const strategyTerms: Record<StrategyCode, GlossaryId> = {
  'hard-shave': 'peak-shaving',
  absorb: 'absorb',
  'export-surplus': 'grid-export',
  'valley-charge': 'valley',
  'flat-charge': 'flat',
  'peak-discharge': 'arbitrage',
  'hold-reserve': 'reserve',
  standby: 'standby',
}
export const GLOSSARY_EVENT = 'bess-twin-open-glossary'
export interface GlossaryRequest {
  id?: GlossaryId
  trigger: HTMLElement
}
export function openGlossary(request: GlossaryRequest) {
  window.dispatchEvent(new CustomEvent<GlossaryRequest>(GLOSSARY_EVENT, { detail: request }))
}
