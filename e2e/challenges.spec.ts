import { expect, test, type Page } from '@playwright/test'
async function open(page: Page, id: string) {
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByTestId(`learn-${id}`).click()
  await expect(page.getByTestId('challenge-goals')).toHaveAttribute('aria-busy', 'false')
}
async function number(page: Page, name: string, value: string) {
  const field = page.getByRole('spinbutton', { name: `${name} (number)`, exact: true })
  await field.fill(value)
  await field.blur()
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-hint-seen', '1'))
})
test('C1 locks parameters, earns stars, keeps best and resets to a failing start', async ({
  page,
}) => {
  await page.goto('/')
  await open(page, 'c1-cloudy-supply')
  await expect(page.getByTestId('challenge-success')).toHaveCount(0)
  await expect(page.getByTestId('parameter-gridImportMW')).toBeDisabled()
  await page.getByText('Advanced parameters', { exact: true }).click()
  await expect(page.getByTestId('parameter-socMinPct')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Use proposal as original' })).toHaveCount(0)
  await number(page, 'Storage capacity', '30')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★★')
  await number(page, 'Storage capacity', '40')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★☆')
  await expect(page.getByTestId('challenge-best')).toContainText('30.00 MWh · ★★★')
  await page.getByRole('button', { name: 'Reset proposal' }).click()
  await expect(page.getByTestId('challenge-goals')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByTestId('challenge-success')).toHaveCount(0)
  await expect(page.getByTestId('parameter-gridImportMW')).toHaveValue('10')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('challenge-goals')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Learn', exact: true })).toBeFocused()
  await page.reload()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await expect(page.getByTestId('learn-c1-cloudy-supply')).toContainText('30.00 MWh · ★★★')
})
test('C2 C3 C4 pass using real simulations and next-level preserves the free-mode design', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('.timeline input[type="range"]').fill('600')
  await open(page, 'c2-import-cap')
  await number(page, 'Storage power', '8')
  await number(page, 'Storage capacity', '30')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★★')
  await page.getByRole('button', { name: 'Next challenge' }).click()
  await expect(page.getByTestId('challenge-goals')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByTestId('challenge-success')).toHaveCount(0)
  await expect(page.getByTestId('parameter-batteryMWh')).toBeDisabled()
  await page.getByTestId('parameter-peakPrice').fill('1.4')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★★')
  await expect(page.getByTestId('challenge-score')).toContainText('1.05 CNY/kWh')
  await page.getByRole('button', { name: 'Next challenge' }).click()
  await expect(page.getByTestId('challenge-goals')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByTestId('challenge-success')).toHaveCount(0)
  await number(page, 'Storage capacity', '35')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★★')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('challenge-goals')).toHaveCount(0)
  await expect(page.getByTestId('timeline-time')).toHaveText('10:00')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '20')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '20')
})
test('exit restores different original and proposal, fault scene, and selected time', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await number(page, 'Storage capacity', '40')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '40')
  await page.getByRole('button', { name: 'Use proposal as original' }).click()
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '40')
  await number(page, 'Storage capacity', '30')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '30')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Storage fault', exact: true }).click()
  await expect(page.getByTestId('timeline-time')).toHaveText('17:30')
  await page.locator('.timeline input[type="range"]').fill('800')
  await open(page, 'c4-curtailment')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('challenge-goals')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Storage fault', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('timeline-time')).toHaveText('13:20')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '40')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '30')
})
test('short and mobile screens stay scrollable with Chinese copy and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 600 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await open(page, 'c1-cloudy-supply')
  await number(page, 'Storage capacity', '30')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★★')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.locator('.challenge-modal').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('challenge-goals')).toHaveCount(0)
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await page.getByTestId('learn-c3-spread').click()
  await expect(page.getByTestId('challenge-goals')).toContainText('谷价')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('challenge-goals')).toHaveCount(0)
})
test('pending and late worker results cannot grant success or overwrite restored state', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let blocked = false
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
      set onmessage(handler: ((this: Worker, e: MessageEvent) => unknown) | null) {
        super.onmessage = (e) => {
          const deliver = () => handler?.call(this, e)
          if (blocked) pending.push(deliver)
          else deliver()
        }
      }
    }
  })
  await page.goto('/')
  await open(page, 'c1-cloudy-supply')
  await number(page, 'Storage capacity', '30')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★★')
  await page.evaluate(() => (window as unknown as { blockStudies: () => void }).blockStudies())
  await number(page, 'Storage capacity', '31')
  await expect(page.getByTestId('challenge-pending')).toBeVisible()
  await expect(page.getByTestId('challenge-success')).toHaveCount(0)
  await expect(page.getByTestId('goal-supply')).toHaveAttribute('data-pass', 'false')
  await number(page, 'Storage capacity', '32')
  await page.keyboard.press('Escape')
  await page.evaluate(() => (window as unknown as { releaseStudies: () => void }).releaseStudies())
  await expect(page.getByTestId('challenge-goals')).toHaveCount(0)
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '20')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '20')
})
