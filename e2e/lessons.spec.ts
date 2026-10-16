import { expect, test, type Page } from '@playwright/test'
const runner = (page: Page) => page.getByTestId('lesson-runner')
async function start(page: Page, id: string) {
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByTestId(`learn-${id}`).click()
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-hint-seen', '1'))
})
test('L3 wrong prediction reveals measured results, switches language and restores time', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.locator('.timeline input[type="range"]').fill('600')
  await start(page, 'l3-peak')
  await expect(runner(page)).toHaveAttribute('data-phase', 'read')
  await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
  await runner(page).getByRole('radio', { name: 'Charge', exact: true }).check()
  await page.getByRole('button', { name: '切换到中文' }).click()
  await expect(runner(page).getByRole('radio', { name: '充电', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await runner(page).getByRole('button', { name: 'Play and reveal' }).click()
  await expect(page.getByTestId('lesson-reveal')).toBeVisible({ timeout: 25000 })
  await expect(page.getByTestId('lesson-reveal')).toContainText('A different outcome')
  await expect(page.getByTestId('lesson-reveal')).toContainText('Discharge')
  await expect(page.getByTestId('timeline-time')).toHaveText('19:00')
  await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
  await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(runner(page)).toHaveAttribute('data-phase', 'summary')
  await runner(page).getByRole('button', { name: 'Finish and restore' }).click()
  await expect(runner(page)).toHaveCount(0)
  await expect(page.getByTestId('timeline-time')).toHaveText('10:00')
  await expect(page.getByRole('button', { name: 'Learn', exact: true })).toBeFocused()
  await page.reload()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await expect(page.getByTestId('learn-l3-peak')).toContainText('Completed')
  expect(errors).toEqual([])
})
test('non-default designs require confirmation; cancellation and exit restore both designs and fault time', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  const number = page.getByRole('spinbutton', { name: 'Storage capacity (number)', exact: true })
  await number.fill('40')
  await number.blur()
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '40')
  await page.getByRole('button', { name: 'Use proposal as original' }).click()
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '40')
  await number.fill('30')
  await number.blur()
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '30')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Storage fault', exact: true }).click()
  await expect(page.getByTestId('timeline-time')).toHaveText('17:30')
  await page.locator('.timeline input[type="range"]').fill('800')
  await start(page, 'l1-basics')
  await expect(runner(page)).toContainText('This lesson uses default parameters')
  await runner(page).getByRole('button', { name: 'Exit lesson' }).click()
  await expect(runner(page)).toHaveCount(0)
  await expect(page.getByTestId('timeline-time')).toHaveText('13:20')
  await start(page, 'l2-solar')
  await runner(page).getByRole('button', { name: 'Use defaults and start' }).click()
  await expect(runner(page)).toHaveAttribute('data-phase', 'read')
  await expect(page.getByRole('button', { name: 'Sunny day', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await runner(page).getByRole('button', { name: 'Exit lesson' }).click()
  await expect(runner(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Storage fault', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('timeline-time')).toHaveText('13:20')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '40')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '30')
})
test('L5 waits for matching worker data; early exit cannot be overwritten by a late result', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let blocked = true
    let first = true
    const pending: (() => void)[] = []
    Object.assign(window, {
      blockStudies: () => {
        blocked = true
      },
      releaseStudies: () => {
        blocked = false
        pending.splice(0).forEach((f) => f())
      },
    })
    const Native = window.Worker
    window.Worker = class extends Native {
      set onmessage(handler: ((this: Worker, event: MessageEvent) => unknown) | null) {
        super.onmessage = (event) => {
          const deliver = () => handler?.call(this, event)
          if (first) {
            first = false
            deliver()
          } else if (blocked) pending.push(deliver)
          else deliver()
        }
      }
    }
  })
  await page.goto('/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  await page.evaluate(() => (window as unknown as { blockStudies: () => void }).blockStudies())
  await start(page, 'l5-fault')
  await expect(runner(page)).toContainText('Preparing lesson data')
  await expect(runner(page).getByRole('radio')).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { releaseStudies: () => void }).releaseStudies())
  await expect(runner(page)).toHaveAttribute('data-phase', 'read')
  await expect(page.getByTestId('timeline-time')).toHaveText('17:00')
  await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
  await runner(page).getByRole('radio', { name: 'Higher', exact: true }).check()
  await runner(page).getByRole('button', { name: 'Play and reveal' }).click()
  await runner(page).getByRole('button', { name: 'Skip playback and reveal' }).click()
  await expect(page.getByTestId('lesson-reveal')).toContainText('7.50 MW')
  await runner(page).getByRole('button', { name: 'Exit lesson' }).click()
  await expect(runner(page)).toHaveCount(0)
  await expect(page.getByTestId('timeline-time')).toHaveText('12:00')
  await page.reload()
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  await start(page, 'l4-cloudy')
  await expect(runner(page)).toContainText('Preparing lesson data')
  await runner(page).getByRole('button', { name: 'Exit lesson' }).click()
  await page.evaluate(() => (window as unknown as { releaseStudies: () => void }).releaseStudies())
  await expect(runner(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sunny day', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('timeline-time')).toHaveText('12:00')
})
test('L1 tank and all lessons stay operable on short/mobile screens with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1366, height: 600 })
  await page.goto('/')
  await start(page, 'l1-basics')
  await expect(runner(page)).toHaveAttribute('data-phase', 'read')
  await expect(page.locator('.storage-tank[data-learning-highlight]')).toHaveCount(1)
  await expect(runner(page).getByRole('button', { name: 'Exit lesson' })).toBeInViewport({
    ratio: 1,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(runner(page)).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
  await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
  await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
  for (const prediction of [
    'Into storage',
    'Discharge',
    'Cheap energy to prepare for later demand',
    'Higher',
  ]) {
    await runner(page).getByRole('button', { name: 'Next lesson', exact: true }).click()
    await expect(runner(page)).toHaveAttribute('data-phase', 'read')
    await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
    await runner(page).getByRole('radio', { name: prediction, exact: true }).check()
    await runner(page).getByRole('button', { name: 'Play and reveal' }).click()
    await expect(page.getByTestId('lesson-reveal')).toContainText('Your prediction matches')
    await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
    await runner(page).getByRole('button', { name: 'Next', exact: true }).click()
  }
  await runner(page).getByRole('button', { name: 'Finish and restore' }).click()
  await expect(runner(page)).toHaveCount(0)
  const progress = await page.evaluate(
    () => JSON.parse(localStorage.getItem('bess-twin-learning-v1')!).lessons,
  )
  expect(Object.keys(progress)).toHaveLength(5)
})

test('exit restores the selected device, manual camera zoom, timeline speed and playback', async ({
  page,
}) => {
  await page.goto('/')
  const pv = page.locator('.scene-chip').filter({ hasText: 'Solar farm' })
  await pv.click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  // Wait for the camera easing to settle before capturing projected coordinates.
  let previous = ''
  await expect
    .poll(
      async () => {
        const box = await pv.boundingBox()
        const now = `${box?.x.toFixed(1)}:${box?.y.toFixed(1)}`
        const stable = now === previous
        previous = now
        return stable
      },
      { intervals: [500, 500, 500] },
    )
    .toBe(true)
  const anchor = pv.locator('..')
  const before = await anchor.boundingBox()
  await page.getByRole('button', { name: '60×', exact: true }).click()
  await page.locator('.timeline input[type="range"]').fill('400')
  await start(page, 'l3-peak')
  await expect(runner(page)).toHaveAttribute('data-phase', 'read')
  await runner(page).getByRole('button', { name: 'Exit lesson' }).click()
  await expect(runner(page)).toHaveCount(0)
  await expect(pv).toHaveClass(/is-selected/)
  await expect
    .poll(async () => {
      const after = await anchor.boundingBox()
      return (
        Math.abs(after!.x + after!.width / 2 - before!.x - before!.width / 2) +
        Math.abs(after!.y - before!.y)
      )
    })
    .toBeLessThan(2)
  await expect(page.getByRole('button', { name: '60×', exact: true })).toHaveClass(/is-active/)
  await expect(page.getByTestId('timeline-time')).toHaveText('06:40')
  await page.locator('.timeline .play-btn').click()
  await start(page, 'l1-basics')
  await expect(runner(page)).toHaveAttribute('data-phase', 'read')
  await runner(page).getByRole('button', { name: 'Exit lesson' }).click()
  await expect(runner(page)).toHaveCount(0)
  await expect(page.locator('.timeline .play-btn')).toHaveAttribute('aria-label', /Pause/)
  await page.locator('.timeline .play-btn').click()
})
