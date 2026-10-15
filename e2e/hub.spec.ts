import { expect, test } from '@playwright/test'

test('explorer hub: badge expands to three previews that open each explorer in the app language', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'zh'))
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  const badge = page.getByRole('button', { name: '展开设备探索' })
  await expect(badge).toBeVisible()
  await badge.click()
  const hub = page.getByRole('region', { name: '设备内部探索' })
  const tiles = hub.locator('.hub-tile')
  await expect(tiles).toHaveCount(3)
  // Previews are real images, not broken links.
  for (const img of await hub.locator('.hub-image img').all())
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(
      true,
    )

  for (const [index, title] of [
    [0, '储能集装箱探索'],
    [1, '光伏组件探索'],
    [2, '风力发电机探索'],
  ] as const) {
    await tiles.nth(index).click()
    const dialog = page.getByRole('dialog', { name: title })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('正常运行系统 · 结构探索')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }

  await hub.getByRole('button', { name: '收起' }).click()
  await expect(page.getByRole('button', { name: '展开设备探索' })).toBeVisible()
})

test('explorer hub: English labels and stacked tiles on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'en'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Show equipment explorers' }).click()
  const hub = page.getByRole('region', { name: 'Inside the equipment' })
  await expect(hub.locator('.hub-tile')).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await hub.locator('.hub-tile').nth(2).click()
  await expect(page.getByRole('dialog', { name: 'Wind Turbine Explorer' })).toBeVisible()
})

for (const [width, height] of [
  [1366, 768],
  [1024, 768],
] as const)
  test(`explorer hub: stays above the timeline and alarm at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'en'))
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Storage fault' }).click()
    await page.getByRole('button', { name: 'Show equipment explorers' }).click()
    const panel = page.locator('.hub-panel')
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!
    const [hub, timeline, legend, alarm] = await Promise.all([
      box('.hub-panel'),
      box('.timeline'),
      box('.legend-chip'),
      box('.alarm-toast'),
    ])
    // No overlap with the legend strip or the timeline card.
    expect(hub.y + hub.height).toBeLessThanOrEqual(legend.y + 1)
    expect(hub.y + hub.height).toBeLessThanOrEqual(timeline.y + 1)
    // The fault alarm sits above the panel and is fully visible.
    expect(alarm.y + alarm.height).toBeLessThanOrEqual(hub.y + 1)
    // Every preview tile (the clickable entry) is reachable inside the panel.
    for (const enter of await panel.locator('.hub-tile').all()) {
      await enter.scrollIntoViewIfNeeded()
      const e = (await enter.boundingBox())!
      const p = (await panel.boundingBox())!
      expect(e.y).toBeGreaterThanOrEqual(p.y - 1)
      expect(e.y + e.height).toBeLessThanOrEqual(p.y + p.height + 1)
    }
  })

test('explorer hub: focus follows expand, collapse and returns from an explorer', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'en'))
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Show equipment explorers' }).focus()
  await page.keyboard.press('Enter')
  const tiles = page.locator('.hub-tile')
  await expect(tiles.first()).toBeFocused()
  // Hub tile → explorer → close returns to the same tile.
  await page.keyboard.press('Tab')
  await expect(tiles.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Solar Module Explorer' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tiles.nth(1)).toBeFocused()
  await page.getByRole('button', { name: 'Hide' }).click()
  await expect(page.getByRole('button', { name: 'Show equipment explorers' })).toBeFocused()
})

for (const [width, height, lang] of [
  [1024, 650, 'zh'],
  [1366, 600, 'en'],
] as const)
  test(`explorer hub: short window keeps controls reachable at ${width}×${height} (${lang})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.addInitScript(
      (language) => localStorage.setItem('bess-twin-language', language),
      lang,
    )
    await page.goto('/')
    const zh = lang === 'zh'
    await page
      .getByRole('button', { name: zh ? '储能故障日' : 'Storage fault', exact: true })
      .click()
    await page
      .getByRole('button', { name: zh ? '展开设备探索' : 'Show equipment explorers' })
      .click()
    const panel = page.locator('.hub-panel')
    const hub = (await panel.boundingBox())!
    const alarm = (await page.locator('.alarm-toast').boundingBox())!
    const timeline = (await page.locator('.timeline').boundingBox())!
    expect(hub.height).toBeGreaterThan(140)
    expect(alarm.y + alarm.height).toBeLessThanOrEqual(hub.y)
    expect(hub.y + hub.height).toBeLessThanOrEqual(timeline.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('.alarm-toast').scrollIntoViewIfNeeded()
    await expect(page.locator('.alarm-toast')).toBeInViewport({ ratio: 1 })
    // Click each actual entry and close its dialog: geometry-only assertions can
    // miss an overlay intercepting clicks, or a focus target clipped by a scroll box.
    const titles = zh
      ? ['储能集装箱探索', '光伏组件探索', '风力发电机探索']
      : ['BESS Container Explorer', 'Solar Module Explorer', 'Wind Turbine Explorer']
    for (let i = 0; i < titles.length; i++) {
      const tile = panel.locator('.hub-tile').nth(i)
      await tile.click()
      await expect(page.getByRole('dialog', { name: titles[i] })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(tile).toBeFocused()
      await expect(tile).toBeInViewport({ ratio: 1 })
    }
    await panel.getByRole('button', { name: zh ? '收起' : 'Hide', exact: true }).click()
    await expect(page.locator('.hub-badge')).toBeFocused()
    await expect(page.locator('.hub-badge')).toBeInViewport({ ratio: 1 })
    await page.locator('.timeline').scrollIntoViewIfNeeded()
    await expect(page.locator('.timeline')).toBeInViewport({ ratio: 1 })
  })

test('explorer hub: resizing across the short-window breakpoint preserves an open panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'en'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Storage fault', exact: true }).click()
  await page.getByRole('button', { name: 'Show equipment explorers' }).click()
  for (const height of [740, 600, 768, 720, 741]) {
    await page.setViewportSize({ width: 1366, height })
    const panel = page.locator('.hub-panel')
    const timeline = page.locator('.timeline')
    await expect
      .poll(async () => {
        const hub = (await panel.boundingBox())!
        const lower = (await timeline.boundingBox())!
        return hub.height > 50 && hub.y + hub.height <= lower.y
      })
      .toBe(true)
    await expect(panel.locator('.hub-tile')).toHaveCount(3)
    await panel.getByRole('button', { name: 'Hide', exact: true }).click()
    await expect(page.locator('.hub-badge')).toBeFocused()
    await page.locator('.hub-badge').click()
    await expect(panel.locator('.hub-tile').first()).toBeFocused()
  }
})
