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
