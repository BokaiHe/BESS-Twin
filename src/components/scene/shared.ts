import { CONFIG } from '../../domain/config'
import { BESS_X, BESS_Z } from '../../domain/topology'
import type { NodeId } from '../../domain/types'
import type { V3 } from './geometry'

export type Selection = NodeId | 'bess-cluster'
export interface SceneLabel {
  key: string
  anchor: V3
  name: string
  value: string
  tone: string
  selected: boolean
  alert?: boolean
  onClick: () => void
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const sunElevation = (minute: number) => Math.sin((Math.PI * (minute / 60 - 6)) / 12)
/** 0 at night, 1 in full daylight. Shared by scene lighting, window glow and the UI clock. */
export const daylightAt = (minute: number) => smoothstep(-0.12, 0.3, sunElevation(minute))
export { smoothstep }

export const BESS_CENTER: V3 = [(BESS_X[0] + BESS_X[3]) / 2, 2.6, BESS_Z]
export const FAULT_NODE = `bess-${CONFIG.faultUnit + 1}` as NodeId
