import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({
  viewport: { width: 1600, height: 1080 },
  reducedMotion: 'reduce',
})
const errors = [],
  requests = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('request', (r) => requests.push(r.url()))
page.on('requestfailed', (r) => errors.push(`${r.url()} ${r.failure()?.errorText}`))
await page.addInitScript(() => localStorage.setItem('bess-twin-tour-hint-seen', '1'))
try {
  await page.goto('http://127.0.0.1:5180/BESS-Twin/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  if (requests.some((x) => /ChallengeRunner|challengeCopy/.test(x)))
    throw Error('Challenge code loaded on startup')
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByTestId('learn-c1-cloudy-supply').click()
  await expect(page.getByTestId('challenge-goals')).toHaveAttribute('aria-busy', 'false')
  await page.getByTestId('parameter-batteryMWh').fill('30')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★★')
  await page.locator('.challenge-modal').evaluate((el) => {
    el.scrollTop = 0
  })
  await mkdir('docs/screenshots', { recursive: true })
  await page.screenshot({ path: 'docs/screenshots/learning-challenges.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('challenge-goals')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await page.getByTestId('learn-c3-spread').click()
  await expect(page.getByTestId('challenge-goals')).toHaveAttribute('aria-busy', 'false')
  await page.getByTestId('parameter-peakPrice').fill('1.4')
  await expect(page.getByTestId('challenge-stars')).toHaveText('★★★')
  await page.locator('.challenge-modal').evaluate((el) => {
    el.scrollTop = 0
  })
  expect(
    await page.locator('.challenge-modal').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  await page.screenshot({ path: 'docs/screenshots/learning-challenges-mobile-zh.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('challenge-goals')).toHaveCount(0)
  if (errors.length) throw Error(errors.join('\n'))
  await mkdir('test-results', { recursive: true })
  await writeFile(
    'test-results/challenges-preview.json',
    JSON.stringify(
      {
        initialChallengeCode: false,
        pageErrors: errors,
        paths: requests.filter((x) => /ChallengeRunner|challengeCopy/.test(x)),
        mobileWidth: 390,
      },
      null,
      2,
    ),
  )
  console.log('Pages preview: challenges lazy, engine verified, restored, Chinese mobile fits.')
} finally {
  await browser.close()
}
