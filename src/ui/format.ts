import type { NodeId, Snapshot } from '../domain/types'
import type { Dict } from '../i18n'

export const mw = (v: number, digits = 1) => Math.abs(v).toFixed(digits)
export const pct = (v: number, digits = 0) => v.toFixed(digits)
/**
 * The simulation prices energy in CNY; the English UI shows USD converted at a fixed
 * example rate (display only — no market exchange rate is implied).
 */
export const CNY_PER_USD = 7.2
export const currencySymbol = (lang: 'zh' | 'en') => (lang === 'zh' ? '¥' : '$')
/** Whole-unit amount without symbol, converted for the UI language. */
export const money = (cny: number, lang: 'zh' | 'en') =>
  new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 0 }).format(
    lang === 'zh' ? cny : cny / CNY_PER_USD,
  )
/** Amount with symbol, e.g. "¥5,994" or "$833"; the minus sign goes before the symbol. */
export const moneyText = (cny: number, lang: 'zh' | 'en') =>
  `${cny < 0 ? '-' : ''}${currencySymbol(lang)}${money(Math.abs(cny), lang)}`
/** Per-kWh tariff, e.g. "¥0.68" or "$0.094". */
export const priceText = (cnyPerKWh: number, lang: 'zh' | 'en') =>
  lang === 'zh' ? `¥${cnyPerKWh.toFixed(2)}` : `$${(cnyPerKWh / CNY_PER_USD).toFixed(3)}`

export type Mode = 'charge' | 'discharge' | 'idle' | 'offline'
export function unitMode(s: Snapshot, id: NodeId): Mode {
  const n = s.nodes[id]
  if (n.status === 'offline') return 'offline'
  if (n.injectionMW > 0.01) return 'discharge'
  if (n.injectionMW < -0.01) return 'charge'
  return 'idle'
}
export function clusterMode(s: Snapshot): Mode {
  if (s.metrics.batteryDischargeMW > 0.01) return 'discharge'
  if (s.metrics.batteryChargeMW > 0.01) return 'charge'
  return 'idle'
}
export function modeText(t: Dict, mode: Mode) {
  return {
    charge: t.flow.charging,
    discharge: t.flow.discharging,
    idle: t.flow.idle,
    offline: t.flow.offline,
  }[mode]
}
export const TONE = {
  renewable: '#22b07d',
  grid: '#3d74f6',
  charge: '#0fb3cf',
  discharge: '#f59e0b',
  alarm: '#ef4444',
  idle: '#8b9bb0',
  brand: '#2f6bff',
}
export const modeTone = (mode: Mode) =>
  ({ charge: TONE.charge, discharge: TONE.discharge, idle: TONE.idle, offline: TONE.alarm })[mode]
