import { expect, test } from '@playwright/test'
import { simulateDay } from '../src/simulation/engine'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'zh'))
})

test('desktop: data matches the engine, seek is deterministic, fault, language switch, playback', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  const sunny = simulateDay('sunny')
  await expect(page.getByTestId('kpi-renewable')).toContainText(
    sunny.frames[720].metrics.renewableMW.toFixed(1),
  )

  // Seek back and forth: values come from cached frames, never re-integrated.
  await page.getByRole('button', { name: '19:00 晚峰', exact: true }).click()
  await expect(page.getByTestId('timeline-time')).toHaveText('19:00')
  await expect(page.getByTestId('kpi-soc')).toContainText(
    sunny.frames[1140].metrics.socPct.toFixed(1),
  )
  const firstRead = await page.getByTestId('kpi-soc').textContent()
  await page.getByRole('button', { name: '12:00 午间', exact: true }).click()
  await page.getByRole('button', { name: '19:00 晚峰', exact: true }).click()
  expect(await page.getByTestId('kpi-soc').textContent()).toBe(firstRead)
  await expect(page.getByText('峰时放电').first()).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/desktop-evening.png' })

  await page.getByRole('button', { name: '12:00 午间', exact: true }).click()
  await expect(page.getByText('光伏消纳').first()).toBeVisible()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'docs/screenshots/desktop-sunny.png' })

  // Fault day jumps to 17:30 and focuses BESS-04.
  await page.getByRole('button', { name: /储能故障日/ }).click()
  await expect(page.getByTestId('timeline-time')).toHaveText('17:30')
  await expect(page.getByRole('heading', { name: '储能 BESS-04', exact: true })).toBeVisible()
  await expect(page.locator('.alarm-toast')).toContainText('过温保护离线')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'docs/screenshots/desktop-fault.png' })
  await page.getByRole('button', { name: '告警', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('BESS-04 过温保护离线')
  await page.getByRole('dialog').getByRole('button', { name: '关闭' }).click()

  // Language switch keeps the same data.
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.getByRole('button', { name: /Storage fault/ })).toBeVisible()
  await expect(page.locator('.alarm-toast')).toContainText('tripped on over-temperature')
  await page.getByRole('button', { name: '切换到中文' }).click()

  // Cloudy: the no-storage baseline cannot meet demand, so savings are not comparable.
  await page.getByRole('button', { name: /阴天风弱日/ }).click()
  await page.getByRole('button', { name: '19:00 晚峰', exact: true }).click()
  await expect(page.getByTestId('kpi-savings')).toContainText('不可比')

  // Device list → detail card.
  await page.getByRole('tab', { name: /发电/ }).click()
  await page.locator('.device-row', { hasText: '光伏电站' }).click()
  await expect(page.getByRole('heading', { name: '光伏电站', exact: true })).toBeVisible()
  await expect(page.locator('.detail')).toContainText('20 MWp / 16 MWac')

  // Chart collapse and playback.
  await page.getByRole('button', { name: '运行曲线', exact: true }).click()
  await expect(page.getByTestId('trend-chart')).toHaveCount(0)
  await page.getByRole('button', { name: '运行曲线', exact: true }).click()
  await expect(page.getByTestId('trend-chart')).toBeVisible()
  await page.getByRole('button', { name: '00:30 夜间', exact: true }).click()
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect(page.getByTestId('timeline-time')).not.toHaveText('00:30', { timeout: 4000 })
  await page.getByRole('button', { name: '暂停', exact: true }).click()

  // The explanatory tour pauses at the current minute instead of auto-playing the day.
  const tourMinute = await page.getByTestId('timeline-time').textContent()
  await page.getByRole('button', { name: '功能导览', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('认识能源园区')
  await page.getByRole('button', { name: '退出导览', exact: true }).click()
  await expect(page.getByTestId('timeline-time')).toHaveText(tourMinute!)
  expect(errors).toEqual([])
})

test('mobile: fits the viewport without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await expect(page.locator('.device-row')).toHaveCount(4)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true })
})

test('chart seeking and fault boundary preserve snapshot timing', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  const chart = page.getByTestId('trend-chart')
  const box = await chart.boundingBox()
  expect(box).not.toBeNull()
  const clickMinute = async (minute: number) => {
    await chart.click({ position: { x: 36 + ((box!.width - 72) * minute) / 1440, y: 45 } })
  }
  for (const [minute, label] of [
    [1080, '18:00'],
    [0, '00:00'],
    [1439, '23:59'],
    [720, '12:00'],
  ] as const) {
    await clickMinute(minute)
    await expect(page.getByTestId('timeline-time')).toHaveText(label)
  }
  const soc = (await page.getByTestId('kpi-soc').textContent())!
  await clickMinute(1050)
  await clickMinute(720)
  await expect(page.getByTestId('kpi-soc')).toHaveText(soc)

  await page.getByRole('button', { name: /储能故障日/ }).click()
  await expect(page.locator('.alarm-toast')).toContainText('过温保护离线')
  // Sample the visible grid curve just before/after the event, not just its source data.
  const shape = await chart.evaluate((el) => {
    const paths = Array.from(el.querySelectorAll<SVGPathElement>('path.recharts-line-curve'))
    const actual = paths.find(
      (p) => p.getAttribute('stroke') === '#3d74f6' && !p.hasAttribute('stroke-dasharray'),
    )!
    const baseline = paths.find(
      (p) => p.getAttribute('stroke') === '#3d74f6' && p.hasAttribute('stroke-dasharray'),
    )!
    const y = (path: SVGPathElement, minute: number) => {
      const start = path.getPointAtLength(0).x
      const end = path.getPointAtLength(path.getTotalLength()).x
      const x = start + ((end - start) * minute) / 1439
      let lo = 0,
        hi = path.getTotalLength()
      for (let i = 0; i < 35; i++) {
        const mid = (lo + hi) / 2
        if (path.getPointAtLength(mid).x < x) lo = mid
        else hi = mid
      }
      return path.getPointAtLength((lo + hi) / 2).y
    }
    return {
      beforeDelta: Math.abs(y(actual, 1049.5) - y(baseline, 1049.5)),
      afterDelta: Math.abs(y(actual, 1050.5) - y(baseline, 1050.5)),
    }
  })
  expect(shape.beforeDelta).toBeLessThan(0.1)
  expect(shape.afterDelta).toBeGreaterThan(1)
})

test('bill difference, fault inventory, language and mobile modal', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /阴天风弱日/ }).click()
  await page.getByRole('button', { name: '19:00 晚峰', exact: true }).click()
  await expect(page.getByTestId('kpi-savings')).toContainText('不可比')
  await page.locator('.kpi-savings').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('账单差额（不可比）')
  await expect(dialog).not.toContainText('净节省')
  await expect(page.getByTestId('savings-rate')).toHaveCount(0)
  await expect(dialog).toContainText('1.35 MWh')
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '00:30 夜间', exact: true }).click()
  await page.locator('.kpi-savings').click()
  await dialog.getByRole('button', { name: /截至当前/ }).click()
  await expect(dialog).toContainText('净节省')
  await expect(page.getByTestId('savings-rate')).toBeVisible()
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()

  await page.getByRole('button', { name: /储能故障日/ }).click()
  await page.locator('.kpi-savings').click()
  await expect(page.getByTestId('fault-energy-note')).toContainText('+3.65 MWh')
  await expect(page.getByTestId('fault-energy-note')).toContainText('冻结电量')
  await dialog.locator('summary').click()
  await expect(dialog).toContainText('晴天与阴天按周期稳态')
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await page.locator('.kpi-savings').click()
  await expect(page.getByTestId('fault-energy-note')).toContainText('not periodic')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Cloudy/ }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.kpi-savings').click()
  await expect(dialog).toContainText('Bill difference (not comparable)')
  await expect(page.getByTestId('savings-rate')).toHaveCount(0)
  await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})

test('first visit defaults to English and walkthrough explains modules without advancing time', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({
    baseURL,
    locale: 'zh-CN',
    viewport: { width: 1600, height: 1080 },
  })
  const page = await context.newPage()
  try {
    // Legacy automatic locale detection must not override the new English default.
    await page.addInitScript(() => localStorage.setItem('bess-twin-lang', 'zh'))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Guided tour', exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const minute = await page.getByTestId('timeline-time').textContent()
    await page.getByRole('button', { name: 'Guided tour', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Meet the energy site')
    await page.screenshot({ path: 'docs/screenshots/guided-tour-desktop.png' })
    await expect(dialog.getByRole('button', { name: 'Back', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(dialog).toContainText('Renewable generation')
    await dialog.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(dialog).toContainText('Meet the energy site')
    const titles = [
      'Renewable generation',
      'Battery energy storage',
      'Grid and substation',
      'Industry, homes and charging',
      'Choose a full-day scenario',
      'Read the key metrics',
      'Explore the timeline',
      'Inspect equipment details',
      'Find equipment by category',
      'Understand the bill difference',
      'Locate active alarms',
      'Set your view and explore',
    ]
    for (const title of titles) {
      await dialog.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(dialog.getByRole('heading')).toHaveText(title)
      await expect(dialog.locator('#guide-body')).not.toBeEmpty()
    }
    await expect(page.getByTestId('guide-progress')).toHaveText('13 / 13')
    await dialog.getByRole('button', { name: 'Start exploring', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('timeline-time')).toHaveText(minute!)
    await page.getByRole('button', { name: 'Guided tour', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: '切换到中文' }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: '功能导览', exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: '功能导览', exact: true }).click()
    await expect(dialog).toContainText('认识能源园区')
    await expect
      .poll(() => page.getByTestId('guide-card').evaluate((el) => el.scrollWidth <= el.clientWidth))
      .toBe(true)
    await page.screenshot({ path: 'docs/screenshots/guided-tour-mobile.png' })
    await dialog.getByRole('button', { name: '退出导览', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  } finally {
    await context.close()
  }
})
