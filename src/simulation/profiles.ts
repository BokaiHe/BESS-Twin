import { CONFIG } from '../domain/config'
import type { ScenarioId } from '../domain/types'

const FACTORY = [
  6, 6, 6, 6, 6, 6.5, 7, 8, 10, 12, 13.5, 14, 13.8, 13, 12, 11, 10.5, 11.5, 12.5, 12.3, 10, 8, 7,
  6.5, 6,
]
const RESIDENTIAL = [
  1.6, 1.3, 1.1, 1, 1, 1.1, 1.5, 2, 2.4, 2, 1.5, 1.3, 1.3, 1.4, 1.5, 1.8, 2.5, 3.8, 4.8, 5, 4, 3.2,
  2.5, 2, 1.6,
]
function interpolate(values: number[], hour: number): number {
  const index = Math.floor(hour)
  return values[index] + (values[index + 1] - values[index]) * (hour - index)
}
export interface ProfilePoint {
  factoryMW: number
  residentialMW: number
  pvDcMW: number
  pvAcMW: number
  clippingMW: number
  windMW: number
}
export function profileAt(
  scenario: ScenarioId,
  minute: number,
  config: { pvDCMWp: number; pvACMW: number; windUnitMW: number; windUnits: number } = CONFIG,
): ProfilePoint {
  const hour = minute / 60
  const solar = Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)) ** 1.5
  const isCloudy = scenario === 'cloudy'
  const cloudFactor = isCloudy ? 0.23 + 0.05 * Math.sin(hour * 1.8) : 0.98
  const pvDcMW = config.pvDCMWp * solar * cloudFactor
  const pvAcMW = Math.min(config.pvACMW, pvDcMW)
  const windMW = isCloudy
    ? 1.15 + 0.2 * Math.cos(hour * 0.65)
    : 3.2 + 1.1 * Math.cos(((hour - 3) * Math.PI) / 12)
  return {
    factoryMW: interpolate(FACTORY, hour),
    residentialMW: interpolate(RESIDENTIAL, hour),
    pvDcMW,
    pvAcMW,
    clippingMW: pvDcMW - pvAcMW,
    windMW: windMW * ((config.windUnitMW * config.windUnits) / 12),
  }
}
