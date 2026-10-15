import { writeFileSync } from 'node:fs'
import * as k from './anatomy-kit/iso-kit.mjs'
import * as A from './anatomy-kit/audit.mjs'
const parts = []
const add = (id, group, x, y, z, w, d, h, move = [0, 0, 0], ride = 'shell') =>
  parts.push({ id, group, plan: { x, y, w, d, r: 0 }, z, h, move, ride })
add('cell-base', 'housing', 0, 0, 0, 104, 62, 4)
add('cell-back', 'housing', 0, 0, 4, 104, 2, 128)
add('cell-front', 'housing', 2, 60, 4, 100, 2, 128, [0, 150, 0])
add('cell-left', 'housing', 0, 2, 4, 2, 60, 128, [-180, 0, 0])
add('cell-right', 'housing', 102, 2, 4, 2, 60, 128, [180, 0, 0])
add('cell-lid', 'housing', 0, 0, 132, 104, 62, 3, [0, 0, 70])
for (let i = 0; i < 2; i++) {
  const x = 20 + i * 52
  add(`terminal-pad-${i}`, 'housing', x, 20, 135, 16, 22, 3, [0, 0, 70])
  add(`terminal-${i}`, 'housing', x + 3, 24, 138, 10, 14, 5, [0, 0, 70])
  for (let j = 0; j < 4; j++)
    add(
      `terminal-fastener-${i}-${j}`,
      'housing',
      x + (j % 2) * 12,
      20 + Math.floor(j / 2) * 18,
      138,
      3,
      3,
      1,
      [0, 0, 70],
    )
}
for (let i = 0; i < 8; i++) add(`crimp-${i}`, 'housing', 6 + i * 12, 62, 128, 7, 1, 4, [0, 150, 0])
// One representative pair. Foil, coating and membrane are exaggerated in thickness.
add('positive-collector', 'positive', 8, 10, 4, 88, 1, 114, [-125, 0, 0], 'layers')
add('positive-electrode', 'positive', 8, 11, 4, 88, 4, 114, [-125, 0, 0], 'layers')
add('positive-tab', 'positive', 20, 10, 118, 12, 1, 12, [-125, 0, 0], 'layers')
add('separator', 'separator', 6, 17, 4, 92, 2, 116, [0, 0, 0], 'layers')
add('negative-electrode', 'negative', 8, 21, 4, 88, 4, 114, [125, 0, 0], 'layers')
add('negative-collector', 'negative', 8, 20, 4, 88, 1, 114, [125, 0, 0], 'layers')
add('negative-tab', 'negative', 72, 20, 118, 12, 1, 12, [125, 0, 0], 'layers')
const P = k.fitProjection(
  parts.flatMap((p) =>
    [0, 1].flatMap((t) =>
      k.boxCorners(
        { ...p.plan, x: p.plan.x + p.move[0] * t, y: p.plan.y + p.move[1] * t },
        p.z + p.move[2] * t,
        p.z + p.h + p.move[2] * t,
      ),
    ),
  ),
  900,
  560,
  { pad: 65, azimuth: 70, elevation: 20 },
)
const at = (v) => k.iso(v, P),
  zero = at([0, 0, 0])
const R = A.recorder(P)
for (const p of parts) {
  const { x, y, w, d } = p.plan
  const paths = k.slabOf(p.plan, p.z, p.h, P, 4, 0.15)
  const textures = [],
    pores = []
  const faceRect = (xx, zz, ww, hh) =>
    k.pathOf(
      [
        [xx, y + d, zz],
        [xx + ww, y + d, zz],
        [xx + ww, y + d, zz + hh],
        [xx, y + d, zz + hh],
      ].map(at),
      true,
    )
  if (p.id.endsWith('-electrode') || p.id === 'separator') {
    for (let z = p.z + 5; z < p.z + p.h - 5; z += 9)
      for (let dx = 5; dx < w - 5; dx += 9) pores.push(at([x + dx, y + d, z]))
  }
  if (p.id === 'cell-front') {
    textures.push(faceRect(x + 9, p.z + 12, w - 18, p.h - 24))
    textures.push(faceRect(x + 14, p.z + 88, 48, 10))
  }
  const shape = A.slab(p.plan, p.z, p.h, { name: p.id, ground: p.id === 'cell-base' }, 4)
  R.put({
    name: p.id,
    piece: p.group,
    ride: p.ride,
    move: p.move,
    at: [x + w / 2, y + d / 2, p.z + p.h / 2],
    svg: k.solidSvg(paths),
    shapes: [R.solid(shape)],
    art: {
      ...p,
      paths,
      textures,
      pores,
      anchor: at([x + w / 2, y + d, p.z + p.h / 2]),
      offset: at(p.move).map((v, i) => v - zero[i]),
    },
  })
}
const smooth = (t, a, b) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
const states = Array.from({ length: 21 }, (_, i) => ({
  shares: { shell: smooth(i / 20, 0, 0.4), layers: smooth(i / 20, 0.45, 1) },
}))
A.settle(R, P, { states })
A.auditOrExit(R, P, { frames: states, apart: true })
if (process.exitCode) process.exit(process.exitCode)
// Solve one painter order and verify it throughout the camera turn.
let cellTurnOrder = []
for (let i = 0; i <= 20; i++) {
  const turn = i / 20
  const camera = {
    ...P,
    azimuth: 70 + 20 * turn,
    elevation: 20 * (1 - turn),
    scale: P.scale + (2.15 / Math.sqrt(1.6) - P.scale) * turn,
    origin: [
      P.origin[0] + (450 - 52 * 2.15 - P.origin[0]) * turn,
      P.origin[1] + (295 + 61 * 2.15 - P.origin[1]) * turn,
    ],
  }
  const rotated = A.recorder(camera)
  for (const p of parts) {
    const plan = { ...p.plan, x: p.plan.x + p.move[0], y: p.plan.y + p.move[1] },
      z = p.z + p.move[2]
    rotated.put({
      name: p.id,
      at: [plan.x + plan.w / 2, plan.y + plan.d / 2, z + p.h / 2],
      shapes: [rotated.solid(A.slab(plan, z, p.h, { name: p.id }, 4))],
    })
  }
  if (i === 0) {
    A.settle(rotated, camera, { states: [0] })
    cellTurnOrder = rotated.items
      .slice()
      .sort((a, b) => a.key - b.key)
      .map((p) => p.name)
  }
  for (const item of rotated.items) item.key = cellTurnOrder.indexOf(item.name)
  const checked = A.depthOrder(rotated.items, camera, { states: [0] })
  if (checked.problems.length) {
    console.error('Turn depth failure', turn, checked.problems)
    process.exit(1)
  }
}
console.log('Camera turn: 21 poses passed verified painter ordering.')
const result = R.items
  .sort((a, b) => a.key - b.key)
  .map((p) => ({ ...p.art, key: p.key, depth: p.move.reduce((sum, n, i) => sum + n * R.V[i], 0) }))
writeFileSync(
  new URL('../src/components/cabinet/cellGeometry.ts', import.meta.url),
  '// Generated by npm run cell:build.\nexport const cellProjection = ' +
    JSON.stringify(P) +
    '\nexport const cellTurnOrder = ' +
    JSON.stringify(cellTurnOrder) +
    '\nexport const cellGeometry = ' +
    JSON.stringify(result) +
    '\n',
)
console.log(`Generated ${result.length} cell solids.`)
