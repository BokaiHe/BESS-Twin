import { describe, expect, it } from 'vitest'
import { tankModel } from './tank'
const base = {
  capacityMWh: 20,
  ratedMW: 10,
  storedMWh: 10,
  socMinPct: 10,
  socMaxPct: 90,
  flowMW: 5,
}
describe('storage tank analogy (read-only)', () => {
  it('calculates nominal hours, water level and usable SOC range independently', () => {
    expect(tankModel(base)).toMatchObject({
      durationHours: 2,
      level: 0.5,
      min: 0.1,
      max: 0.9,
      usableMWh: 16,
    })
    expect(tankModel({ ...base, capacityMWh: 40 })).toMatchObject({ durationHours: 4, level: 0.25 })
  })
  it('keeps one visual scale when changing capacity or power', () => {
    const initial = tankModel(base),
      larger = tankModel({ ...base, capacityMWh: 40 }),
      stronger = tankModel({ ...base, ratedMW: 20 })
    expect(larger.width).toBeGreaterThan(initial.width)
    expect(larger.pipeWidth).toBe(initial.pipeWidth)
    expect(stronger.width).toBe(initial.width)
    expect(stronger.pipeWidth).toBe(2 * initial.pipeWidth)
    expect(tankModel({ ...base, capacityMWh: 80 }).width).toBe(2 * larger.width)
  })
  it('does not invent a water level for an uncomputed draft', () => {
    expect(tankModel({ ...base, storedMWh: null }).level).toBeNull()
  })
  it('handles absent capacity, closed power, and both zero without infinities', () => {
    for (const overrides of [{ capacityMWh: 0 }, { ratedMW: 0 }, { capacityMWh: 0, ratedMW: 0 }]) {
      const model = tankModel({ ...base, ...overrides })
      expect(model.connected).toBe(false)
      expect(model.durationHours).toBeNull()
      expect(model.direction).toBe('idle')
      expect(model.animationSeconds).toBe(0)
    }
    expect(tankModel({ ...base, capacityMWh: 0 }).level).toBeNull()
    expect(tankModel({ ...base, ratedMW: 0 }).level).toBe(0.5)
  })
  it('uses signed snapshot power for flow direction and relative speed', () => {
    expect(tankModel(base).direction).toBe('discharging')
    expect(tankModel({ ...base, flowMW: -5 }).direction).toBe('charging')
    expect(tankModel({ ...base, flowMW: 0 }).direction).toBe('idle')
    expect(tankModel(base).animationSeconds).toBe(
      2 * tankModel({ ...base, flowMW: 10 }).animationSeconds,
    )
  })
  it('contains out-of-range levels and invalid display inputs without changing snapshots', () => {
    const input = Object.freeze({ ...base, storedMWh: 25 })
    expect(tankModel(input).level).toBe(1)
    expect(input.storedMWh).toBe(25)
    expect(tankModel({ ...base, storedMWh: -1 }).level).toBe(0)
    expect(tankModel({ ...base, ratedMW: NaN, capacityMWh: Infinity }).exists).toBe(false)
    expect(tankModel(base)).toEqual(tankModel(base))
  })
})
