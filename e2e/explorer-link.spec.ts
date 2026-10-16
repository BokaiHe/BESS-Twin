import { expect, test, type Page } from '@playwright/test'
import { simulateDay } from '../src/simulation/engine'
const sunny = simulateDay('sunny')
async function inspect(page: Page, id: string) {
  await page.getByRole('tab', { name: id.startsWith('WT') ? /Generation/ : /Storage/ }).click()
  await page.locator('.device-row').filter({ hasText: id }).click()
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
}
async function cell(page: Page) {
  await page
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await page.getByRole('button', { name: 'Open cell cutaway' }).click()
  await page.locator('.cell-cutaway-svg').scrollIntoViewIfNeeded()
  await expect(page.locator('.cell-transport')).toBeVisible()
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-hint-seen', '1'))
})
test('wind uses the selected unit output/rating and real animation rate; reopen refreshes the fixed snapshot', async ({
  page,
}) => {
  await page.goto('/')
  for (const minute of [720, 1140]) {
    await page.locator('.timeline input[type="range"]').fill(String(minute))
    await inspect(page, 'WT-03')
    const state = page.getByTestId('explorer-snapshot'),
      overlay = page.locator('.generation-overlay')
    const ratio = sunny.frames[minute].nodes['wind-3'].injectionMW / 4
    await expect(state).toHaveAttribute('data-node', 'wind-3')
    await expect(state).toHaveAttribute('data-minute', String(minute))
    expect(Number(await state.getAttribute('data-ratio'))).toBeCloseTo(ratio, 9)
    await expect(state).toContainText('Schematic speed')
    await page.locator('.renewable-svg').scrollIntoViewIfNeeded()
    await expect(overlay).toHaveAttribute('data-running', 'true')
    const rate = await overlay.evaluate(async (el) => {
      const start = performance.now(),
        angle = Number(el.getAttribute('data-clock'))
      await new Promise((r) => setTimeout(r, 600))
      return (Number(el.getAttribute('data-clock')) - angle) / ((performance.now() - start) / 1000)
    })
    expect(rate).toBeGreaterThan(ratio * 0.5)
    expect(rate).toBeLessThan(ratio * 1.3)
    await expect(state).toHaveAttribute('data-minute', String(minute))
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.timeline input[type="range"]')).toHaveValue(String(minute))
  }
})
test('zero wind installation stops rotation and hub explicitly uses WT-01', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await page.getByTestId('parameter-windMW').fill('0')
  await expect(page.getByTestId('study-results')).toHaveAttribute('aria-busy', 'false')
  await page.keyboard.press('Escape')
  await page.locator('.hub-badge').click()
  await page.locator('.hub-tile').nth(2).click()
  await expect(page.getByTestId('explorer-snapshot')).toHaveAttribute('data-node', 'wind-1')
  await expect(page.getByTestId('explorer-snapshot')).toContainText('Rated power: 0.00 MW')
  const overlay = page.locator('.generation-overlay')
  await page.locator('.renewable-svg').scrollIntoViewIfNeeded()
  await expect(overlay).toHaveAttribute('data-speed-ratio', '0')
  await expect(overlay).toHaveAttribute('data-running', 'false')
  const phase = await overlay.getAttribute('data-clock')
  await page.waitForTimeout(250)
  await expect(overlay).toHaveAttribute('data-clock', phase!)
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled()
})
test('cell defaults follow charging, discharging and idle; manual directions never change the snapshot', async ({
  page,
}) => {
  await page.goto('/')
  for (const mode of ['charge', 'discharge', 'idle'] as const) {
    const minute = sunny.frames.find((f) =>
      mode === 'charge'
        ? f.nodes['bess-2'].injectionMW < -0.01
        : mode === 'discharge'
          ? f.nodes['bess-2'].injectionMW > 0.01
          : Math.abs(f.nodes['bess-2'].injectionMW) < 1e-6,
    )!.minute
    await page.locator('.timeline input[type="range"]').fill(String(minute))
    await inspect(page, 'BESS-02')
    await cell(page)
    const flow = page.locator('.cell-transport'),
      state = page.getByTestId('explorer-snapshot')
    await expect(state).toHaveAttribute('data-node', 'bess-2')
    await expect(state).toHaveAttribute('data-mode', mode)
    await expect(flow).toHaveAttribute('data-mode', mode)
    await expect(flow).toHaveAttribute('data-running', String(mode !== 'idle'))
    if (mode === 'idle') {
      await expect(flow.locator('.cell-flow-arrow')).toHaveCount(0)
      const phase = await flow.getAttribute('data-phase')
      await page.waitForTimeout(200)
      await expect(flow).toHaveAttribute('data-phase', phase!)
      await page.getByRole('button', { name: 'Charge', exact: true }).click()
      await expect(state).toHaveAttribute('data-manual', 'true')
      await expect(flow).toHaveAttribute('data-mode', 'charge')
      await expect(state).toHaveAttribute('data-mode', 'idle')
      await page.getByRole('button', { name: 'Follow snapshot', exact: true }).click()
      await expect(flow).toHaveAttribute('data-mode', 'idle')
      await expect(state).toHaveAttribute('data-manual', 'false')
    }
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.timeline input[type="range"]')).toHaveValue(String(minute))
  }
})
test('faulted BESS-04 is static while BESS-01 discharges; hub uses its named representative', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Storage fault', exact: true }).click()
  await expect(page.getByTestId('timeline-time')).toHaveText('17:30')
  await page.locator('.timeline input[type="range"]').fill('1140')
  await inspect(page, 'BESS-04')
  await cell(page)
  await expect(page.getByTestId('explorer-snapshot')).toHaveAttribute('data-mode', 'offline')
  await expect(page.locator('.cell-transport')).toHaveAttribute('data-mode', 'idle')
  await expect(page.locator('.cell-transport')).toHaveAttribute('data-running', 'false')
  await page.keyboard.press('Escape')
  await page.locator('.hub-badge').click()
  await page.locator('.hub-tile').nth(0).click()
  await expect(page.getByTestId('explorer-snapshot')).toHaveAttribute('data-node', 'bess-1')
  await expect(page.getByTestId('explorer-snapshot')).toHaveAttribute('data-mode', 'discharge')
})
test('Chinese mobile snapshot stays legible in dark theme and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.locator('.hub-badge').click()
  await page.locator('.hub-tile').nth(2).click()
  await expect(page.getByTestId('explorer-snapshot')).toContainText('示意转速')
  await expect(page.getByTestId('explorer-snapshot')).toContainText('仿真快照')
  await page.locator('.renewable-icon').click()
  await page.locator('.renewable-svg').scrollIntoViewIfNeeded()
  await expect(page.locator('.generation-overlay')).toHaveAttribute('data-running', 'false')
  expect(
    await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
})
