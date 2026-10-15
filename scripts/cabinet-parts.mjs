// Educational drawing units. Not manufacturer CAD or a bill of materials.
export const container = [],
  moduleParts = []
let list = container
const add = (id, group, x, y, z, w, d, h, detail = '', shell = false) =>
  list.push({ id, group, plan: { x, y, w, d, r: 0 }, z, h, detail, shell })
for (const [i, x, y] of [
  [0, 0, 0],
  [1, 348, 0],
  [2, 0, 100],
  [3, 348, 100],
])
  add(`foot-${i}`, 'enclosure', x, y, 0, 12, 15, 8, 'foot')
add('base', 'enclosure', 0, 0, 8, 360, 115, 6, 'base')
add('rear', 'enclosure', 0, 0, 14, 360, 3, 125, 'rear')
add('end-wall', 'enclosure', 0, 3, 14, 3, 112, 125, 'wall')
add('post-left', 'enclosure', 3, 109, 14, 3, 6, 125, 'post')
add('post-right', 'enclosure', 354, 109, 14, 6, 6, 125, 'post')
add('partition', 'enclosure', 250, 3, 14, 3, 106, 125, 'wall')
for (let rack = 0; rack < 4; rack++) {
  const x = 10 + rack * 60
  add(`pcs-${rack}`, 'pcs', x, 3, 14, 52, 85, 21, 'pcs')
  for (let row = 0; row < 3; row++) {
    const z = 35 + row * 29
    add(`plate-${rack}-${row}`, 'cooling', x, 3, z, 52, 85, 2, 'plate')
    add(`battery-${rack}-${row}`, 'battery', x, 3, z + 2, 52, 85, 27, 'battery')
    add(`handle-${rack}-${row}`, 'battery', x + 15, 88, z + 12, 23, 4, 4, 'handle')
  }
  add(`bms-${rack}`, 'bms', x, 3, 122, 27, 35, 12, 'bms')
  add(`dc-${rack}`, 'protection', x + 28, 3, 122, 24, 35, 12, 'dc')
}
add('service-base', 'cooling', 259, 3, 14, 87, 84, 3, 'base')
add('liquid-cooling-unit', 'cooling', 259, 3, 17, 87, 80, 63, 'cooler')
add('cooling-face', 'cooling', 262, 83, 20, 81, 3, 57, 'cooler-face')
for (let i = 0; i < 6; i++)
  add(`radiator-fin-${i}`, 'cooling', 268 + i * 11, 86, 26, 3, 5, 36, 'fin')
add('aux-shelf', 'auxiliary', 259, 3, 80, 87, 80, 3, 'base')
add('ups', 'auxiliary', 260, 3, 83, 24, 48, 23, 'ups')
add('power-supply', 'auxiliary', 286, 3, 83, 26, 48, 23, 'power')
add('gateway', 'auxiliary', 314, 3, 83, 30, 48, 23, 'gateway')
add('fire-panel', 'safety', 259, 3, 108, 45, 40, 22, 'fire')
add('detector-rail', 'safety', 6, 3, 134, 244, 8, 3, 'rail')
for (let i = 0; i < 3; i++) add(`detector-${i}`, 'safety', 35 + i * 82, 11, 134, 8, 5, 3, 'sensor')
add('side-skin', 'enclosure', 357, 3, 14, 3, 106, 125, 'wall', true)
add('roof', 'enclosure', 0, 0, 139, 360, 115, 4, 'roof', true)
for (let i = 0; i < 4; i++)
  add(`door-${i}`, 'enclosure', 6 + i * 87, 112, 14, 86, 3, 125, 'door', true)

list = moduleParts
add('module-foot', 'battery', 0, 0, 0, 118, 85, 4, 'base')
add('module-coldplate', 'cooling', 2, 2, 4, 114, 81, 3, 'plate')
for (let row = 0; row < 3; row++)
  for (let col = 0; col < 4; col++)
    add(`cell-${row}-${col}`, 'battery', 5 + col * 22, 5 + row * 25, 7, 20, 23, 30, 'cell')
add('acquisition-board', 'bms', 95, 5, 7, 17, 72, 3, 'bms')
for (let i = 0; i < 5; i++) add(`chip-${i}`, 'bms', 99, 9 + i * 13, 10, 9, 8, 2, 'chip')
add('terminal-cover', 'protection', 95, 77, 7, 17, 5, 11, 'dc')

export function animatedRack(rack) {
  const x = 10 + rack * 60
  const pieces = container
    .filter((p) => ![`plate-${rack}-2`, `battery-${rack}-2`, `handle-${rack}-2`].includes(p.id))
    .map((p) => ({
      ...p,
      layer: 'fixed',
      rack: /^battery-|^handle-/.test(p.id) ? Number(p.id.split('-')[1]) : -1,
    }))
  const put = (id, group, dx, y, z, w, d, h, layer, detail = '') =>
    pieces.push({
      id,
      group,
      plan: { x: x + dx, y, w, d, r: 0 },
      z,
      h,
      layer,
      detail,
      shell: false,
      rack,
    })
  put('module-tray', 'battery', 0, 3, 93, 52, 85, 2, 'tray')
  put('module-coldplate', 'cooling', 1, 4, 95, 50, 83, 2, 'plate')
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++)
      put(
        `cell-${row}-${col}`,
        'battery',
        2 + col * 10,
        6 + row * 25,
        97,
        9,
        23,
        23,
        'cells',
        'cell',
      )
  put('acquisition-board', 'bms', 44, 6, 97, 6, 70, 1, 'cells')
  for (let i = 0; i < 5; i++) put(`chip-${i}`, 'bms', 45, 9 + i * 13, 98, 4, 8, 2, 'cells')
  put('terminal-cover', 'protection', 44, 79, 97, 6, 6, 8, 'cells')
  put('module-lid', 'battery', 0, 3, 121, 52, 85, 1, 'cover')
  put('module-cover-left', 'battery', 0, 4, 95, 1, 83, 26, 'cover')
  put('module-cover-right', 'battery', 51, 4, 95, 1, 83, 26, 'cover')
  put('module-cover-back', 'battery', 0, 3, 95, 52, 1, 26, 'cover')
  put('module-cover-front', 'battery', 0, 87, 95, 52, 1, 26, 'cover', 'battery')
  put('module-handle', 'battery', 15, 88, 105, 23, 4, 4, 'cover')
  return pieces
}
