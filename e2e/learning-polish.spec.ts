import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-seen', '1'))
})

test('overall progress combines references, lessons and challenges and resets all three', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'bess-twin-learning-v1',
      JSON.stringify({
        activities: { tour: 'done', glossary: 'viewed' },
        lessons: { 'l1-basics': 'done', 'l3-peak': 'done' },
        challenges: { 'c1-cloudy-supply': { best: 5, stars: 2 } },
      }),
    ),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await expect(page.getByTestId('learning-total')).toHaveText('Overall 5 / 12')
  await expect(page.getByTestId('learning-progress')).toHaveText('2 / 3')
  await expect(page.locator('.learn-progress progress')).toHaveAttribute('value', '5')
  await expect(page.locator('.learn-progress progress')).toHaveAttribute('max', '12')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await expect(page.getByTestId('learning-total')).toHaveText('总进度 5 / 12')
  await page.getByRole('button', { name: '重置学习进度', exact: true }).click()
  await page.getByRole('button', { name: '清除进度', exact: true }).click()
  await expect(page.getByTestId('learning-total')).toHaveText('总进度 0 / 12')
})

test('failed scene preload before data is handled and the dashboard stays usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { preloadRejections: [] as string[] })
    window.addEventListener('unhandledrejection', (e) =>
      (window as unknown as { preloadRejections: string[] }).preloadRejections.push(
        String(e.reason),
      ),
    )
    const Native = window.Worker
    window.Worker = class extends Native {
      set onmessage(handler: ((this: Worker, event: MessageEvent) => unknown) | null) {
        super.onmessage = (event) => setTimeout(() => handler?.call(this, event), 1500)
      }
    }
  })
  await page.route('**/components/EnergyScene.tsx*', (route) => route.abort())
  await page.goto('/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.scene-fallback')).toBeVisible()
  expect(
    await page.evaluate(
      () => (window as unknown as { preloadRejections: string[] }).preloadRejections,
    ),
  ).toEqual([])
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await expect(page.getByTestId('learning-total')).toBeVisible()
})

for (const lang of ['en', 'zh'] as const) {
  test(`energy accounting failure stays inside its modal and allows recovery (${lang})`, async ({
    page,
  }) => {
    await page.addInitScript(() => Object.assign(window, { failFlowAccounting: true }))
    await page.route('**/simulation/energyFlows.ts*', async (route) => {
      const response = await route.fetch()
      const body = (await response.text()).replace(
        /function energyFlows\(([^)]*)\)\s*\{/,
        'function energyFlows($1) { if (window.failFlowAccounting) throw new Error("Test accounting failure");',
      )
      await route.fulfill({ response, body })
    })
    await page.goto('/')
    if (lang === 'zh') await page.getByRole('button', { name: '切换到中文' }).click()
    await page.getByRole('button', { name: lang === 'zh' ? '学习' : 'Learn', exact: true }).click()
    await page.getByTestId('learn-flows').click()
    await expect(page.getByTestId('flows-unavailable')).toContainText(
      lang === 'zh' ? '无法生成能量去向图' : 'cannot be built',
    )
    await expect(page.getByTestId('kpi-soc')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('learn-flows')).toBeFocused()
    await page.evaluate(() => Object.assign(window, { failFlowAccounting: false }))
    await page.getByTestId('learn-flows').click()
    await expect(page.getByTestId('energy-flows')).toBeVisible()
    await expect(page.getByTestId('flows-unavailable')).toHaveCount(0)
  })
}
