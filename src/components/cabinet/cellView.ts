import { cellGeometry, cellProjection } from './cellGeometry'
type Piece = (typeof cellGeometry)[number]
type Point = readonly [number, number, number]
const mix = (a: number, b: number, t: number) => a + (b - a) * t
// Same orthographic camera as the Anatomy kit. Turn the camera, not the SVG canvas.
export type CellOrbit = { yaw: number; pitch: number; zoom: number; panX: number; panY: number }
export const DEFAULT_ORBIT: CellOrbit = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 }
// Frame the working layers and external wire at 100% from every allowed angle.
const framingPoints: Point[] = cellGeometry
  .filter((p) => /electrode|collector|tab|^separator$/.test(p.id))
  .flatMap((p) =>
    [0, 1].flatMap((ix) =>
      [0, 1].flatMap((iy) =>
        [0, 1].map((iz): Point => [
          p.plan.x + p.move[0] + ix * p.plan.w,
          p.plan.y + p.move[1] + iy * p.plan.d,
          p.z + p.move[2] + iz * p.h,
        ]),
      ),
    ),
  )
for (const id of ['positive-tab', 'negative-tab']) {
  const [x, y] = worldAnchor(id)
  framingPoints.push([x, y, 174.95348837209])
}
function orbitFit(orbit: CellOrbit) {
  const a = ((90 + orbit.yaw) * Math.PI) / 180,
    e = (orbit.pitch * Math.PI) / 180
  let fit = 1
  for (const [x, y, z] of framingPoints) {
    const dx = ((x - 52) * Math.sin(a) - (y - 17) * Math.cos(a)) * 2.15
    const dy =
      (((x - 52) * Math.cos(a) + (y - 17) * Math.sin(a)) * Math.sin(e) - (z - 61) * Math.cos(e)) *
      2.15
    fit = Math.min(
      fit,
      395 / Math.max(Math.abs(dx), 1),
      (dy < 0 ? 255 : 185) / Math.max(Math.abs(dy), 1),
    )
  }
  return fit
}
let cameraCache: { params: number[]; camera: ReturnType<typeof createCellCamera> } | undefined
export function cellCamera(turn: number, orbit: CellOrbit = DEFAULT_ORBIT) {
  // Orbit is mutable, so compare numeric values rather than object identity.
  const params = [turn, orbit.yaw, orbit.pitch, orbit.zoom, orbit.panX, orbit.panY]
  if (!cameraCache || params.some((v, i) => v !== cameraCache!.params[i])) {
    cameraCache = { params, camera: createCellCamera(turn, orbit) }
  }
  return cameraCache.camera
}
function createCellCamera(turn: number, orbit: CellOrbit) {
  const azimuth = mix(70, 90 + orbit.yaw, turn),
    elevation = mix(20, orbit.pitch, turn)
  const a = (azimuth * Math.PI) / 180,
    e = (elevation * Math.PI) / 180
  const k = mix(cellProjection.scale * Math.sqrt(1.6), 2.15 * orbitFit(orbit) * orbit.zoom, turn)
  const raw = ([x, y, z]: Point): [number, number] => [
    (x * Math.sin(a) - y * Math.cos(a)) * k,
    ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * k,
  ]
  const pivot = raw([52, 17, 61])
  const a0 = (70 * Math.PI) / 180,
    e0 = (20 * Math.PI) / 180,
    k0 = cellProjection.scale * Math.sqrt(1.6)
  const initial = [
    cellProjection.origin[0] + (52 * Math.sin(a0) - 17 * Math.cos(a0)) * k0,
    cellProjection.origin[1] +
      ((52 * Math.cos(a0) + 17 * Math.sin(a0)) * Math.sin(e0) - 61 * Math.cos(e0)) * k0,
  ]
  const origin = [
    mix(initial[0], 450 + orbit.panX, turn) - pivot[0],
    mix(initial[1], 295 + orbit.panY, turn) - pivot[1],
  ]
  return {
    azimuth,
    elevation,
    viewer: [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)],
    project: (point: Point): [number, number] => {
      const p = raw(point)
      return [p[0] + origin[0], p[1] + origin[1]]
    },
    depth: ([x, y, z]: Point) =>
      (x * Math.cos(a) + y * Math.sin(a)) * Math.cos(e) + z * Math.sin(e),
  }
}
function hull(points: number[][]) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const half = (ps: number[][]) => {
    const out: number[][] = []
    for (const p of ps) {
      while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    return out.slice(0, -1)
  }
  return [...half(sorted), ...half(sorted.slice().reverse())]
}
const path = (points: number[][], close = true) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('') +
  (close ? 'Z' : '')
export function cellView(piece: Piece, turn: number, orbit: CellOrbit = DEFAULT_ORBIT) {
  const camera = cellCamera(turn, orbit),
    at = camera.project
  const x = piece.plan.x + piece.move[0],
    y = piece.plan.y + piece.move[1],
    z = piece.z + piece.move[2]
  const { w, d } = piece.plan,
    h = piece.h
  const corners: Point[] = [
    [x, y, z],
    [x + w, y, z],
    [x + w, y + d, z],
    [x, y + d, z],
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ]
  const projected = corners.map(at)
  const faces = [
    [1, 2, 6, 5],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ]
  const facing = [camera.viewer[0], -camera.viewer[1], camera.viewer[1], -camera.viewer[0]]
  const horizontal = camera.viewer[2] >= 0 ? [4, 5, 6, 7] : [0, 3, 2, 1]
  const visible = faces.filter((_, i) => facing[i] > 1e-7)
  if (Math.abs(camera.viewer[2]) > 1e-7) visible.push(horizontal)
  const edges = new Map<string, number[]>()
  for (const face of visible)
    for (let i = 0; i < 4; i++) {
      const pair = [face[i], face[(i + 1) % 4]].sort((a, b) => a - b)
      edges.set(pair.join('-'), pair)
    }
  const pores: number[][] = []
  if (piece.id.endsWith('-electrode') || piece.id === 'separator') {
    for (let zz = z + 5; zz < z + h - 5; zz += 9)
      for (let xx = 5; xx < w - 5; xx += 9) pores.push(at([x + xx, y + d, zz]))
  }
  const rect = (xx: number, zz: number, ww: number, hh: number) =>
    path(
      [
        [xx, y + d, zz],
        [xx + ww, y + d, zz],
        [xx + ww, y + d, zz + hh],
        [xx, y + d, zz + hh],
      ].map((p) => at(p as unknown as Point)),
    )
  return {
    fill: path(hull(projected)),
    top: Math.abs(camera.viewer[2]) > 1e-7 ? path(horizontal.map((i) => projected[i])) : '',
    shades: faces.map((face, i) => (facing[i] > 1e-7 ? path(face.map((j) => projected[j])) : '')),
    outline: [...edges.values()]
      .map((edge) =>
        path(
          edge.map((i) => projected[i]),
          false,
        ),
      )
      .join(''),
    pores,
    textures:
      piece.id === 'cell-front'
        ? [rect(x + 9, z + 12, w - 18, h - 24), rect(x + 14, z + 88, 48, 10)]
        : [],
    depth: camera.depth([x + w / 2, y + d / 2, z + h / 2]),
  }
}
export function worldAnchor(id: string): Point {
  const p = cellGeometry.find((piece) => piece.id === id)!
  return [
    p.plan.x + p.plan.w / 2 + p.move[0],
    p.plan.y + p.plan.d + p.move[1],
    p.z + p.h / 2 + p.move[2],
  ]
}

export function frontAnchor(id: string, orbit: CellOrbit = DEFAULT_ORBIT): [number, number] {
  return cellCamera(1, orbit).project(worldAnchor(id))
}
