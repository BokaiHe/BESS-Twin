import { writeFileSync } from 'node:fs'
import * as K from './anatomy-kit/iso-kit.mjs'
import * as G from './anatomy-kit/lathe.mjs'
import * as A from './anatomy-kit/audit.mjs'

// World-space geometry: millimetre-like drawing units, deliberately not engineering scale.
// The kit rounds projected path coordinates to 0.1 px. Generate round surfaces
// at 8x precision before restoring the camera units, so nacelle zoom stays smooth.
function precisePaths(P, draw) {
  const paths = draw({ ...P, scale: P.scale * 8, origin: P.origin.map((v) => v * 8) })
  const reduce = (path) =>
    path.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (n) => String(Number((Number(n) / 8).toFixed(5))))
  for (const key of ['fill', 'outline', 'crease', 'top', 'bevel'])
    if (paths[key]) paths[key] = reduce(paths[key])
  paths.shades = paths.shades.map(reduce)
  return paths
}
const scenes = {}
function scene(name, make, azimuth = 40, elevation = 30) {
  const parts = []
  const box = (id, group, x, y, z, w, d, h, move = [0, 0, 0], ride = 'open') => {
    if (name === 'wind' && group !== 'tower') z += 425
    const plan = { x, y, w, d, r: 0 }
    parts.push({
      id,
      group,
      move,
      ride,
      at: [x + w / 2, y + d / 2, z + h / 2],
      points: K.boxCorners(plan, z, z + h),
      draw: (P) => K.slabOf(plan, z, h, P, 4),
      shape: A.slab(plan, z, h, { name: id, ground: id === 'base' }, 4),
    })
  }
  const round = (id, group, origin, axis, profile, move = [0, 0, 0], ride = 'open', hole = 0) => {
    if (name === 'wind' && group !== 'tower') origin = [origin[0], origin[1], origin[2] + 425]
    const F = G.frameAlong(origin, axis)
    const r = Math.max(...profile.map((v) => v[1]))
    const a = profile[0][0],
      b = profile.at(-1)[0]
    const points = [a, b].flatMap((s) =>
      Array.from({ length: 32 }, (_, i) => G.pointOf(F, s, r, (i * Math.PI) / 16)),
    )
    parts.push({
      id,
      group,
      move,
      ride,
      at: G.add3(origin, G.mul3(axis, (a + b) / 2)),
      points,
      draw: (P) =>
        precisePaths(P, (Q) =>
          hole
            ? G.ringBand(a, b, hole, r, F, Q, { steps: 96 })
            : G.solidOf(profile, F, Q, { steps: 96 }),
        ),
      shape: hole
        ? A.ring(F, a, b, hole, r, { name: id })
        : A.solid(F, profile, { name: id, ground: id === 'base' }),
    })
  }
  const blade = (id, angle) => {
    const c = Math.cos(angle),
      s = Math.sin(angle)
    const F = G.frameOf([-15, 0, 635], [1, 0, 0], [0, c, s], [0, -s, c])
    const poly = [
      [14, -3],
      [40, -14],
      [95, -16],
      [310, -1],
      [315, 1],
      [75, 10],
      [14, 3],
    ]
    parts.push({
      id,
      group: 'rotor',
      move: [-38, 0, 0],
      ride: 'split',
      at: G.add3(F.o, G.mul3(F.u, 65)),
      points: poly.flatMap(([u, v]) =>
        [0, 3].map((x) =>
          G.add3(G.add3(G.add3(F.o, G.mul3(F.a, x)), G.mul3(F.u, u)), G.mul3(F.v, v)),
        ),
      ),
      draw: (P) => G.prismOf(F, poly, 0, 3, P),
      shape: A.prism(F, poly, 0, 3, { name: id }),
    })
  }
  make({ box, round, blade })
  const all = parts.flatMap((p) =>
    [0, 1].flatMap((t) => p.points.map((q) => G.add3(q, G.mul3(p.move, t)))),
  )
  const P = K.fitProjection(all, 900, 560, { pad: 42, azimuth, elevation })
  const origin = K.iso([0, 0, 0], P)
  const R = A.recorder(P)
  for (const p of parts) {
    const paths = p.draw(P)
    R.put({
      svg: K.solidSvg(paths),
      name: p.id,
      piece: p.group,
      ride: p.ride,
      move: p.move,
      at: p.at,
      shapes: [R.solid(p.shape)],
      art: {
        id: p.id,
        group: p.group,
        ride: p.ride,
        paths,
        offset: K.iso(p.move, P).map((v, i) => v - origin[i]),
      },
    })
  }
  const states = Array.from({ length: 21 }, (_, i) => ({
    shares: { open: Math.min(1, i / 10), split: Math.max(0, i / 10 - 1) },
  }))
  A.settle(R, P, { states })
  A.auditOrExit(R, P, { frames: states, apart: true })
  const fit = (points) => {
    const ps = points.map((q) => K.iso(q, P)),
      xs = ps.map((p) => p[0]),
      ys = ps.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
      cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const w =
      Math.max(
        Math.max(...xs) - Math.min(...xs),
        ((Math.max(...ys) - Math.min(...ys)) * 900) / 560,
      ) * 1.18
    return [cx - w / 2, cy - (w * 560) / 1800, w, (w * 560) / 900]
  }
  const rest = fit(parts.flatMap((p) => p.points))
  const open = fit(
    parts.flatMap((p) => p.points.map((q) => G.add3(q, p.ride === 'open' ? p.move : [0, 0, 0]))),
  )
  const split = fit(all)
  // Nacelle camera crops out the tower/rotor and removed housing, without moving the drivetrain.
  if (name === 'wind') {
    const internal = parts.filter(
      (p) => !['tower', 'rotor', 'housing', 'sensors'].includes(p.group),
    )
    open.splice(0, 4, ...fit(internal.flatMap((p) => p.points)))
    split.splice(0, 4, ...fit(internal.flatMap((p) => p.points.map((q) => G.add3(q, p.move)))))
  }
  const principlePoints =
    name === 'wind'
      ? [
          ...parts
            .filter((p) => !['tower', 'rotor', 'housing', 'sensors'].includes(p.group))
            .flatMap((p) => p.points),
          ...Array.from({ length: 72 }, (_, i) => [
            -15,
            88 * Math.cos((i * Math.PI) / 36),
            635 + 88 * Math.sin((i * Math.PI) / 36),
          ]),
        ]
      : parts.flatMap((p) => p.points)
  scenes[name] = {
    projection: P,
    principleCamera: fit(principlePoints),
    parts: R.items.sort((a, b) => a.key - b.key).map((p) => p.art),
    cameras: [rest, open, split],
  }
  console.log(`${name}: ${parts.length} physical parts`)
}

scene(
  'pv',
  ({ box, round }) => {
    box('base', 'frame', -4, -4, -5, 188, 4, 17, [0, -16, 0])
    box('frame-front', 'frame', -4, 110, -5, 188, 4, 17, [0, 16, 0])
    box('frame-left', 'frame', -4, 0, -5, 4, 110, 17, [-16, 0, 0])
    box('frame-right', 'frame', 180, 0, -5, 4, 110, 17, [16, 0, 0])
    for (const x of [20, 148]) box(`mount-${x}`, 'frame', x, -4, -12, 12, 118, 7)
    for (const x of [22, 150])
      for (const y of [0, 106]) box(`clamp-${x}-${y}`, 'frame', x, y, -5, 8, 4, 3)
    for (const x of [-2, 182])
      for (const y of [-2, 112])
        round(
          `bolt-${x}-${y}`,
          'frame',
          [x, y, 12],
          [0, 0, 1],
          [
            [0, 1.2],
            [1, 1.2],
          ],
          [x < 0 ? -16 : 16, y < 0 ? -16 : 16, 0],
        )
    box('backsheet', 'backsheet', 0, 0, 0, 180, 110, 1)
    box('rear-encapsulant', 'encapsulant', 0, 0, 1, 180, 110, 1, [0, 0, 24])
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 6; col++) {
        const x = 4 + col * 29,
          y = 4 + row * 26
        box(`cell-${row}-${col}`, 'cells', x, y, 2, 27, 24, 1, [0, 0, 50])
        for (let j = 0; j < 2; j++)
          box(
            `ribbon-${row}-${col}-${j}`,
            'ribbons',
            x + 7 + j * 12,
            y,
            3,
            0.7,
            24,
            0.25,
            [0, 0, 50],
          )
      }
    box('front-encapsulant', 'encapsulant', 0, 0, 3.25, 180, 110, 1, [0, 0, 78])
    box('glass', 'glass', 0, 0, 4.25, 180, 110, 3, [0, 0, 104])
    box('junction', 'junction', 70, 35, -5, 40, 24, 5, [0, 95, -40])
    box('junction-cover', 'junction', 72, 37, -6, 36, 20, 1, [0, 95, -40])
    for (const x of [78, 100])
      round(
        `connector-${x}`,
        'junction',
        [x, 59, -2.5],
        [0, 1, 0],
        [
          [0, 1.5],
          [10, 1.5],
        ],
        [0, 95, -40],
      )
  },
  42,
  34,
)

scene(
  'pvCell',
  ({ box }) => {
    box('base', 'contact', 0, 0, 0, 100, 92, 1)
    box('silicon-base', 'silicon', 0, 0, 1, 100, 92, 7, [0, 0, 22])
    box('emitter', 'junction', 0, 0, 8, 100, 92, 1, [0, 0, 48])
    box('coating', 'coating', 0, 0, 9, 100, 92, 1, [0, 0, 71])
    for (const x of [26, 73]) box(`busbar-${x}`, 'contacts', x, 0, 10, 1, 92, 0.7, [0, 0, 94])
    for (let i = 0; i < 12; i++)
      box(`finger-${i}`, 'contacts', 0, 4 + i * 7.4, 10, 100, 0.28, 0.3, [0, 0, 94])
  },
  42,
  27,
)

scene(
  'wind',
  ({ box, round, blade }) => {
    round(
      'base',
      'tower',
      [90, 0, 0],
      [0, 0, 1],
      [
        [0, 24],
        [5, 24],
      ],
    )
    round(
      'tower',
      'tower',
      [90, 0, 5],
      [0, 0, 1],
      [
        [0, 12],
        [595, 7],
      ],
    )
    for (const z of [205, 405])
      round(
        `tower-joint-${z}`,
        'tower',
        [90, 0, z],
        [0, 0, 1],
        [
          [0, 12 - (z - 5) / 119],
          [1, 12 - (z - 4) / 119],
        ],
        [0, 0, 0],
        'open',
        11.98 - (z - 5) / 119,
      )
    box('access-door', 'tower', 88, 11.9, 8, 4, 0.4, 12)
    round(
      'yaw',
      'yaw',
      [90, 0, 175],
      [0, 0, 1],
      [
        [0, 10],
        [5, 10],
      ],
    )
    box('bedplate', 'yaw', 0, -27, 180, 172, 54, 5)
    // Split front panel around the real rotor-shaft opening, rather than drawing through it.
    box('nose-lower', 'housing', -3, -29, 180, 3, 58, 19, [0, 0, -28])
    box('nose-upper', 'housing', -3, -29, 221, 3, 58, 20, [0, 0, 64])
    box('nose-left', 'housing', -3, -29, 199, 3, 18, 22, [0, -48, 0])
    box('nose-right', 'housing', -3, 11, 199, 3, 18, 22, [0, 48, 0])
    box('rear-wall', 'housing', 0, -29, 185, 172, 2, 56, [0, -48, 0])
    box('front-wall', 'housing', 0, 27, 185, 172, 2, 56, [0, 48, 0])
    box('end-wall', 'housing', 172, -29, 180, 3, 58, 61, [110, 0, 0])
    box('roof', 'housing', 0, -29, 241, 175, 58, 3, [0, 0, 64])
    box('hatch', 'housing', 126, -12, 244, 28, 24, 1, [0, 0, 64])
    round(
      'hub',
      'rotor',
      [-24, 0, 210],
      [1, 0, 0],
      [
        [0, 2],
        [6, 11],
        [24, 11],
      ],
      [-38, 0, 0],
      'split',
    )
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3
      blade(`blade-${i}`, a)
      round(
        `pitch-${i}`,
        'rotor',
        [-13.5, 0, 210],
        [0, Math.cos(a), Math.sin(a)],
        [
          [11, 4],
          [14, 4],
        ],
        [-38, 0, 0],
        'split',
      )
    }
    for (const [a, b] of [
      [0, 12],
      [20, 36],
      [44, 55],
    ])
      round(
        `main-shaft-${a}`,
        'shaft',
        [a, 0, 210],
        [1, 0, 0],
        [
          [0, 5],
          [b - a, 5],
        ],
        [-38, 0, 0],
        'split',
      )
    for (const x of [12, 36]) {
      box(`bearing-foot-${x}`, 'bearing', x, -11, 185, 8, 22, 15, [-38, 0, 0], 'split')
      round(
        `bearing-${x}`,
        'bearing',
        [x, 0, 210],
        [1, 0, 0],
        [
          [0, 10],
          [8, 10],
        ],
        [-38, 0, 0],
        'split',
      )
    }
    box('gearbox', 'gearbox', 55, -17, 185, 36, 34, 45)
    box('gear-cover', 'gearbox', 58, 17, 189, 30, 1, 36)
    for (const x of [61, 85])
      for (const z of [192, 201, 211, 222])
        round(
          `gear-bolt-${x}-${z}`,
          'gearbox',
          [x, 18, z],
          [0, 1, 0],
          [
            [0, 1.2],
            [1, 1.2],
          ],
        )
    for (const [a, b] of [
      [91, 100],
      [102, 115],
    ])
      round(
        `high-speed-${a}`,
        'coupling',
        [a, 0, 210],
        [1, 0, 0],
        [
          [0, 2.5],
          [b - a, 2.5],
        ],
        [25, 0, 0],
        'split',
      )
    round(
      'brake',
      'brake',
      [100, 0, 210],
      [1, 0, 0],
      [
        [0, 9],
        [2, 9],
      ],
      [25, 0, 0],
      'split',
    )
    box('brake-caliper', 'brake', 99, 9, 207, 4, 4, 6, [25, 0, 0], 'split')
    const generatorProfile = [
      [0, 15],
      [14, 15],
    ]
    for (let i = 0; i < 3; i++)
      generatorProfile.push([14 + i * 6, 16], [15 + i * 6, 16], [15 + i * 6, 15], [20 + i * 6, 15])
    generatorProfile.push([45, 15])
    round('generator', 'generator', [115, 0, 210], [1, 0, 0], generatorProfile, [64, 0, 0], 'split')
    for (const x of [118, 149])
      box(`generator-foot-${x}`, 'generator', x, -13, 185, 8, 26, 10, [64, 0, 0], 'split')
    box('terminal-box', 'generator', 130, -8, 226, 16, 16, 5, [64, 0, 0], 'split')
    box('cooler', 'cooling', 113, 16, 185, 50, 9, 12, [0, 0, 0])
    for (let i = 0; i < 4; i++) box(`louver-${i}`, 'cooling', 118 + i * 10, 25, 188, 6, 0.5, 6)
    round(
      'sensor-mast',
      'sensors',
      [162, 0, 244],
      [0, 0, 1],
      [
        [0, 1],
        [12, 1],
      ],
      [0, 0, 64],
    )
    box('wind-vane', 'sensors', 154, -0.5, 256, 18, 1, 3, [0, 0, 64])
  },
  138,
  22,
)

if (process.exitCode) process.exit(process.exitCode)
writeFileSync('src/components/renewables/geometry.json', JSON.stringify(scenes))
