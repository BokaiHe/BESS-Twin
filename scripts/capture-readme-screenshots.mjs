// Captures the README screenshot set from a running local app (dev or preview).
// Usage: npm run readme:screenshots -- [local-url]
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const url = new URL(process.argv[2] ?? 'http://127.0.0.1:5173/')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  throw Error('Use a local development or production-preview URL.')
const OUT = 'docs/screenshots'
await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('bess-twin-tour-hint-seen', '1')
    localStorage.setItem('bess-twin-language', 'en')
  })
  const shot = async (name, locator = page) => {
    await page.waitForTimeout(1200) // let transitions and the scene settle
    await locator.screenshot({ path: `${OUT}/readme-${name}.jpg`, type: 'jpeg', quality: 86 })
    console.log(`saved ${OUT}/readme-${name}.jpg`)
  }
  const open = async () => {
    await page.goto(url.href)
    await expect(page.getByTestId('kpi-soc')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30000 })
  }
  const seek = (minute) => page.locator('.timeline input[type="range"]').fill(String(minute))

  // 1. Evening peak: storage discharging, dusk lighting.
  await open()
  await seek(1140)
  await page.locator('.scene-chip').filter({ hasText: 'BESS plant' }).click()
  await shot('evening-peak')

  // 2. Storage fault: BESS-04 trips at 17:30.
  await page.getByRole('button', { name: 'Storage fault', exact: true }).click()
  await expect(page.locator('.alarm-toast')).toBeVisible({ timeout: 30000 })
  await shot('fault')

  // 3. Guided lesson: predict before the timeline reveals the outcome.
  await open()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByTestId('learn-l3-peak').click()
  const runner = page.getByTestId('lesson-runner')
  await expect(runner).toBeVisible({ timeout: 30000 })
  for (let i = 0; i < 6 && !(await runner.getByRole('radio').count()); i++) {
    await runner.locator('button.pill-btn').last().click()
    await page.waitForTimeout(1500)
  }
  await runner.getByRole('radio').nth(1).check()
  await shot('lesson')
  await runner.locator('header button').click()
  await page.waitForTimeout(2500)

  // 4. Equipment explorer: exploded battery module with callouts.
  await open()
  await page.getByRole('tab', { name: /Storage/ }).click()
  await page.locator('.device-row').filter({ hasText: 'BESS-01' }).click()
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  const explorer = page.getByRole('dialog')
  await explorer.getByRole('button', { name: 'Remove enclosure', exact: true }).click()
  await explorer.getByRole('button', { name: 'Inspect a battery module' }).click()
  await explorer.getByRole('button', { name: 'Reveal cell layers' }).click()
  await expect(explorer.locator('.container-plate')).toHaveAttribute('data-stage', '2')
  await page.waitForTimeout(2500)
  await explorer.locator('.container-plate').scrollIntoViewIfNeeded()
  await shot('explorer')
  await page.keyboard.press('Escape')

  // 5. What if…: double storage capacity and compare with the original design.
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await page.getByTestId('parameter-batteryMWh').fill('40')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '40', {
    timeout: 30000,
  })
  await shot('what-if')
  await page.keyboard.press('Escape')

  // 6. Where the day's energy went.
  await open()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByRole('button', { name: 'View energy flows', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Where the energy goes' })).toBeVisible()
  await shot('energy-flows')
} finally {
  await browser.close()
}
