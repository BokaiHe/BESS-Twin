import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ channel: 'msedge' })
const context = await browser.newContext({
  viewport: { width: 1600, height: 1080 },
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const errors = [],
  requests = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('request', (r) => requests.push(r.url()))
page.on('requestfailed', (r) => errors.push(`${r.url()} ${r.failure()?.errorText}`))
await page.addInitScript(() => localStorage.setItem('bess-twin-tour-seen', '1'))
try {
  await page.goto('http://127.0.0.1:5180/BESS-Twin/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  if (requests.some((url) => /LessonRunner|lesson-runner/.test(url)))
    throw new Error('Lesson code loaded on startup')
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByTestId('learn-l3-peak').click()
  const runner = page.getByTestId('lesson-runner')
  await expect(runner).toHaveAttribute('data-phase', 'read')
  await runner.getByRole('button', { name: 'Next', exact: true }).click()
  await runner.getByRole('radio', { name: 'Discharge', exact: true }).check()
  await runner.getByRole('button', { name: 'Play and reveal' }).click()
  await expect(page.getByTestId('lesson-reveal')).toContainText('Your prediction matches')
  await expect(page.getByTestId('timeline-time')).toHaveText('19:00')
  // Wait for camera projection to settle before recording the visual result.
  await page.waitForTimeout(1500)
  await mkdir('docs/screenshots', { recursive: true })
  await page.screenshot({ path: 'docs/screenshots/learning-lessons.png' })
  await runner.getByRole('button', { name: 'Exit lesson' }).click()
  await expect(runner).toHaveCount(0)
  await expect(page.getByTestId('timeline-time')).toHaveText('12:00')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await page.getByTestId('learn-l2-solar').click()
  await expect(runner).toHaveAttribute('data-phase', 'read')
  await runner.getByRole('button', { name: '下一步', exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(runner).toBeInViewport({ ratio: 1 })
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Horizontal overflow')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'docs/screenshots/learning-lessons-mobile-zh.png' })
  await runner.getByRole('button', { name: '退出课程' }).click()
  await expect(runner).toHaveCount(0)
  if (errors.length) throw new Error(errors.join('\n'))
  await writeFile(
    'test-results/lessons-preview.json',
    JSON.stringify(
      {
        initialLessonCode: false,
        pageErrors: errors,
        paths: requests.filter((url) => /LessonRunner|lesson-runner/.test(url)),
        restoredMinute: '12:00',
        mobileWidth: 390,
      },
      null,
      2,
    ),
  )
  console.log('Pages preview: lazy loading, reveal, restoration and Chinese mobile checks passed.')
} finally {
  await browser.close()
}
