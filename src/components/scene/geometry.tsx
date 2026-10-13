import { useMemo, type ReactNode } from 'react'
import { Quaternion, Vector3 } from 'three'

export type V3 = [number, number, number]

/** Axis-aligned box with soft standard material — the basic building brick of the low-poly scene. */
export function Box({
  at = [0, 0, 0],
  size,
  color = '#f4f6f9',
  rotation,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.75,
  metalness = 0,
  shadow = true,
  opacity,
  children,
}: {
  at?: V3
  size: V3
  color?: string
  rotation?: V3
  emissive?: string
  emissiveIntensity?: number
  roughness?: number
  metalness?: number
  shadow?: boolean
  opacity?: number
  children?: ReactNode
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissiveIntensity}
        transparent={opacity !== undefined}
        opacity={opacity ?? 1}
      />
      {children}
    </mesh>
  )
}

/** Thin bar between two points (lattice towers, gantries, fences). */
export function Beam({
  a,
  b,
  r = 0.06,
  color = '#9aa8b6',
}: {
  a: V3
  b: V3
  r?: number
  color?: string
}) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new Vector3(...a)
    const vb = new Vector3(...b)
    const dir = vb.clone().sub(va)
    const length = dir.length()
    return {
      position: va.clone().add(vb).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
      length,
    }
  }, [a, b])
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <boxGeometry args={[r, length, r]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
    </mesh>
  )
}

export function Cylinder({
  at = [0, 0, 0],
  r,
  rTop,
  h,
  color = '#eef2f6',
  segments = 16,
  rotation,
  emissive,
  emissiveIntensity = 0,
}: {
  at?: V3
  r: number
  rTop?: number
  h: number
  color?: string
  segments?: number
  rotation?: V3
  emissive?: string
  emissiveIntensity?: number
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, segments]} />
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}

export function Tree({
  at,
  scale = 1,
  color = '#8fcfb0',
}: {
  at: V3
  scale?: number
  color?: string
}) {
  return (
    <group position={at} scale={scale}>
      <Cylinder at={[0, 0.35, 0]} r={0.08} rTop={0.06} h={0.7} color="#b7a58f" segments={6} />
      <mesh position={[0, 1.05, 0]} castShadow>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

/** Polyline helper with cumulative length for sampling positions along routes. */
export class Path {
  readonly points: Vector3[]
  readonly lengths: number[]
  readonly length: number
  constructor(points: Vector3[]) {
    this.points = points
    this.lengths = [0]
    for (let i = 1; i < points.length; i++)
      this.lengths.push(this.lengths[i - 1] + points[i].distanceTo(points[i - 1]))
    this.length = this.lengths[this.lengths.length - 1] || 1
  }
  /** Position and unit tangent at fraction s ∈ [0, 1]. */
  at(s: number, outPos: Vector3, outDir: Vector3) {
    const d = Math.min(Math.max(s, 0), 1) * this.length
    let i = 1
    while (i < this.lengths.length - 1 && this.lengths[i] < d) i++
    const a = this.points[i - 1],
      b = this.points[i]
    const seg = this.lengths[i] - this.lengths[i - 1] || 1
    const t = (d - this.lengths[i - 1]) / seg
    outPos.lerpVectors(a, b, t)
    outDir.subVectors(b, a).normalize()
  }
}

/** Sagging conductor between two supports, sampled as a parabola. */
export function catenary(a: V3, b: V3, sag: number, steps = 14): Vector3[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return new Vector3(
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t),
      a[2] + (b[2] - a[2]) * t,
    )
  })
}
