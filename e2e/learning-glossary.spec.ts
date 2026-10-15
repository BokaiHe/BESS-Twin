import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bess-twin-tour-hint-seen', '1')
    } catch {
      /* unavailable */
    }
  })
})

test('terms load on demand, open by keyboard and restore focus with Escape', async ({ page }) => {
  const resources: string[] = []
  page.on('request', (r) => resources.push(r.url()))
  await page.goto('/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  expect(resources.some((url) => /TermPopover|GlossaryDialog|learning\/glossary/.test(url))).toBe(
    false,
  )
  const soc = page.locator('.kpi-label [data-term="soc"]')
  await soc.focus()
  await page.keyboard.press('Enter')
  const popup = page.locator('.term-popover')
  await expect(popup).toBeVisible()
  await expect(popup).toContainText('Stored energy as a fraction')
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(soc).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(popup).toBeVisible()
  await page.keyboard.press('Escape')
  await soc.click()
  await expect(popup).toBeVisible()
  await page.locator('.brand').click()
  await expect(popup).toHaveCount(0)
})

test('glossary searches both languages, follows related entries and returns to the term', async ({
  page,
}) => {
  await page.goto('/')
  const soc = page.locator('[data-term="soc"]').first()
  await soc.click()
  await page.getByRole('button', { name: 'View in glossary' }).click()
  const dialog = page.getByRole('dialog', { name: 'Energy glossary' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-glossary-id="soc"]')).toBeVisible()
  await dialog.getByRole('searchbox').fill('削峰')
  await expect(dialog.locator('[data-glossary-id="peak-shaving"]')).toBeVisible()
  await dialog.getByRole('searchbox').fill('zz-invalid')
  await expect(dialog).toContainText('No matching terms.')
  await dialog.getByRole('searchbox').fill('BMS')
  await dialog
    .locator('[data-glossary-id="bms"]')
    .getByRole('button', { name: 'Battery cell', exact: true })
    .click()
  await expect(dialog.locator('[data-glossary-id="cell"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(soc).toBeFocused()
  await expect(page.locator('.term-popover')).toHaveCount(0)
})

test('parameter explanations preserve inputs and only one popup is open inside the modal', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const capacity = page.getByTestId('parameter-batteryMWh')
  await dialog.locator('[data-term="mwh"]').click()
  await expect(page.locator('.term-popover')).toBeVisible()
  await dialog.locator('[data-term="mw"]').click()
  await expect(page.locator('.term-popover')).toHaveCount(1)
  await expect(page.locator('.term-popover')).toContainText('rate of energy transfer')
  await page.getByRole('button', { name: 'View in glossary' }).click()
  const glossary = page.getByRole('dialog', { name: 'Energy glossary' })
  await expect(glossary).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(glossary).toHaveCount(0)
  await expect(dialog.locator('[data-term="mw"]')).toBeFocused()
  await expect(capacity).toHaveValue('20')
  await expect(page.locator('.term-popover')).toHaveCount(0)
  await dialog.locator('[data-term="mw"]').press('Enter')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
})

test('phone explanations stay in view in both languages with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const lang of ['en', 'zh']) {
    if (lang === 'zh') await page.getByRole('button', { name: '切换到中文' }).click()
    await page.locator('[data-term="soc"]').first().click()
    const popup = page.locator('.term-popover')
    await expect(popup).toBeVisible()
    const box = (await popup.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(844)
    await expect(popup).toContainText(lang === 'zh' ? '当前储存电量' : 'Stored energy')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: '关于模型', exact: true }).click()
  await page.getByRole('button', { name: '能源术语表', exact: true }).click()
  await page.getByRole('searchbox').fill('削峰')
  await expect(page.locator('[data-glossary-id="peak-shaving"]')).toBeVisible()
})

test('glossary remains usable without browser storage', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    for (const name of ['getItem', 'setItem'])
      Object.defineProperty(Storage.prototype, name, {
        value: () => {
          throw new DOMException('Disabled', 'SecurityError')
        },
      })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'About the model', exact: true }).click()
  await page.getByRole('button', { name: 'Energy glossary', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Energy glossary' })
  await dialog.getByRole('searchbox').fill('PCS')
  await expect(dialog.locator('[data-glossary-id="pcs"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Energy glossary', exact: true })).toBeFocused()
  expect(errors).toEqual([])
})
