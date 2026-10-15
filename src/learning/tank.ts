import { PARAMETER_RULES } from '../domain/parameters'

export const TANK_SCALE = Object.freeze({
  capacityMWh: PARAMETER_RULES.batteryMWh.max,
  ratedMW: PARAMETER_RULES.batteryMW.max,
})
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
export function tankModel(input: {
  capacityMWh: number
  ratedMW: number
  storedMWh: number | null
  socMinPct: number
  socMaxPct: number
  flowMW: number
}) {
  const capacity = Math.max(0, Number.isFinite(input.capacityMWh) ? input.capacityMWh : 0)
  const power = Math.max(0, Number.isFinite(input.ratedMW) ? input.ratedMW : 0)
  const exists = capacity > 0
  const connected = exists && power > 0
  const flow = connected && Number.isFinite(input.flowMW) ? input.flowMW : 0
  const ratio = power ? clamp(Math.abs(flow) / power, 0, 1) : 0
  const min = clamp(input.socMinPct / 100, 0, 1)
  const max = clamp(input.socMaxPct / 100, min, 1)
  return {
    exists,
    connected,
    // The same visual scale is used for every proposal, never normalized to itself.
    width: exists ? Math.max(48, 210 * clamp(capacity / TANK_SCALE.capacityMWh, 0, 1)) : 0,
    pipeWidth: power ? Math.max(3, 18 * clamp(power / TANK_SCALE.ratedMW, 0, 1)) : 0,
    level: exists && input.storedMWh !== null ? clamp(input.storedMWh / capacity, 0, 1) : null,
    min,
    max,
    usableMWh: capacity * (max - min),
    durationHours: connected ? capacity / power : null,
    direction:
      flow < -1e-6
        ? ('charging' as const)
        : flow > 1e-6
          ? ('discharging' as const)
          : ('idle' as const),
    // One dash cycle takes 2 seconds at rated power. This is illustrative,
    // not real-time integration; every water level comes directly from a snapshot.
    animationSeconds: ratio > 1e-6 ? 2 / ratio : 0,
  }
}
