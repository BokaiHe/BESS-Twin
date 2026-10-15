import { cellGeometry, cellTurnOrder } from '../src/components/cabinet/cellGeometry.ts'
import * as A from './anatomy-kit/audit.mjs'
import { BELOW_ORDER as negativeOrder } from '../src/components/cabinet/cellOrbitConfig.ts'
let count = 0
for (const azimuth of [35, 45, 60, 75, 90, 105, 120, 135, 145])
  for (const elevation of [-25, -12, -1, 0, 1, 12, 25, 40]) {
    const P = { azimuth, elevation, scale: 2.15 / Math.sqrt(1.6), origin: [450, 295] }
    const R = A.recorder(P)
    for (const p of cellGeometry.filter((p) => p.group !== 'housing')) {
      const plan = { ...p.plan, x: p.plan.x + p.move[0], y: p.plan.y + p.move[1] },
        z = p.z + p.move[2]
      R.put({
        name: p.id,
        key: (elevation < 0 ? negativeOrder : cellTurnOrder).indexOf(p.id),
        shapes: [R.solid(A.slab(plan, z, p.h, { name: p.id }, 4))],
      })
    }
    const checked = A.depthOrder(R.items, P, { states: [0] })
    if (checked.problems.length) {
      console.error('Orbit depth failure', azimuth, elevation, checked.problems)
      process.exit(1)
    }
    count++
  }
console.log(`Orbit depth audit passed: ${count} camera poses.`)
