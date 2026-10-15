import geometry from './geometry.json'

export type Point = readonly [number, number]
export const GEAR_RATIO = 4 // Teaching ratio, deliberately not a product specification.
export const ROTOR_RATE = 0.55 // Slowed visual angular speed, radians per second.
export const lerpPoint = (a: readonly number[], b: readonly number[], t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
]
export const pathOf = (points: readonly (readonly number[])[], closed = false) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + (closed ? ' Z' : '')

export function polylineSampler(points: readonly (readonly number[])[]) {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]))
  const total = lengths.reduce((a, b) => a + b, 0)
  return (fraction: number): Point => {
    let at = (((fraction % 1) + 1) % 1) * total
    for (let i = 0; i < lengths.length; i++) {
      if (at <= lengths[i]) return lerpPoint(points[i], points[i + 1], at / lengths[i])
      at -= lengths[i]
    }
    return [points[0][0], points[0][1]]
  }
}

// The same orthographic camera as the audited wind structure.
const P = geometry.wind.projection
const a = (P.azimuth * Math.PI) / 180,
  e = (P.elevation * Math.PI) / 180,
  k = P.scale * Math.sqrt(1.6)
export const project = ([x, y, z]: readonly number[]): Point => [
  P.origin[0] + (x * Math.sin(a) - y * Math.cos(a)) * k,
  P.origin[1] + ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * k,
]
export function rotorPlane(x: number) {
  const p = project([x, 0, 635]),
    y = project([x, 1, 635]),
    z = project([x, 0, 636])
  return `matrix(${y[0] - p[0]} ${y[1] - p[1]} ${z[0] - p[0]} ${z[1] - p[1]} ${p[0]} ${p[1]})`
}
export function shaftStripe(x0: number, x1: number, r: number, theta: number) {
  const y = r * Math.cos(theta),
    z = 635 + r * Math.sin(theta)
  return {
    d: pathOf([project([x0, y, z]), project([x1, y, z])]),
    visible: Math.cos(theta) * Math.sin(a) * Math.cos(e) + Math.sin(theta) * Math.sin(e) > 0.08,
  }
}

// All teaching paths use the same cameras and exploded offsets as the inspected solids.
const cellP = geometry.pvCell.projection
export function cellProject([x, y, z]: readonly number[]): Point {
  const a = (cellP.azimuth * Math.PI) / 180,
    e = (cellP.elevation * Math.PI) / 180,
    k = cellP.scale * Math.sqrt(1.6)
  return [
    cellP.origin[0] + (x * Math.sin(a) - y * Math.cos(a)) * k,
    cellP.origin[1] + ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * k,
  ]
}
export const cellCircuit = [
  [26, 92, 104.5],
  [-25, 92, 104.5],
  [-25, 92, -14],
  [122, 92, -14],
  [122, 92, 0.5],
  [100, 92, 0.5],
].map(cellProject)
export const cellLoad = cellProject([50, 92, -14])
export const cellLanes = Array.from({ length: 4 }, (_, i) => {
  const x = 20 + i * 20
  return {
    photon: [
      [x - 8, 93, 128],
      [x, 93, 27],
    ].map(cellProject),
    electron: [
      [x, 93, 27],
      [x - 4, 93, 57],
    ].map(cellProject),
    hole: [
      [x, 93, 27],
      [x + 7, 93, 23.5],
    ].map(cellProject),
  }
})
export const windOffset = (id: string) => geometry.wind.parts.find((part) => part.id === id)!.offset
export const offsetTransform = (id: string) => `translate(${windOffset(id).join(' ')})`
function includePoints(camera: number[], points: readonly (readonly number[])[]) {
  const x0 = Math.min(camera[0], ...points.map((p) => p[0] - 8)),
    y0 = Math.min(camera[1], ...points.map((p) => p[1] - 8))
  const x1 = Math.max(camera[0] + camera[2], ...points.map((p) => p[0] + 8)),
    y1 = Math.max(camera[1] + camera[3], ...points.map((p) => p[1] + 8))
  const w = Math.max(x1 - x0, ((y1 - y0) * 900) / 560),
    h = (w * 560) / 900
  return [(x0 + x1 - w) / 2, (y0 + y1 - h) / 2, w, h]
}

// Project incoming air through the same camera and hub displacement as the rotor.
// Streams end at its swept plane; they are airflow tracers, not solid geometry.
export const windStreams = Array.from({ length: 9 }, (_, i) => {
  const y = ((i % 3) - 1) * 28,
    z = 635 + (Math.floor(i / 3) - 1) * 32
  const offset = windOffset('hub')
  const points = Array.from({ length: 25 }, (_, j) => {
    const t = j / 24,
      p = project([
        -94 + 78 * t,
        y + Math.sin(t * Math.PI) * 3,
        z + Math.sin(t * Math.PI * 2 + i) * 1.5,
      ])
    return [p[0] + offset[0], p[1] + offset[1]]
  })
  return { points, d: pathOf(points), phase: i * 0.137 }
})
export const sunlightOrigin: Point = [
  cellLanes[0].photon[0][0] - 24,
  cellLanes[0].photon[0][1] - 24,
]
export const sunlightRays = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6
  return pathOf([
    [Math.cos(a) * 16, Math.sin(a) * 16],
    [Math.cos(a) * 22, Math.sin(a) * 22],
  ])
})
export function beamPolygon(start: readonly number[], end: readonly number[]) {
  const dx = end[0] - start[0],
    dy = end[1] - start[1],
    len = Math.hypot(dx, dy),
    x = (-dy / len) * 12,
    y = (dx / len) * 12
  return pathOf(
    [
      [start[0] + x, start[1] + y],
      [end[0] + x, end[1] + y],
      [end[0] - x, end[1] - y],
      [start[0] - x, start[1] - y],
    ],
    true,
  )
}

export const cellAnimationCamera = includePoints(geometry.pvCell.cameras[1], [
  [sunlightOrigin[0] - 24, sunlightOrigin[1] - 24],
  ...cellCircuit,
  ...cellLanes.flatMap((lane) => lane.photon),
])
export const windAnimationCamera = includePoints(geometry.wind.cameras[2], [
  ...windStreams.flatMap((stream) => stream.points),
  ...Array.from({ length: 72 }, (_, i) => {
    const p = project([
        -15,
        60 * Math.cos((i * Math.PI) / 36),
        635 + 60 * Math.sin((i * Math.PI) / 36),
      ]),
      offset = windOffset('hub')
    return [p[0] + offset[0], p[1] + offset[1]]
  }),
])

// A short moving section avoids SVG pathLength / non-scaling-stroke dash differences.
export function windSegment(points: number[][], phase: number) {
  const start = Math.max(0, phase - 0.22)
  return pathOf(
    Array.from({ length: 7 }, (_, i) => {
      const at = (start + ((phase - start) * i) / 6) * (points.length - 1),
        index = Math.min(points.length - 2, Math.floor(at))
      return lerpPoint(points[index], points[index + 1], at - index)
    }),
  )
}

export const fullWindStreams = Array.from({ length: 9 }, (_, i) => {
  const y = ((i % 3) - 1) * 170,
    z = 635 + (Math.floor(i / 3) - 1) * 180
  const points = Array.from({ length: 25 }, (_, j) => {
    const t = j / 24
    return [
      ...project([
        -390 + 374 * t,
        y + Math.sin(t * Math.PI) * 12,
        z + Math.sin(t * Math.PI * 2 + i) * 6,
      ]),
    ]
  })
  return { points, d: pathOf(points), phase: i * 0.137 }
})
const fullBounds = [
  ...fullWindStreams.flatMap((s) => s.points),
  ...Array.from({ length: 72 }, (_, i) =>
    project([-15, 315 * Math.cos((i * Math.PI) / 36), 635 + 315 * Math.sin((i * Math.PI) / 36)]),
  ),
  ...[-25, 25].flatMap((y) => [project([90, y, 0]), project([172, y, 670])]),
]
const fullX = fullBounds.map((p) => p[0]),
  fullY = fullBounds.map((p) => p[1])
const fullMinX = Math.min(...fullX),
  fullMaxX = Math.max(...fullX),
  fullMinY = Math.min(...fullY),
  fullMaxY = Math.max(...fullY)
const fullPad = (fullMaxY - fullMinY) * 0.07
export const fullWindCamera = [
  fullMinX - fullPad,
  fullMinY - fullPad,
  fullMaxX - fullMinX + fullPad * 2,
  fullMaxY - fullMinY + fullPad * 2,
]
