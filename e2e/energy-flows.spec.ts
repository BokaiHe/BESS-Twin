import { expect, test, type Page } from '@playwright/test'
import { simulateDay } from '../src/simulation/engine'
import { energyFlows } from '../src/simulation/energyFlows'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-seen', '1'))
})
async function fromLearning(page: Page) {
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByRole('button', { name: 'View energy flows', exact: true }).click()
  return page.getByRole('dialog', { name: 'Where the energy goes', exact: true })
}
test('lazy full-day Sankey supports keyboard routes, noon scope and matching data table', async ({
  page,
}) => {
  const requests: string[] = [],
    errors: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  expect(requests.some((url) => /EnergyFlowChart|energyFlows\.ts/.test(url))).toBe(false)
  const dialog = await fromLearning(page)
  const pv = dialog.locator('[data-flow-link="pv-batteryCharge"]'),
    discharge = dialog.locator('[data-flow-link="batteryDischarge-load"]')
  await expect(pv).toBeVisible()
  await expect(discharge).toBeVisible()
  await pv.focus()
  await page.keyboard.press('Enter')
  await expect(pv).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.locator('.energy-selection')).toContainText('Solar PV → Storage charging')
  await dialog.getByText('View the energy table', { exact: true }).click()
  const full = energyFlows(simulateDay('sunny'), 0, 1440)
  const expected = full.flows
    .find((f) => f.from === 'pv' && f.to === 'batteryCharge')!
    .mwh.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  await expect(dialog.locator('[data-flow-row="pv-batteryCharge"]')).toContainText(expected)
  await dialog.getByRole('button', { name: 'Up to 12:00', exact: true }).click()
  await expect(discharge).toHaveCount(0)
  await expect(dialog.locator('[data-flow-row="batteryDischarge-load"]')).toHaveCount(0)
  await expect(dialog.getByTestId('energy-flows')).toHaveAttribute('data-end-minute', '720')
  await dialog.getByRole('button', { name: 'Full day', exact: true }).click()
  await expect(discharge).toBeVisible()
  await dialog.locator('.energy-sankey').screenshot({ path: 'test-results/energy-flows-sunny.png' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'View energy flows', exact: true })).toBeFocused()
  expect(errors).toEqual([])
})
test('bill entry inherits its window and restores focus without closing the underlying bill', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('.kpi-savings').click()
  const bill = page.getByRole('dialog')
  await bill.getByRole('button', { name: /Up to now/ }).click()
  const trigger = bill.getByRole('button', { name: 'View energy flows', exact: true })
  await trigger.click()
  const chart = page.getByRole('dialog', { name: 'Where the energy goes', exact: true })
  await expect(chart.getByTestId('energy-flows')).toHaveAttribute('data-end-minute', '720')
  await page.keyboard.press('Escape')
  await expect(chart).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(bill).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.kpi-savings')).toBeFocused()
})
test('zero storage and no supply omit phantom nodes but keep the unmet demand visible', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto('/')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  for (const key of ['batteryMW', 'batteryMWh', 'pvDCMWp', 'windMW', 'gridImportMW'])
    await page.getByTestId(`parameter-${key}`).fill('0')
  await expect(page.getByTestId('study-status')).toHaveText('Full-day results updated', {
    timeout: 25000,
  })
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '0')
  await page.keyboard.press('Escape')
  const chart = await fromLearning(page)
  await expect(chart).toContainText('No energy transferred in this interval.')
  await expect(chart.locator('[data-flow-node]')).toHaveCount(0)
  await expect(chart.getByTestId('flow-loss')).toHaveText('0.000 MWh')
  await expect(chart.getByTestId('flow-unserved')).not.toHaveText('0.000 MWh')
})
test('fault inventory and bilingual charts fit short and mobile windows with reduced motion', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Storage fault', exact: true }).click()
  await expect(page.getByTestId('timeline-time')).toHaveText('17:30')
  let chart = await fromLearning(page)
  const result = energyFlows(simulateDay('fault'), 0, 1440)
  const expected = result.storage.lossMWh.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
  await expect(chart.getByTestId('flow-loss')).toHaveText(`${expected} MWh`)
  await expect(chart.getByTestId('flow-delta')).not.toHaveText('0.000 MWh')
  for (const [width, height] of [
    [1366, 600],
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await expect.poll(() => chart.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await page.getByRole('button', { name: '查看能量去向', exact: true }).click()
  chart = page.getByRole('dialog', { name: '能量去了哪里', exact: true })
  await expect(chart).toContainText('储能库存与损耗')
  await chart.getByText('查看能量数据表', { exact: true }).click()
  await expect(chart.locator('[data-flow-row="batteryDischarge-load"]')).toContainText('储能放电')
  await chart
    .locator('.energy-sankey')
    .screenshot({ path: 'test-results/energy-flows-mobile-zh.png' })
})
test('playback completion offers a non-blocking summary once, without stealing focus', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('.timeline input[type="range"]').fill('1438')
  await page.getByRole('button', { name: '60×', exact: true }).click()
  const play = page.locator('.timeline .play-btn')
  await play.click()
  await expect(page.getByTestId('timeline-time')).toHaveText('23:59')
  const hint = page.locator('.energy-day-hint')
  await expect(hint).toBeVisible()
  await expect(play).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const trigger = hint.getByRole('button', { name: 'View energy flows', exact: true })
  await trigger.click()
  const chart = page.getByRole('dialog', { name: 'Where the energy goes', exact: true })
  await expect(chart.getByTestId('energy-flows')).toHaveAttribute('data-end-minute', '1440')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await hint.getByRole('button', { name: 'Dismiss energy summary' }).click()
  await expect(play).toBeFocused()
  await page.locator('.timeline input[type="range"]').fill('1438')
  await play.click()
  await expect(page.getByTestId('timeline-time')).toHaveText('23:59')
  await expect(hint).toHaveCount(0)
})
