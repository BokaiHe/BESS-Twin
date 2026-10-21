import { expect, test, type Page } from '@playwright/test'
import { simulateDay } from '../src/simulation/engine'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-seen', '1'))
})
async function openTank(page: Page) {
  await page.goto('/')
  await page.locator('.scene-chip').filter({ hasText: 'BESS plant' }).click()
  await expect(page.getByTestId('snapshot-tank')).toBeVisible()
}
async function seek(page: Page, minute: number) {
  const range = page.locator('.timeline input[type="range"]')
  await range.fill(String(minute))
}

test('tank is lazy, follows snapshot levels and flow, and never integrates on seek', async ({
  page,
}) => {
  test.setTimeout(120000)
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  expect(requests.some((url) => /\/StorageTank[.-]/.test(url))).toBe(false)
  await page.locator('.scene-chip').filter({ hasText: 'BESS plant' }).click()
  const tank = page.getByTestId('snapshot-tank')
  await expect(tank).toBeVisible()
  const day = simulateDay('sunny')
  let firstLevel: string | null = null
  for (const minute of [600, 1140, 720, 600]) {
    await seek(page, minute)
    const m = day.frames[minute].metrics
    const direction =
      m.batteryChargeMW > 1e-6 ? 'charging' : m.batteryDischargeMW > 1e-6 ? 'discharging' : 'idle'
    await expect(tank).toHaveAttribute('data-direction', direction)
    await expect
      .poll(async () => Number(await tank.getByTestId('tank-water').getAttribute('data-level')))
      .toBeCloseTo(m.storedMWh / day.parameters.batteryMWh, 12)
    if (minute === 600) {
      const level = await tank.getByTestId('tank-water').getAttribute('data-level')
      if (firstLevel !== null) expect(level).toBe(firstLevel)
      else firstLevel = level
    }
    await expect(tank.getByTestId('tank-arrow')).toBeVisible()
    if (direction !== 'idle') {
      const flow = tank.locator('.tank-flow')
      await expect(flow).toHaveCSS(
        'animation-direction',
        direction === 'charging' ? 'reverse' : 'normal',
      )
    }
  }
  const before = await tank.getByTestId('tank-water').getAttribute('data-level')
  const flow = tank.locator('.tank-flow')
  const offset = await flow.evaluate((e) => getComputedStyle(e).strokeDashoffset)
  await expect
    .poll(() => flow.evaluate((e) => getComputedStyle(e).strokeDashoffset))
    .not.toBe(offset)
  await tank.getByRole('button', { name: 'Pause water animation' }).click()
  await expect(flow).toHaveCSS('animation-play-state', 'paused')
  await expect(tank.getByTestId('tank-water')).toHaveAttribute('data-level', before!)
  await tank.getByRole('button', { name: 'Resume water animation' }).click()
  await expect(flow).toHaveCSS('animation-play-state', 'running')
  await tank.screenshot({ path: 'test-results/storage-tank-detail.png' })
})

test('draft widens immediately while worker replies are held; power and capacity stay independent', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const control = window as unknown as {
      holdTankReplies: boolean
      releaseTankReplies: () => void
    }
    control.holdTankReplies = false
    const pending: Array<() => void> = []
    control.releaseTankReplies = () => {
      control.holdTankReplies = false
      pending.splice(0).forEach((fn) => fn())
    }
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      set onmessage(handler: ((this: Worker, ev: MessageEvent) => unknown) | null) {
        super.onmessage = (event) => {
          const deliver = () => handler?.call(this, event)
          if (control.holdTankReplies) pending.push(deliver)
          else deliver()
        }
      }
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await expect(page.getByTestId('study-status')).toHaveText('Full-day results updated')
  const tank = page.getByTestId('draft-tank')
  const outline = tank.getByTestId('tank-outline'),
    pipe = tank.getByTestId('tank-pipe')
  const initialWidth = Number(await outline.getAttribute('width')),
    initialPipe = await pipe.getAttribute('stroke-width')
  await page.evaluate(() => {
    ;(window as unknown as { holdTankReplies: boolean }).holdTankReplies = true
  })
  await page.getByTestId('parameter-batteryMWh').fill('40')
  await expect
    .poll(async () => Number(await outline.getAttribute('width')))
    .toBeGreaterThan(initialWidth)
  await expect(pipe).toHaveAttribute('stroke-width', initialPipe!)
  await expect(tank.getByTestId('tank-original-outline')).toHaveAttribute(
    'width',
    String(initialWidth),
  )
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '20')
  await expect(tank.getByTestId('tank-water')).toHaveCount(0)
  await expect(tank).toContainText('Capacity preview · no simulated water level')
  await expect(tank).toContainText('40 MWh ÷ 10 MW = 4 h')
  await page.getByTestId('parameter-batteryMW').fill('20')
  await expect(pipe).toHaveAttribute('stroke-width', String(Number(initialPipe) * 2))
  await expect(tank).toContainText('40 MWh ÷ 20 MW = 2 h')
  await tank.screenshot({ path: 'test-results/storage-tank-preview.png' })
  await page.getByTestId('parameter-batteryMW').fill('0')
  await expect(tank).toContainText('Cannot charge or discharge')
  await expect(tank.getByTestId('tank-valve')).toBeVisible()
  await page.getByTestId('parameter-batteryMWh').fill('0')
  await expect(tank.getByTestId('tank-state')).toHaveText('No storage tank')
  await expect(tank.getByTestId('tank-outline')).toHaveCount(0)
  await page.evaluate(() =>
    (window as unknown as { releaseTankReplies: () => void }).releaseTankReplies(),
  )
  await expect(page.getByTestId('study-status')).toHaveText('Full-day results updated', {
    timeout: 25000,
  })
})

test('reduced motion retains static level and direction, with bilingual mobile layouts', async ({
  page,
}) => {
  test.setTimeout(120000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openTank(page)
  await seek(page, 1140)
  const tank = page.getByTestId('snapshot-tank')
  await expect(tank.locator('.tank-flow')).toHaveCSS('animation-name', 'none')
  await expect(tank.locator('.tank-surface')).toHaveCSS('animation-name', 'none')
  await expect(tank.getByTestId('tank-arrow')).toBeVisible()
  await expect(tank.getByTestId('tank-water')).toBeVisible()
  await expect(tank.getByRole('button', { name: 'Pause water animation' })).toBeHidden()
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 600 })
    await tank.scrollIntoViewIfNeeded()
    const box = (await tank.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: '切换到中文' }).click()
  await expect(tank).toContainText('放电 · 水流出箱外')
  await tank.getByText('如何理解这个类比', { exact: true }).click()
  await expect(tank).toContainText('动画本身不会累加或减少仿真电量')
  await tank.screenshot({ path: 'test-results/storage-tank-mobile-zh.png' })
  await page.getByRole('button', { name: '如果调整参数…', exact: true }).click()
  const draft = page.getByTestId('draft-tank')
  await expect(draft).toContainText('容量预览 · 尚无仿真水位')
  expect(await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
})
