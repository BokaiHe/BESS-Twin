import { expect, test } from '@playwright/test'
import { createSimulationEngine } from '../src/simulation/engine'
import { DEFAULT_PARAMETERS } from '../src/domain/parameters'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-seen', '1'))
  await page.goto('/')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
})
async function ready(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('study-status')).toHaveText('Full-day results updated', {
    timeout: 25000,
  })
}
test('parameters update complete results, pin a reference and preserve zero-storage semantics', async ({
  page,
}) => {
  await ready(page)
  await page.getByRole('spinbutton', { name: 'Storage capacity (number)', exact: true }).fill('40')
  await page
    .getByRole('spinbutton', { name: 'Storage capacity (number)', exact: true })
    .press('Tab')
  await ready(page)
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '40')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '20')
  await expect(page.getByTestId('comparison-chart')).toHaveAttribute(
    'aria-label',
    'Stored energy (MWh)',
  )
  await page.getByRole('button', { name: 'Use proposal as original', exact: true }).click()
  await ready(page)
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '40')
  await expect(page.getByTestId('comparison-bill')).toHaveText('0.00 USD')
  await page.getByLabel('Shared scenario', { exact: true }).selectOption('cloudy')
  await page.getByRole('spinbutton', { name: 'Storage capacity (number)', exact: true }).fill('0')
  await page
    .getByRole('spinbutton', { name: 'Storage capacity (number)', exact: true })
    .press('Tab')
  await ready(page)
  await expect(page.getByTestId('comparison-status')).toContainText(
    'Different supplied energy; not directly comparable',
  )
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '0')
  // Tab after the numeric field focuses the next term: Escape closes that explanation
  // first, then a second Escape closes the enclosing parameter dialog.
  await expect(page.locator('.term-popover')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.term-popover')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('[data-term="pv-capacity"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('kpi-soc')).toHaveText('N/A')
  await expect(page.getByRole('button', { name: 'What if…', exact: true })).toBeFocused()
})
test('rapid edits settle on the latest value, with usable short and mobile layouts', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await ready(page)
  const range = page.getByTestId('parameter-batteryMWh')
  await range.focus()
  await range.press('Home')
  for (let i = 0; i < 10; i++) await range.press('ArrowRight')
  await ready(page)
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '10')
  for (const [width, height] of [
    [1366, 600],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.getByRole('button', { name: 'Reset proposal', exact: true }).click()
    await ready(page)
    await page.getByTestId('comparison-chart').scrollIntoViewIfNeeded()
    expect(await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: 'test-results/design-study-mobile.png', fullPage: true })
  expect(errors).toEqual([])
})
test('ratings, timeline and Chinese controls use the applied configuration', async ({ page }) => {
  await ready(page)
  await page.getByRole('spinbutton', { name: 'Solar DC capacity (number)', exact: true }).fill('40')
  await page
    .getByRole('spinbutton', { name: 'Solar DC capacity (number)', exact: true })
    .press('Tab')
  await ready(page)
  await expect(page.locator('.term-popover')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.term-popover')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const expected = createSimulationEngine({ ...DEFAULT_PARAMETERS, pvDCMWp: 40 })
    .simulateDay('sunny')
    .frames[720].metrics.renewableMW.toFixed(1)
  // Actual AC generation includes network curtailment once export is capped.
  await expect(page.getByTestId('kpi-renewable')).toContainText(expected)
  await page.getByRole('tab', { name: /Generation/ }).click()
  await page.locator('.device-row').filter({ hasText: 'Solar farm' }).click()
  await expect(page.locator('.detail')).toContainText('40 MWp / 32 MWac')
  await page.getByRole('button', { name: '切换到中文', exact: true }).click()
  await page.getByRole('button', { name: '如果调整参数…', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('参数与方案对比')
  await expect(
    page.getByRole('spinbutton', { name: '储能总容量 (数值)', exact: true }),
  ).toBeVisible()
})

test('comparison uses the dashboard currency and explains the daily import maximum', async ({
  page,
}) => {
  await ready(page)
  await expect(page.getByTestId('comparison-bill')).toHaveText('0.00 USD')
  await expect(page.getByTestId('original-peak-time')).toContainText('Mid-peak tariff')
  await expect(page.getByTestId('proposal-peak-time')).toContainText('Mid-peak tariff')
  await expect(page.locator('.study-peak-note')).toContainText('More storage')
  const capacity = page.getByRole('spinbutton', { name: 'Storage capacity (number)', exact: true })
  await capacity.fill('40')
  await capacity.press('Tab')
  await ready(page)
  const a = createSimulationEngine(DEFAULT_PARAMETERS).simulateDay('sunny')
  const b = createSimulationEngine({ ...DEFAULT_PARAMETERS, batteryMWh: 40 }).simulateDay('sunny')
  const cny = a.summary.costCny - b.summary.costCny
  const amount = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  await expect(page.getByTestId('comparison-bill')).toHaveText(`${amount(cny / 7.2)} USD`)
  await expect(page.locator('.term-popover')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.term-popover')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '切换到中文', exact: true }).click()
  await page.getByRole('button', { name: '如果调整参数…', exact: true }).click()
  await expect(page.getByTestId('comparison-bill')).toHaveText(`${amount(cny)} CNY`)
  await expect(page.getByTestId('proposal-peak-time')).toContainText('平时电价')
})
