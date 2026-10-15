import { test, expect, type Page } from '@playwright/test'

async function open(page: Page, kind: 'pv' | 'wind') {
  await page.goto('/')
  await page.getByRole('tab', { name: /Generation/ }).click()
  await page
    .locator('.device-row')
    .filter({ hasText: kind === 'pv' ? 'Solar farm' : 'WT-01' })
    .click()
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  await expect(page.locator('.renewable-explorer')).toHaveAttribute('data-kind', kind)
  return page.getByRole('dialog')
}

for (const kind of ['pv', 'wind'] as const) {
  test(`${kind}: explicit entry, idle intact view, direct clicks and reversible assembly`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const dialog = await open(page, kind)
    const plate = dialog.locator('.renewable-plate')
    const svg = dialog.locator('.renewable-svg')
    await expect(plate).toHaveAttribute('data-stage', '0')
    await page.waitForTimeout(4600)
    await expect(svg).toHaveAttribute('data-progress', '0.0000')
    // Real SVG hit targets follow the same stage logic as the accessible controls.
    await dialog.locator(`[data-part="${kind === 'pv' ? 'cell-1-1' : 'roof'}"] .iso-top`).click()
    await expect(plate).toHaveAttribute('data-stage', '1')
    await expect
      .poll(async () => Number(await svg.getAttribute('data-progress')))
      .toBeGreaterThan(0.05)
    await expect(plate).toHaveAttribute('aria-busy', 'false')
    await dialog.locator(`[data-part="${kind === 'pv' ? 'cell-1-1' : 'gearbox'}"] .iso-top`).click()
    await expect(plate).toHaveAttribute('data-stage', '2')
    await expect(plate).toHaveAttribute('aria-busy', 'false')
    const label = kind === 'pv' ? 'Front contact grid' : 'Mechanical brake'
    await dialog.getByRole('button', { name: label, exact: false }).click()
    await expect(dialog.getByRole('heading', { name: label, exact: true })).toBeVisible()
    await expect(dialog.locator('.renewable-parts [aria-pressed="true"]')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Reassemble', exact: true }).click()
    await expect
      .poll(async () => Number(await svg.getAttribute('data-progress')))
      .toBeLessThan(1.95)
    // Reverse an active transition: keep the current pose, then settle at the new target.
    await dialog.locator('.renewable-stages button').nth(1).click()
    await expect(svg).toHaveAttribute('data-progress', '1.0000')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const entry = page.getByRole('button', { name: 'Explore inside', exact: true })
    await expect(entry).toBeFocused()
    await entry.click()
    await expect(plate).toHaveAttribute('data-stage', '0')
    await expect(svg).toHaveAttribute('data-progress', '0.0000')
    expect(errors).toEqual([])
  })

  test(`${kind}: mobile, reduced motion, theme and keyboard`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const dialog = await open(page, kind)
    await dialog.locator('.renewable-stages button').nth(2).focus()
    await page.keyboard.press('Enter')
    await expect(dialog.locator('.renewable-svg')).toHaveAttribute('data-progress', '2.0000')
    await dialog.getByRole('button', { name: 'Toggle explorer theme' }).click()
    await expect(dialog.locator('.renewable-explorer')).toHaveAttribute('data-theme', 'dark')
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expect(dialog.locator('.renewable-info h2')).toBeVisible()
  })
}

test('pv: a focused cell separates through intermediate poses', async ({ page }) => {
  const dialog = await open(page, 'pv')
  await dialog.locator('.renewable-stages button').nth(1).click()
  await expect(dialog.locator('.renewable-plate')).toHaveAttribute('aria-busy', 'false')
  const samples = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const layer = document.querySelector('[data-part="silicon-base"]')!
        const figure = document.querySelector('.renewable-svg')!
        const poses: string[] = []
        const start = performance.now()
        ;(document.querySelectorAll('.renewable-stages button')[2] as HTMLButtonElement).click()
        const sample = () => {
          poses.push(layer.getAttribute('transform') ?? '')
          if (figure.getAttribute('data-progress') === '2.0000' || performance.now() - start > 4000)
            resolve(poses)
          else requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      }),
  )
  expect(new Set(samples).size).toBeGreaterThan(4)
  await expect(dialog.locator('.renewable-svg')).toHaveAttribute('data-progress', '2.0000')
  await dialog.getByRole('button', { name: 'Previous level', exact: true }).click()
  await expect(dialog.locator('.renewable-svg')).toHaveAttribute('data-progress', '1.0000')
  await expect(dialog.locator('[data-part="silicon-base"]')).toHaveAttribute(
    'transform',
    'translate(0 0)',
  )
})
