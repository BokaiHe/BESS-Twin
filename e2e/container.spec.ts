import { expect, test, type Page } from '@playwright/test'

async function openExplorer(page: Page, openSystems = true) {
  await page.goto('/')
  await page.locator('.device-row').filter({ hasText: 'BESS-01' }).click()
  // Entry and explorer copy follow the app language.
  await page.getByRole('button', { name: /^(Explore inside|查看集装箱内部)/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.container-plate')).toHaveAttribute('data-view', 'enclosure')
  if (openSystems) {
    await dialog.getByRole('button', { name: /^(Remove enclosure|移除外壳)$/ }).click()
    await expect(dialog.locator('.container-plate')).toHaveAttribute('aria-busy', 'false')
  }
}

test('container: physical selection, level navigation, English copy, keyboard and focus return', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.locator('.device-row').filter({ hasText: 'BESS-01' }).click()
  const entry = page.getByRole('button', { name: 'Explore inside' })
  await entry.click()
  const dialog = page.getByRole('dialog', { name: 'BESS Container Explorer' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Container enclosure' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Remove enclosure', exact: true }).click()
  await expect(dialog.locator('.container-plate')).toHaveAttribute('aria-busy', 'false')
  await expect(dialog.getByRole('heading', { name: 'Battery racks & modules' })).toBeVisible()
  // Actual pointer selection on the physical PCS, not a programmatic click.
  const front = await dialog
    .locator('[data-piece="pcs-0"] .iso-shade[data-shade="3"]')
    .boundingBox()
  expect(front).not.toBeNull()
  await page.mouse.click(front!.x + front!.width / 2, front!.y + front!.height / 2)
  await expect(dialog.getByRole('heading', { name: 'Power Conversion System' })).toBeVisible()
  await expect(dialog.locator('[data-piece="pcs-0"]')).toHaveAttribute('data-lit', '')
  await dialog.getByRole('button', { name: 'BMS', exact: false }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('heading', { name: 'Battery Management System' })).toBeVisible()
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Enclosure', exact: true })
    .click()
  await expect(dialog.locator('[data-piece="side-skin"]')).toBeVisible()
  await dialog.getByRole('button', { name: 'Remove enclosure' }).click()
  await expect(dialog.locator('[data-piece="roof"]')).toBeHidden()
  await dialog.getByRole('button', { name: 'Inspect a battery module' }).click()
  await expect(dialog.locator('.container-plate')).toHaveAttribute('data-stage', '1')
  await expect(dialog.getByRole('heading', { name: 'An extracted battery module' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Reveal cell layers' }).click()
  await expect(dialog.locator('.container-plate')).toHaveAttribute('data-stage', '2')
  await expect(dialog.getByRole('heading', { name: 'Inside a battery module' })).toBeVisible()
  await expect(dialog.locator('[data-piece^="cell-"]')).toHaveCount(12)
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  await expect(dialog.getByRole('heading', { name: 'Cathode · Positive electrode' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Dark drawing' }).click()
  await expect(dialog.locator('.container-explorer')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(entry).toBeFocused()
  await expect(page.getByTestId('timeline-time')).toHaveText('12:00')
  expect(errors).toEqual([])
})

test('container: 390px touch viewport, reduced motion, Chinese explanations follow the app language', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'zh'))
  await page.goto('/')
  await page.locator('.device-row').filter({ hasText: 'BESS-01' }).click()
  await page.getByRole('button', { name: '查看集装箱内部' }).click()
  const dialog = page.getByRole('dialog', { name: '储能集装箱探索' })
  await expect(dialog.getByRole('button', { name: '部件导览' })).toBeDisabled()
  await expect(dialog.locator('.container-plate')).toHaveAttribute('data-view', 'enclosure')
  await dialog.getByRole('button', { name: '移除外壳', exact: true }).click()
  await dialog.getByRole('button', { name: '消防与安全' }).click()
  await expect(dialog.getByRole('heading', { name: '火灾探测与安全' })).toBeVisible()
  const overflow = await dialog.evaluate((e) => e.scrollWidth > e.clientWidth + 1)
  expect(overflow).toBe(false)
  await dialog.getByRole('button', { name: '查看电池模组' }).click()
  await expect(dialog.locator('.container-plate')).toHaveAttribute('data-stage', '1')
  await expect(dialog.getByRole('heading', { name: '抽出的电池模组' })).toBeVisible()
  await dialog.getByRole('button', { name: '展开电芯分层' }).click()
  await expect(dialog.locator('.container-plate')).toHaveAttribute('data-stage', '2')
  await expect(dialog.getByRole('heading', { name: '电池模组内部' })).toBeVisible()
  await dialog.getByRole('button', { name: '返回内部系统' }).click()
  await expect(dialog.getByRole('heading', { name: '电池簇与模组' })).toBeVisible()
  // No English explanation leaks into the Chinese explorer.
  await expect(dialog.getByText('Battery racks & modules')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '查看集装箱内部' })).toBeFocused()
})

test('container: manual entry and optional idle tour pause on manual selection', async ({
  page,
}) => {
  await openExplorer(page)
  const dialog = page.getByRole('dialog', { name: 'BESS Container Explorer' })
  await expect(dialog).toBeVisible()
  // The tour is opt-in, including after entering the systems view.
  await expect(dialog.getByRole('button', { name: 'Component tour', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await dialog.getByRole('button', { name: 'Component tour', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Pause tour', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.mouse.move(0, 0)
  await expect(dialog.getByRole('heading', { name: 'Battery Management System' })).toBeVisible({
    timeout: 10000,
  })
  await dialog.getByRole('button', { name: 'String PCS' }).click()
  await expect(dialog.getByRole('button', { name: 'Component tour', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(dialog.getByRole('heading', { name: 'Power Conversion System' })).toBeVisible()
})

test('container: physical rack extraction, continuous unfolding and reversible return', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  const plate = dialog.locator('.container-plate')
  const svg = plate.locator('svg')
  // Rack 3's visible front surface selects that rack, not the default rack.
  const face = await dialog
    .locator('[data-piece="battery-2-1"] .iso-shade[data-shade="3"]')
    .boundingBox()
  expect(face).not.toBeNull()
  await page.mouse.click(face!.x + face!.width * 0.5, face!.y + face!.height * 0.5)
  await expect(dialog.getByRole('button', { name: 'Rack 03', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(plate).toHaveAttribute('aria-busy', 'true')
  await expect.poll(async () => Number(await svg.getAttribute('data-progress'))).toBeGreaterThan(0)
  await expect.poll(async () => Number(await svg.getAttribute('data-progress'))).toBeLessThan(1)
  await expect(plate).toHaveAttribute('data-stage', '1')
  const tray = dialog.locator('[data-piece="module-tray"]')
  const extracted = await tray.getAttribute('transform')
  expect(extracted).not.toBe('translate(0 0)')
  const lid = dialog.locator('[data-piece="module-lid"]')
  expect(await lid.getAttribute('transform')).toBe(extracted)
  await dialog.getByRole('button', { name: 'Reveal cell layers' }).click()
  await expect
    .poll(async () => Number(await svg.getAttribute('data-progress')))
    .toBeGreaterThan(1.1)
  // Reverse in flight: the current pose is retained, then moves back smoothly.
  const before = Number(await svg.getAttribute('data-progress'))
  await dialog.getByRole('button', { name: 'Reassemble module' }).click()
  expect(Math.abs(Number(await svg.getAttribute('data-progress')) - before)).toBeLessThan(0.3)
  await expect(plate).toHaveAttribute('aria-busy', 'false')
  await expect(svg).toHaveAttribute('data-progress', '1.0000')
  await expect(lid).toHaveAttribute('transform', extracted!)
  await dialog.getByRole('button', { name: 'Reveal cell layers' }).click()
  await expect(plate).toHaveAttribute('data-stage', '2')
  expect(await lid.getAttribute('transform')).not.toBe(extracted)
  expect(await dialog.locator('[data-piece="cell-0-0"]').getAttribute('transform')).not.toBe(
    extracted,
  )
  await expect(tray).toHaveAttribute('transform', extracted!)
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Enclosure', exact: true })
    .click()
  await expect(dialog.locator('[data-piece="roof"]')).toBeHidden()
  await expect(plate).toHaveAttribute('aria-busy', 'false')
  await expect(svg).toHaveAttribute('data-progress', '0.0000')
  await expect(dialog.locator('[data-piece="roof"]')).toBeVisible()
  // Visible geometry bounds alone do not prove the roof is drawn in front.
  const roof = await dialog.locator('[data-piece="roof"] .iso-top').boundingBox()
  expect(roof).not.toBeNull()
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest('[data-piece]')?.getAttribute('data-piece'),
      { x: roof!.x + roof!.width / 2, y: roof!.y + roof!.height / 2 },
    ),
  ).toBe('roof')
  await dialog.getByRole('button', { name: 'Remove enclosure' }).click()
  await expect(tray).toHaveAttribute('transform', 'translate(0 0)')
  expect(errors).toEqual([])
})

test('container: every rack supports keyboard extraction and reduced-motion layer return', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openExplorer(page)
  const dialog = page.getByRole('dialog'),
    plate = dialog.locator('.container-plate')
  for (const rack of ['01', '02', '03', '04']) {
    await dialog.getByRole('button', { name: `Rack ${rack}`, exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(plate).toHaveAttribute('data-stage', '1')
    await expect(plate).toHaveAttribute('aria-busy', 'false')
    await dialog.getByRole('button', { name: 'Reveal cell layers' }).click()
    await expect(plate).toHaveAttribute('data-stage', '2')
    await expect(plate).toHaveAttribute('aria-busy', 'false')
    await dialog.getByRole('button', { name: 'Back to systems' }).click()
    await expect(plate).toHaveAttribute('data-stage', '0')
    await expect(plate.locator('svg')).toHaveAttribute('data-progress', '0.0000')
  }
})

test('container: named layers and physical individual cell selection', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await expect(dialog.locator('[data-annotation]')).toHaveCount(6)
  for (const name of [
    'Module cover',
    'Battery cells',
    'Monitoring board',
    'DC terminals',
    'Cold plate',
    'Support tray',
  ]) {
    await expect(dialog.locator('.module-label-text').filter({ hasText: name })).toBeVisible()
  }
  // The tray callout must land on the visible tray, not the overlapping cold plate.
  const trayDot = dialog.locator('[data-annotation="tray"] .module-anchor')
  await trayDot.scrollIntoViewIfNeeded()
  const dot = await trayDot.boundingBox()
  expect(dot).not.toBeNull()
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest('[data-piece]')?.getAttribute('data-piece'),
      { x: dot!.x + dot!.width / 2, y: dot!.y + dot!.height / 2 },
    ),
  ).toBe('module-tray')
  // Cell 09 sits at the front of the array. Select its visible physical face.
  const face = dialog.locator('[data-piece="cell-2-0"] .iso-shade[data-shade="3"]')
  await face.scrollIntoViewIfNeeded()
  const box = await face.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(dialog.getByRole('heading', { name: 'Cathode · Positive electrode' })).toBeVisible()
  await expect(dialog.locator('.module-cell-picker')).toHaveCount(0)
  const cell = dialog.locator('.cell-cutaway-svg')
  await expect(cell).toHaveAttribute('data-progress', '1.0000')
  await expect(cell.locator('.cell-callout')).toHaveCount(4)
  await expect(
    dialog.getByRole('group', { name: 'Cell materials' }).getByRole('button'),
  ).toHaveCount(4)
  // Click the physical separator face, not an artificial event or its control.
  const separator = cell.locator('[data-cell-piece="separator"] .iso-shade[data-shade="2"]')
  await separator.scrollIntoViewIfNeeded()
  const surface = await separator.boundingBox()
  await page.mouse.click(surface!.x + surface!.width * 0.3, surface!.y + surface!.height * 0.7)
  await expect(dialog.getByRole('heading', { name: 'Porous separator', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Electrolyte', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('heading', { name: 'Electrolyte', exact: true })).toBeVisible()
  await expect(cell.locator('.cell-wetting[data-active="true"]')).toHaveCount(3)
  for (const wet of await cell.locator('.cell-wetting').all()) {
    expect(await wet.getAttribute('d')).toBeTruthy()
    const bounds = await wet.boundingBox()
    expect(bounds!.width).toBeGreaterThan(40)
  }
  await expect(cell.locator('[data-cell-piece="electrolyte"]')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Reassemble cell', exact: true }).click()
  await expect(cell).toHaveAttribute('data-progress', '0.0000')
  await expect(cell.locator('.cell-callouts')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Expand cell', exact: true }).click()
  await expect(cell).toHaveAttribute('data-progress', '1.0000')
  await dialog.getByRole('button', { name: 'Back to module', exact: true }).click()
  await expect(dialog.locator('.container-plate')).toHaveAttribute('data-stage', '2')
  await expect(dialog.locator('[data-selected-cell]')).toHaveCount(1)
  await expect(dialog.locator('[data-piece="cell-2-0"]')).toHaveAttribute('data-selected-cell', '')
  await dialog.getByRole('button', { name: 'Reassemble module' }).click()
  await expect(dialog.locator('[data-annotation]')).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'An extracted battery module' })).toBeVisible()
  expect(errors).toEqual([])
})

test('container: mobile single-cell entry, Chinese materials and no selector grid', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'zh'))
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: '观察层级' })
    .getByRole('button', { name: '电芯分层', exact: true })
    .click()
  await expect(dialog.locator('[data-selected-cell]')).toHaveCount(1)
  await expect(dialog.locator('.module-cell-picker')).toHaveCount(0)
  await dialog.getByRole('button', { name: '打开电芯剖面' }).focus()
  await page.keyboard.press('Enter')
  for (const [button, heading] of [
    ['负极（−）', '负极（放电时为阳极）'],
    ['隔膜', '多孔隔膜'],
    ['电解液', '电解液'],
    ['正极（+）', '正极（放电时为阴极）'],
  ]) {
    await dialog.getByRole('button', { name: button, exact: true }).click()
    await expect(dialog.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(dialog.locator('.cell-materials button[aria-pressed="true"]')).toHaveCount(1)
  }
  expect(await dialog.evaluate((node) => node.scrollWidth > node.clientWidth + 1)).toBe(false)
  await dialog.getByRole('button', { name: '返回模组', exact: true }).click()
  await expect(dialog.locator('[data-selected-cell]')).toHaveCount(1)
})

test('container: cell explosion reverses continuously and returns to its module', async ({
  page,
}) => {
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  const cell = dialog.locator('.cell-cutaway-svg')
  await expect
    .poll(async () => Number(await cell.getAttribute('data-progress')))
    .toBeGreaterThan(0.2)
  const before = Number(await cell.getAttribute('data-progress'))
  expect(before).toBeLessThan(1)
  await expect(cell.locator('.cell-callouts')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Reassemble cell', exact: true }).click()
  expect(Math.abs(Number(await cell.getAttribute('data-progress')) - before)).toBeLessThan(0.35)
  await expect(cell).toHaveAttribute('data-progress', '0.0000')
  await expect(dialog.locator('.container-plate')).toHaveAttribute('aria-busy', 'false')
  await dialog.getByRole('button', { name: 'Expand cell', exact: true }).click()
  await expect(cell).toHaveAttribute('data-progress', '1.0000')
  await expect(cell.locator('.cell-callout')).toHaveCount(4)
  await dialog.getByRole('button', { name: 'Back to module', exact: true }).click()
  await expect(dialog.locator('.container-plate')).toHaveAttribute('data-stage', '2')
  await expect(dialog.locator('.iso-svg:visible')).toHaveAttribute('data-progress', '2.0000')
})

test('container: charge transport reverses both paths, pauses, and hides during reassembly', async ({
  page,
}) => {
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  // This test exercises the manual teaching controls; snapshot-driven defaults have separate coverage.
  await dialog.getByRole('button', { name: 'Discharge', exact: true }).click()
  const flow = dialog.locator('.cell-transport')
  const figure = dialog.locator('.cell-cutaway-svg')
  await figure.scrollIntoViewIfNeeded()
  await expect(flow).toHaveAttribute('data-running', 'true')
  await expect(flow).toHaveAttribute('data-mode', 'discharge')
  await expect(flow.locator('[data-particle]')).toHaveCount(8)
  await expect(flow.locator('.cell-circuit-device')).toHaveText('Load')
  const phase = async () => Number(await flow.getAttribute('data-phase'))
  const delta = (a: number, b: number) => ((b - a + 1.5) % 1) - 0.5
  const particleBefore = await flow
    .locator('[data-particle]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('transform')))
  let before = await phase()
  await expect.poll(async () => delta(before, await phase())).toBeLessThan(-0.005)
  await expect
    .poll(async () =>
      flow
        .locator('[data-particle]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('transform'))),
    )
    .not.toEqual(particleBefore)
  await dialog.getByRole('button', { name: 'Pause flow', exact: true }).click()
  await figure.scrollIntoViewIfNeeded()
  await expect(flow).toHaveAttribute('data-running', 'false')
  const frozen = await phase()
  await page.waitForTimeout(180)
  expect(await phase()).toBe(frozen)
  // Switching direction while paused changes arrows and copy, without moving particles.
  const arrows = await flow
    .locator('.cell-flow-arrow')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('transform')))
  await dialog.getByRole('button', { name: 'Charge', exact: true }).click()
  await expect(flow).toHaveAttribute('data-mode', 'charge')
  await expect(flow.locator('.cell-circuit-device')).toHaveText('DC source')
  expect(await phase()).toBe(frozen)
  expect(
    await flow
      .locator('.cell-flow-arrow')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('transform'))),
  ).not.toEqual(arrows)
  await expect(dialog.locator('.cell-flow-explanation')).toContainText('Positive → negative')
  await dialog.getByRole('button', { name: 'Play flow', exact: true }).click()
  await figure.scrollIntoViewIfNeeded()
  await expect(flow).toHaveAttribute('data-running', 'true')
  before = await phase()
  await expect.poll(async () => delta(before, await phase())).toBeGreaterThan(0.005)
  await dialog.getByRole('button', { name: 'Reassemble cell', exact: true }).click()
  await expect(flow).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Pause flow' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Expand cell', exact: true }).click()
  await figure.scrollIntoViewIfNeeded()
  await expect(flow).toHaveAttribute('data-mode', 'charge')
  await expect(flow).toHaveAttribute('data-running', 'true')
})

test('container: reduced-motion transport keeps directions and English copy on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  const flow = dialog.locator('.cell-transport')
  await expect(flow).toHaveAttribute('data-running', 'false')
  await expect(flow.locator('.cell-flow-arrow')).toHaveCount(4)
  await expect(dialog.getByRole('button', { name: 'Pause flow' })).toBeDisabled()
  const phase = await flow.getAttribute('data-phase')
  await dialog.getByRole('button', { name: 'Charge', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('button', { name: 'Charge', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(flow).toHaveAttribute('data-mode', 'charge')
  await expect(flow).toHaveAttribute('data-phase', phase!)
  await expect(dialog.locator('.cell-flow-note')).toContainText('Reduced motion')
  await expect(dialog.locator('.cell-cutaway-svg')).toHaveAttribute(
    'aria-label',
    /Positive → negative/,
  )
  expect(await dialog.evaluate((node) => node.scrollWidth > node.clientWidth + 1)).toBe(false)
})

test('container: unfold then turn before transport, with reversible camera and level electrodes', async ({
  page,
}) => {
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  // Observe actual animation stages, without relying on Playwright's scrolling latency.
  await page.evaluate(() => {
    const samples: { unfold: number; turn: number; flow: boolean }[] = []
    Object.assign(window, { cellStageSamples: samples })
    const observer = new MutationObserver(() => {
      const svg = document.querySelector('.cell-cutaway-svg')
      if (!svg) return
      const turn = Number(svg.getAttribute('data-turn'))
      samples.push({
        unfold: Number(svg.getAttribute('data-unfold')),
        turn,
        flow: !!svg.querySelector('.cell-transport'),
      })
      if (turn === 1) observer.disconnect()
    })
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-turn'],
    })
  })
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  const svg = dialog.locator('.cell-cutaway-svg')
  await expect(svg).toHaveAttribute('data-turn', '1.0000')
  const stages = await page.evaluate(
    () =>
      (window as unknown as { cellStageSamples: { unfold: number; turn: number; flow: boolean }[] })
        .cellStageSamples,
  )
  expect(stages.some((s) => s.unfold > 0 && s.unfold < 1 && s.turn === 0)).toBe(true)
  expect(stages.some((s) => s.unfold === 1 && s.turn > 0 && s.turn < 1)).toBe(true)
  expect(stages.some((s) => s.turn < 1 && s.flow)).toBe(false)
  await dialog.getByRole('button', { name: 'Reassemble cell', exact: true }).click()
  await expect(svg).toHaveAttribute('data-progress', '0.0000')
  await expect(svg).toHaveAttribute('data-turn', '0.0000')
  await dialog.getByRole('button', { name: 'Expand cell', exact: true }).click()
  await expect(svg).toHaveAttribute('data-turn', '1.0000')
  await expect(dialog.locator('.cell-transport')).toHaveCount(1)
  const positive = await svg
    .locator('[data-cell-piece="positive-electrode"] .iso-shade[data-shade="2"]')
    .boundingBox()
  const negative = await svg
    .locator('[data-cell-piece="negative-electrode"] .iso-shade[data-shade="2"]')
    .boundingBox()
  expect(Math.abs(positive!.y - negative!.y)).toBeLessThan(0.5)
  expect(negative!.x).toBeGreaterThan(positive!.x + positive!.width)
  await expect(svg.locator('[data-cell-piece="cell-front"]')).toHaveAttribute('opacity', '0')
})

test('container: mouse orbit and wheel zoom keep paused transport and contacts attached', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  const svg = dialog.locator('.cell-cutaway-svg'),
    flow = svg.locator('.cell-transport')
  await svg.scrollIntoViewIfNeeded()
  const phase = await flow.getAttribute('data-phase'),
    ionPath = await flow.locator('[data-route="ions"]').getAttribute('d')
  const negative = svg.locator('[data-cell-piece="negative-electrode"] .iso-shade[data-shade="2"]')
  const start = await negative.boundingBox()
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
  await page.mouse.down()
  await page.mouse.move(start!.x + start!.width / 2 + 85, start!.y + start!.height / 2 + 65, {
    steps: 10,
  })
  await page.mouse.up()
  await expect.poll(async () => Number(await svg.getAttribute('data-yaw'))).toBeGreaterThan(5)
  await expect.poll(async () => Number(await svg.getAttribute('data-pitch'))).toBeLessThan(-5)
  await expect(
    dialog.getByRole('heading', { name: 'Cathode · Positive electrode', exact: true }),
  ).toBeVisible()
  await expect(flow).toHaveAttribute('data-phase', phase!)
  expect(await flow.locator('[data-route="ions"]').getAttribute('d')).not.toBe(ionPath)
  const aligned = async () => {
    for (const [i, id] of ['positive-tab', 'negative-tab'].entries()) {
      const contact = await flow.locator(`[data-contact="${i}"]`).boundingBox()
      const tab = await svg
        .locator(`[data-cell-piece="${id}"] .iso-shade[data-shade="2"]`)
        .boundingBox()
      expect(Math.abs(contact!.x + contact!.width / 2 - tab!.x - tab!.width / 2)).toBeLessThan(1)
      expect(Math.abs(contact!.y + contact!.height / 2 - tab!.y - tab!.height / 2)).toBeLessThan(1)
    }
  }
  await aligned()
  const bounds = await svg.boundingBox()
  await page.mouse.move(bounds!.x + bounds!.width * 0.45, bounds!.y + bounds!.height * 0.5)
  const scroll = await dialog.evaluate((node) => node.scrollTop)
  await page.mouse.wheel(0, -220)
  await expect.poll(async () => Number(await svg.getAttribute('data-zoom'))).toBeGreaterThan(1.1)
  expect(await dialog.evaluate((node) => node.scrollTop)).toBe(scroll)
  await aligned()
  await expect(flow).toHaveAttribute('data-phase', phase!)
  await dialog.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(svg).toHaveAttribute('data-yaw', '0')
  await expect(svg).toHaveAttribute('data-pitch', '0')
  await expect(svg).toHaveAttribute('data-zoom', '1.0000')
  await expect(flow.locator('[data-route="ions"]')).toHaveAttribute('d', ionPath!)
  await svg.scrollIntoViewIfNeeded()
  const face = await negative.boundingBox()
  await page.mouse.click(face!.x + face!.width * 0.4, face!.y + face!.height * 0.4)
  await expect(
    dialog.getByRole('heading', { name: 'Anode · Negative electrode', exact: true }),
  ).toBeVisible()
})

test('container: keyboard camera bounds, reset and orbit-to-reassembly work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  const svg = dialog.locator('.cell-cutaway-svg')
  await svg.focus()
  for (let i = 0; i < 13; i++) await page.keyboard.press('ArrowRight')
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp')
  await expect(svg).toHaveAttribute('data-yaw', '55')
  await expect(svg).toHaveAttribute('data-pitch', '40')
  for (let i = 0; i < 10; i++) await page.keyboard.press('+')
  await expect(svg).toHaveAttribute('data-zoom', '2.2000')
  await page.keyboard.press('Home')
  await expect(svg).toHaveAttribute('data-zoom', '1.0000')
  await expect(svg).toHaveAttribute('data-yaw', '0')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowDown')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(svg).toHaveAttribute('data-progress', '1.0000')
  await dialog.getByRole('button', { name: 'Reassemble cell', exact: true }).click()
  await expect(svg).toHaveAttribute('data-progress', '0.0000')
  await expect(dialog.getByRole('button', { name: 'Reset view', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Expand cell', exact: true }).click()
  await expect(svg).toHaveAttribute('data-progress', '1.0000')
  await expect(svg).toHaveAttribute('data-yaw', '0')
  await expect(svg).toHaveAttribute('data-pitch', '0')
})

test('container: clicking the closed cabinet advances to internal systems', async ({ page }) => {
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  const levels = dialog.getByRole('group', { name: 'Viewing level' })
  const plate = dialog.locator('.container-plate')
  for (const piece of ['door-1', 'roof', 'side-skin']) {
    await levels.getByRole('button', { name: 'Enclosure', exact: true }).click()
    await expect(plate).toHaveAttribute('data-view', 'enclosure')
    await expect(plate).toHaveAttribute('aria-busy', 'false')
    const surface = dialog.locator(`[data-piece="${piece}"] .iso-fill`)
    await surface.scrollIntoViewIfNeeded()
    const box = await surface.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await expect(
      levels.getByRole('button', { name: 'Internal systems', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(plate).toHaveAttribute('data-view', 'systems')
    await expect(dialog.locator('[data-piece="roof"]')).toBeHidden()
    await expect(dialog.getByRole('heading', { name: 'Battery racks & modules' })).toBeVisible()
  }
  // After the first step, a physical rack must still advance into the module view.
  const rack = dialog.locator('[data-piece="battery-2-1"] .iso-shade[data-shade="3"]')
  await rack.scrollIntoViewIfNeeded()
  const box = await rack.boundingBox()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(plate).toHaveAttribute('data-stage', '1')
  await expect(dialog.getByRole('heading', { name: 'An extracted battery module' })).toBeVisible()
})

test('container: scene fades retain the outgoing view, cancel stale navigation and respect reduced motion', async ({
  page,
}) => {
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  const levels = dialog.getByRole('group', { name: 'Viewing level' })
  const scene = dialog.locator('.container-scene')
  const plate = dialog.locator('.container-plate')
  await levels.getByRole('button', { name: 'Cell layers', exact: true }).click()
  await expect(plate).toHaveAttribute('data-stage', '2')
  // Pause halfway through the actual exit animation to inspect the outgoing scene.
  const opacity = await dialog
    .getByRole('button', { name: 'Open cell cutaway', exact: true })
    .evaluate((button) => {
      ;(button as HTMLButtonElement).click()
      const scene = document.querySelector('.container-scene')!
      const animation = scene.getAnimations()[0]
      animation.pause()
      animation.currentTime = 90
      return Number(getComputedStyle(scene).opacity)
    })
  expect(opacity).toBeGreaterThan(0)
  expect(opacity).toBeLessThan(1)
  await expect(plate).toHaveAttribute('data-view', 'cells')
  await expect(scene).toHaveAttribute('inert', '')
  // A later request wins, including when it returns to the already-rendered view.
  await levels.getByRole('button', { name: 'Cell layers', exact: true }).click()
  await expect(scene).toHaveAttribute('data-transitioning', 'false')
  await expect(plate).toHaveAttribute('data-view', 'cells')
  await expect.poll(() => scene.evaluate((node) => node.getAnimations().length)).toBe(0)
  await dialog.getByRole('button', { name: 'Open cell cutaway', exact: true }).click()
  await expect(plate).toHaveAttribute('data-view', 'cell')
  await expect(scene).toHaveAttribute('data-transitioning', 'false')
  await expect.poll(() => scene.evaluate((node) => getComputedStyle(node).opacity)).toBe('1')
  // A live reduced-motion change must resolve pending navigation without a stuck fade.
  await levels.getByRole('button', { name: 'Cell layers', exact: true }).evaluate((button) => {
    ;(button as HTMLButtonElement).click()
    document.querySelector('.container-scene')!.getAnimations()[0].pause()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(plate).toHaveAttribute('data-view', 'cells')
  await expect(scene).toHaveAttribute('data-transitioning', 'false')
  await expect(scene).not.toHaveAttribute('inert', '')
  await levels.getByRole('button', { name: 'Cell layers', exact: true }).click()
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  await expect(plate).toHaveAttribute('data-view', 'cell')
  await expect(scene).toHaveAttribute('data-transitioning', 'false')
  await dialog.getByRole('button', { name: 'Back to module', exact: true }).click()
  await expect(plate).toHaveAttribute('data-view', 'cells')
})

test('container: covered WebGL stops drawing, static routes stay cached, and background resumes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts = { draws: 0 }
    Object.assign(window, { gpuCounters: counts })
    for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const original = context.prototype.drawElements
      context.prototype.drawElements = function (...args: Parameters<typeof original>) {
        counts.draws++
        return original.apply(this, args)
      }
    }
  })
  const draws = () =>
    page.evaluate(() => (window as unknown as { gpuCounters: { draws: number } }).gpuCounters.draws)
  await page.goto('/')
  await page.getByRole('button', { name: 'Auto-rotate', exact: true }).click()
  await expect.poll(draws).toBeGreaterThan(0)
  await page.locator('.device-row').filter({ hasText: 'BESS-01' }).click()
  await page.getByRole('button', { name: 'Explore inside' }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Open cell cutaway' }).click()
  const svg = dialog.locator('.cell-cutaway-svg')
  await svg.scrollIntoViewIfNeeded()
  await expect(dialog.locator('.cell-transport')).toHaveAttribute('data-running', 'true')
  const measurement = await svg.evaluate(
    (node) =>
      new Promise<{ routes: number; particles: number; gpu: number }>((resolve) => {
        let routes = 0,
          particles = 0
        const counters = (window as unknown as { gpuCounters: { draws: number } }).gpuCounters
        const before = counters.draws
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            const target = record.target as Element
            if (target.hasAttribute('data-route')) routes++
            if (target.hasAttribute('data-particle')) particles++
          }
        })
        observer.observe(node, { subtree: true, attributes: true })
        setTimeout(() => {
          observer.disconnect()
          resolve({ routes, particles, gpu: counters.draws - before })
        }, 400)
      }),
  )
  expect(measurement.gpu).toBe(0)
  expect(measurement.routes).toBe(0)
  expect(measurement.particles).toBeGreaterThan(0)
  const beforeClose = await draws()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect.poll(draws).toBeGreaterThan(beforeClose)
  await expect(page.getByRole('button', { name: 'Auto-rotate', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('container: shell opens continuously on fixed geometry and reverses without flashing', async ({
  page,
}) => {
  await openExplorer(page)
  const dialog = page.getByRole('dialog')
  const levels = dialog.getByRole('group', { name: 'Viewing level' })
  const svg = dialog.locator('.container-plate svg').first()
  await levels.getByRole('button', { name: 'Enclosure', exact: true }).click()
  await expect(svg).toHaveAttribute('data-shell-progress', '1.0000')
  await expect(dialog.locator('.container-plate')).toHaveAttribute('aria-busy', 'false')
  const covered = await svg.evaluate((node) => {
    const face = node
      .querySelector('[data-piece="module-cover-front"] .iso-fill')!
      .getBoundingClientRect()
    const hit = document.elementFromPoint(face.x + face.width / 2, face.y + face.height / 2)
    return hit?.closest('[data-piece]')?.classList.contains('container-shell')
  })
  expect(covered).toBe(true)
  const result = await svg.evaluate(
    (node) =>
      new Promise<{ stable: boolean; samples: number[]; opacity: string; moving: boolean }>(
        (resolve) => {
          const base = node.querySelector('[data-piece="base"]')!
          const transform = base.getAttribute('transform')
          const viewBox = node.getAttribute('viewBox')
          const scene = node.closest('.container-scene')!
          const roof = node.querySelector('[data-piece="roof"]')!
          const samples: number[] = []
          let stable = true,
            moving = false
          // Trigger the same SVG event delegation as a cabinet click.
          roof.querySelector('.iso-top')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          const tick = () => {
            const progress = Number(node.getAttribute('data-shell-progress'))
            samples.push(progress)
            stable &&=
              node.querySelector('[data-piece="base"]') === base &&
              base.getAttribute('transform') === transform &&
              node.getAttribute('viewBox') === viewBox &&
              getComputedStyle(scene).opacity === '1'
            moving ||=
              progress > 0 &&
              progress < 1 &&
              roof.getAttribute('transform') !== 'translate(0 0)' &&
              Number(getComputedStyle(roof).opacity) > 0 &&
              Number(getComputedStyle(roof).opacity) < 1 &&
              getComputedStyle(roof).visibility === 'visible'
            if (progress === 0)
              resolve({ stable, samples, opacity: getComputedStyle(scene).opacity, moving })
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        },
      ),
  )
  expect(result.stable).toBe(true)
  expect(result.moving).toBe(true)
  expect(result.samples.filter((v) => v > 0 && v < 1).length).toBeGreaterThan(3)
  await levels.getByRole('button', { name: 'Enclosure', exact: true }).click()
  await expect
    .poll(async () => Number(await svg.getAttribute('data-shell-progress')), {
      intervals: [16, 32],
    })
    .toBeGreaterThan(0.15)
  const before = Number(await svg.getAttribute('data-shell-progress'))
  await levels.getByRole('button', { name: 'Internal systems', exact: true }).click()
  expect(Math.abs(Number(await svg.getAttribute('data-shell-progress')) - before)).toBeLessThan(
    0.25,
  )
  await expect(svg).toHaveAttribute('data-shell-progress', '0.0000')
  await expect(dialog.locator('[data-piece="roof"]')).toBeHidden()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await levels.getByRole('button', { name: 'Enclosure', exact: true }).click()
  await expect(svg).toHaveAttribute('data-shell-progress', '1.0000')
  await expect(dialog.locator('.container-plate')).toHaveAttribute('aria-busy', 'false')
})

test('container: overview first, equipment exploration, close and refresh preserve the entry flow', async ({
  page,
}) => {
  await page.goto('/?view=container&sample=keep#overview')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.detail')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Explore inside' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/\?sample=keep#overview$/)
  // The scene label uses the same selection path as clicking a physical BESS object.
  await page.locator('.scene-chip').filter({ hasText: 'BESS plant' }).click()
  await expect(page.getByRole('heading', { name: 'BESS plant', exact: true })).toBeVisible()
  // A visitor has started exploring: the onboarding row must release its space.
  await expect(page.locator('.first-visit-hint')).toHaveCount(0)
  const entry = page.getByRole('button', { name: 'Explore inside', exact: true })
  await expect(entry).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await entry.click()
  await expect(page.getByRole('dialog', { name: 'BESS Container Explorer' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(entry).toBeFocused()
  await page.locator('.device-row').filter({ hasText: 'BESS-02' }).click()
  const title = await page.locator('.detail h2').textContent()
  await entry.click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.detail h2')).toHaveText(title!)
  await page.locator('.scene-chip').filter({ hasText: 'Solar' }).click()
  await expect(entry).toBeVisible()
  await entry.click()
  await expect(page.getByRole('dialog', { name: 'Solar Module Explorer' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.detail')).toHaveCount(0)
})

test('container: every opening stays on Enclosure until the user continues', async ({ page }) => {
  await openExplorer(page, false)
  const dialog = page.getByRole('dialog')
  const plate = dialog.locator('.container-plate')
  const first = dialog
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Enclosure', exact: true })
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('heading', { name: 'Container enclosure' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Component tour', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(plate.locator('svg')).toHaveAttribute('data-shell-progress', '1.0000')
  // Longer than the previous automatic tour interval (4.2 seconds).
  await page.waitForTimeout(4600)
  await expect(plate).toHaveAttribute('data-view', 'enclosure')
  await expect(dialog.getByRole('heading', { name: 'Container enclosure' })).toBeVisible()
  const face = await dialog.locator('[data-piece="door-1"] .iso-fill').boundingBox()
  await page.mouse.click(face!.x + face!.width / 2, face!.y + face!.height / 2)
  await expect(plate).toHaveAttribute('data-view', 'systems')
  await expect(plate).toHaveAttribute('aria-busy', 'false')
  await expect(dialog.getByRole('button', { name: 'Component tour', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('heading', { name: 'Container enclosure' })).toBeVisible()
  await expect(plate.locator('svg')).toHaveAttribute('data-shell-progress', '1.0000')
})
