import { describe, expect, it } from 'vitest'
import { explorerState } from './explorerState'
import { createSimulationEngine } from '../simulation/engine'
import { DEFAULT_PARAMETERS } from '../domain/parameters'
import type { Snapshot, NodeId, NodeState } from '../domain/types'
const engine = createSimulationEngine(DEFAULT_PARAMETERS),
  sunny = engine.simulateDay('sunny'),
  fault = engine.simulateDay('fault')
const changed = (frame: Snapshot, id: NodeId, patch: Partial<NodeState>): Snapshot => ({
  ...frame,
  nodes: { ...frame.nodes, [id]: { ...frame.nodes[id], ...patch } },
})
describe('read-only explorer state', () => {
  it('uses each selected wind node and the configured per-unit rating', () => {
    for (const minute of [0, 720, 1140])
      for (const id of ['wind-1', 'wind-2', 'wind-3'] as const) {
        const f = sunny.frames[minute],
          v = explorerState(f, id)
        expect(v.speedRatio).toBeCloseTo(f.nodes[id].injectionMW / 4, 10)
        expect(v.nodeId).toBe(id)
        expect(v.minute).toBe(minute)
      }
    const f = { ...sunny.frames[720], parameters: { ...DEFAULT_PARAMETERS, windMW: 24 } }
    expect(explorerState(f, 'wind-2').ratedMW).toBe(8)
    expect(explorerState(f, 'wind-2').speedRatio).toBeCloseTo(
      sunny.frames[720].nodes['wind-2'].injectionMW / 8,
    )
  })
  it('stops for offline, zero output, zero installation and unavailable data; caps schematic overspeed', () => {
    const f = sunny.frames[720],
      id = 'wind-1'
    for (const patch of [
      { status: 'offline' },
      { injectionMW: 0 },
      { quality: 'stale' },
      { quality: 'missing' },
      { quality: 'disconnected' },
      { injectionMW: NaN },
      { injectionMW: -1 },
    ] as Partial<NodeState>[])
      expect(explorerState(changed(f, id, patch), id).speedRatio).toBe(0)
    expect(explorerState({ ...f, quality: 'stale' }, id).mode).toBe('unavailable')
    expect(explorerState({ ...f, parameters: { ...f.parameters, windMW: 0 } }, id).speedRatio).toBe(
      0,
    )
    expect(explorerState(changed(f, id, { injectionMW: 8 }), id).speedRatio).toBe(1)
  })
  it('derives charge/discharge/idle from node sign and isolates the offline unit', () => {
    for (const mode of ['charge', 'discharge', 'idle'] as const) {
      const f = sunny.frames.find((f) =>
        mode === 'charge'
          ? f.nodes['bess-1'].injectionMW < -0.01
          : mode === 'discharge'
            ? f.nodes['bess-1'].injectionMW > 0.01
            : Math.abs(f.nodes['bess-1'].injectionMW) < 1e-6,
      )!
      expect(explorerState(f, 'bess-1').mode).toBe(mode)
    }
    expect(explorerState(fault.frames[1140], 'bess-4').mode).toBe('offline')
    expect(explorerState(fault.frames[1140], 'bess-1').mode).toBe('discharge')
  })
  it('zero storage is static and reading does not mutate or advance snapshots', () => {
    const f = sunny.frames[720],
      before = JSON.stringify(f)
    for (let i = 0; i < 10; i++)
      expect(explorerState(f, 'bess-1')).toEqual(explorerState(f, 'bess-1'))
    expect(JSON.stringify(f)).toBe(before)
    expect(
      explorerState({ ...f, parameters: { ...f.parameters, batteryMWh: 0 } }, 'bess-1').mode,
    ).toBe('idle')
    expect(
      explorerState(
        { ...f, parameters: { ...f.parameters, batteryMW: 20, batteryMWh: 80 } },
        'bess-1',
      ),
    ).toMatchObject({ ratedMW: 5, capacityMWh: 20 })
  })
})
