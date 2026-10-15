import { writeFileSync } from 'node:fs'
import * as k from './anatomy-kit/iso-kit.mjs'
import * as A from './anatomy-kit/audit.mjs'
import { container, moduleParts, animatedRack } from './cabinet-parts.mjs'

function generate(parts, isModule = false, animated = false) {
  const width = 900,
    height = 560
  const P = k.fitProjection(
    parts.flatMap((p) => k.boxCorners(p.plan, p.z, p.z + p.h)),
    width,
    height,
    { pad: isModule ? 95 : 55, azimuth: 60, elevation: isModule ? 32 : 23 },
  )
  const at = (p) => k.iso(p, P)
  const face = (p, x, z, w, h) =>
    k.pathOf(
      [
        [x, p.plan.y + p.plan.d, z],
        [x + w, p.plan.y + p.plan.d, z],
        [x + w, p.plan.y + p.plan.d, z + h],
        [x, p.plan.y + p.plan.d, z + h],
      ].map(at),
      true,
    )
  const R = A.recorder(P)
  const E = A.recorder(P)
  const lifts = { fixed: 0, tray: 0, plate: 12, cells: 44, cover: 100 }
  const origin = at([0, 0, 0])
  const projected = (v) => at(v).map((n, i) => n - origin[i])
  const extraction = projected([0, 155, 0])
  const smooth = (n, a, b) => {
    const t = Math.max(0, Math.min(1, (n - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const states = Array.from({ length: 21 }, (_, i) => i / 20)
  const unfold = states.map((t) => ({
    shares: { cover: smooth(t, 0, 0.45), cells: smooth(t, 0.4, 0.8), plate: smooth(t, 0.8, 1) },
  }))
  for (const p of parts) {
    const { x, y, w, d } = p.plan
    const paths = k.slabOf(p.plan, p.z, p.h, P, 4, p.h > 5 ? 0.5 : 0),
      textures = [],
      screws = []
    if (
      [
        'battery',
        'pcs',
        'bms',
        'dc',
        'cooler-face',
        'ups',
        'power',
        'gateway',
        'fire',
        'door',
      ].includes(p.detail)
    ) {
      for (const dx of [2, w - 2])
        for (const dz of [2, p.h - 2]) screws.push(at([x + dx, y + d, p.z + dz]))
      if (p.h > 10) {
        textures.push(face(p, x + 5, p.z + p.h - 8, Math.min(20, w - 10), 4))
        for (let i = 0; i < Math.floor((w - 10) / 4); i++)
          textures.push(face(p, x + 5 + i * 4, p.z + 4, 1.5, Math.min(9, p.h - 12)))
      }
    }
    if (p.detail === 'door') {
      textures.push(face(p, x + w - 9, p.z + 45, 3, 22))
      textures.push(face(p, x + 3, p.z + 3, w - 6, p.h - 6))
    }
    if (p.detail === 'post')
      for (let z = p.z + 5; z < p.z + p.h - 4; z += 8) screws.push(at([x + w / 2, y + d, z]))
    if (p.detail === 'cell') {
      // Closed terminal footprints on top of each representative prismatic cell.
      for (const xx of [x + w * 0.18, x + w * 0.68])
        textures.push(
          k.pathOf(
            [
              [xx, y + 7, p.z + p.h],
              [xx + w * 0.14, y + 7, p.z + p.h],
              [xx + w * 0.14, y + 12, p.z + p.h],
              [xx, y + 12, p.z + p.h],
            ].map(at),
            true,
          ),
        )
    }
    const shape = A.slab(
      p.plan,
      p.z,
      p.h,
      {
        name: p.id,
        ground: p.id.startsWith('foot-') || p.id === 'module-foot' || p.id === 'module-tray',
      },
      4,
    )
    const moving = animated && p.layer !== 'fixed'
    const move = moving ? [0, 155, 0] : [0, 0, 0]
    R.put({
      move,
      name: p.id,
      piece: p.group,
      at: [x + w / 2, y + d / 2, p.z + p.h / 2],
      svg: k.solidSvg(paths),
      shapes: [R.solid(shape)],
      art: {
        id: p.id,
        group: p.group,
        shell: p.shell,
        paths,
        textures,
        screws,
        layer: p.layer ?? 'fixed',
        rack: p.rack ?? -1,
        moving,
        lift: projected([0, 0, lifts[p.layer] ?? 0]),
      },
    })
    if (animated && !p.shell) {
      const expandedPlan = { ...p.plan, y: y + (moving ? 155 : 0) }
      E.put({
        name: p.id,
        piece: p.layer,
        at: [x + w / 2, expandedPlan.y + d / 2, p.z + p.h / 2],
        move: [0, 0, lifts[p.layer]],
        svg: k.solidSvg(k.slabOf(expandedPlan, p.z, p.h, P, 4, p.h > 5 ? 0.5 : 0)),
        shapes: [
          E.solid(
            A.slab(
              expandedPlan,
              p.z,
              p.h,
              { name: p.id, ground: p.id.startsWith('foot-') || p.id === 'module-tray' },
              4,
            ),
          ),
        ],
      })
    }
  }
  // Hidden shell is absent from the extraction path; its closed pose is audited separately.
  const shellItems = animated ? R.items.filter((i) => i.art.shell) : []
  if (animated) {
    R.items = R.items.filter((i) => !i.art.shell)
    R.solids = R.items.flatMap((i) => i.shapes)
  }
  A.settle(R, P, { states: animated ? states : [0] })
  A.auditOrExit(R, P, { frames: animated ? states : [], apart: animated })
  if (animated) {
    A.settle(E, P, { states: unfold })
    A.auditOrExit(E, P, { frames: unfold, apart: true })
  }
  if (process.exitCode) process.exit(process.exitCode)
  const art = [...R.items, ...shellItems]
    .sort((a, b) => a.key - b.key)
    .map((p) => {
      const e = E.items.find((e) => e.name === p.name)
      return {
        ...p.art,
        key: p.key,
        depthLift: p.move.reduce((sum, n, i) => sum + n * R.V[i], 0),
        expandKey: e?.key ?? p.key,
        expandDepth: e ? e.move.reduce((sum, n, i) => sum + n * E.V[i], 0) : 0,
      }
    })
  const bounds = (points) => {
    const xy = points.map(at),
      xs = xy.map((p) => p[0]),
      ys = xy.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
      cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const w = Math.max(
      Math.max(...xs) - Math.min(...xs) + 110,
      ((Math.max(...ys) - Math.min(...ys) + 110) * width) / height,
    )
    return [cx - w / 2, cy - (w * height) / width / 2, w, (w * height) / width]
  }
  const movingParts = parts.filter((p) => p.layer && p.layer !== 'fixed')
  const camera1 = animated
    ? bounds(
        parts
          .filter((p) => !p.shell)
          .flatMap((p) =>
            k.boxCorners(
              { ...p.plan, y: p.plan.y + (p.layer !== 'fixed' ? 155 : 0) },
              p.z,
              p.z + p.h,
            ),
          ),
      )
    : [0, 0, width, height]
  const camera2 = animated
    ? bounds(
        movingParts.flatMap((p) =>
          k.boxCorners(
            { ...p.plan, y: p.plan.y + 155 },
            p.z + lifts[p.layer],
            p.z + p.h + lifts[p.layer],
          ),
        ),
      )
    : camera1
  return {
    width,
    height,
    extraction,
    cameras: [[0, 0, width, height], camera1, camera2],
    parts: art,
    halo: k.slabOf(
      isModule ? { x: -3, y: -3, w: 124, d: 91, r: 3 } : { x: -3, y: -3, w: 366, d: 121, r: 3 },
      0,
      0.1,
      P,
    ).fill,
  }
}
const result = {
  container: generate(container),
  module: generate(moduleParts, true),
  racks: Array.from({ length: 4 }, (_, i) => generate(animatedRack(i), false, true)),
}
writeFileSync(
  new URL('../src/components/cabinet/geometry.ts', import.meta.url),
  '// Generated by npm run cabinet:build; do not hand-edit.\nexport const cabinetGeometry = ' +
    JSON.stringify(result) +
    '\n',
)
console.log(
  `Generated ${container.length} container solids and ${moduleParts.length} module solids.`,
)
