import { CONFIG } from '../domain/config'
import type { NodeId, Snapshot } from '../domain/types'
export type ExplorerMode =
  'generating' | 'charge' | 'discharge' | 'idle' | 'offline' | 'unavailable'
export interface ExplorerState {
  nodeId: NodeId
  minute: number
  scenarioId: Snapshot['scenarioId']
  source: Snapshot['source']
  mode: ExplorerMode
  powerMW: number
  ratedMW: number
  capacityMWh: number
  speedRatio: number
}
/** Read-only illustration driver: output fraction is not a measured rotor speed or wind speed. */
export function explorerState(snapshot: Snapshot, nodeId: NodeId): ExplorerState {
  const node = snapshot.nodes[nodeId],
    wind = nodeId.startsWith('wind-')
  const ratedMW = wind
    ? snapshot.parameters.windMW / CONFIG.windUnits
    : snapshot.parameters.batteryMW / CONFIG.batteryUnits
  const capacityMWh = wind ? 0 : snapshot.parameters.batteryMWh / CONFIG.batteryUnits
  const valid =
    snapshot.quality === 'good' &&
    node.quality === 'good' &&
    Number.isFinite(node.injectionMW) &&
    Number.isFinite(ratedMW) &&
    (!wind || node.injectionMW >= 0)
  const mode: ExplorerMode = !valid
    ? 'unavailable'
    : node.status === 'offline'
      ? 'offline'
      : ratedMW <= 0 || (!wind && capacityMWh <= 0)
        ? 'idle'
        : Math.abs(node.injectionMW) < 1e-6
          ? 'idle'
          : wind
            ? 'generating'
            : node.injectionMW > 0
              ? 'discharge'
              : 'charge'
  const powerMW = valid ? Math.abs(node.injectionMW) : 0
  const speedRatio =
    mode === 'generating' ? Math.min(1, Math.max(0, node.injectionMW / ratedMW)) : 0
  return {
    nodeId,
    minute: snapshot.minute,
    scenarioId: snapshot.scenarioId,
    source: snapshot.source,
    mode,
    powerMW,
    ratedMW,
    capacityMWh,
    speedRatio,
  }
}
