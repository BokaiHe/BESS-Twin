import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-seen', '1'))
})

async function tankIsClear(page: Page) {
  await expect
    .poll(() =>
      page.getByTestId('snapshot-tank').evaluate((tank) => {
        const t = tank.getBoundingClientRect()
        const p = document.querySelector('.lesson-runner')!.getBoundingClientRect()
        const overlap = t.left < p.right && t.right > p.left && t.top < p.bottom && t.bottom > p.top
        // Include ancestor clipping, not just the element's viewport intersection.
        let unclipped = true
        for (let parent = tank.parentElement; parent; parent = parent.parentElement) {
          if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)) {
            const b = parent.getBoundingClientRect()
            if (t.top < b.top - 1 || t.bottom > b.bottom + 1) unclipped = false
          }
        }
        return t.top >= 0 && t.bottom <= innerHeight && !overlap && unclipped
      }),
    )
    .toBe(true)
}

for (const motion of ['reduce', 'no-preference'] as const) {
  test(`L1 reveals the tank without overlap and restores scrolling (${motion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: motion })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Learn', exact: true }).click()
    const before = await page.evaluate(() => scrollY)
    await page.getByTestId('learn-l1-basics').click()
    const runner = page.getByTestId('lesson-runner')
    await expect(runner).toHaveAttribute('data-phase', 'read')
    await tankIsClear(page)
    if (motion === 'reduce') await page.screenshot({ path: 'test-results/l1-mobile-fixed.png' })
    // Resize across desktop/mobile breakpoints while staying in the lesson.
    for (const [width, height] of [
      [1366, 768],
      [390, 844],
      [375, 667],
    ]) {
      await page.setViewportSize({ width, height })
      await tankIsClear(page)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await tankIsClear(page)
    // Clicking the offscreen language control scrolls away; language layout must reveal again.
    await page.getByRole('button', { name: '切换到中文' }).click()
    await tankIsClear(page)
    await runner.getByRole('button', { name: '下一步', exact: true }).click()
    await tankIsClear(page)
    await page.evaluate(() => window.scrollTo(0, 200))
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(200, 0)
    await runner.getByRole('button', { name: '退出课程' }).click()
    await expect(runner).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0)
    await page.setViewportSize({ width: 400, height: 800 })
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0)
    await expect(page.locator('[data-lesson-target]')).toHaveCount(0)
  })
}

async function interceptStudies(page: Page, mode: 'delay' | 'error') {
  await page.addInitScript((mode) => {
    let first = true,
      blocked = true
    const pending: (() => void)[] = []
    Object.assign(window, {
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
          } else if (!blocked) deliver()
          else if (mode === 'delay') pending.push(deliver)
          else
            handler?.call(
              this,
              new MessageEvent('message', {
                data: {
                  requestId: event.data.result?.requestId ?? event.data.requestId,
                  error: 'Test calculation failure',
                },
              }),
            )
        }
      }
    }
  }, mode)
}
async function release(page: Page) {
  await page.evaluate(() => (window as unknown as { releaseStudies: () => void }).releaseStudies())
}

for (const lang of ['en', 'zh'] as const) {
  for (const mode of ['delay', 'error'] as const) {
    test(`hub distinguishes ${mode} and recovers in ${lang}`, async ({ page }) => {
      await interceptStudies(page, mode)
      await page.goto('/')
      await expect(page.getByTestId('kpi-soc')).toBeVisible()
      if (lang === 'zh') await page.getByRole('button', { name: '切换到中文' }).click()
      await page
        .getByRole('button', { name: lang === 'zh' ? '储能故障日' : 'Storage fault', exact: true })
        .click()
      await page
        .getByRole('button', { name: lang === 'zh' ? '学习' : 'Learn', exact: true })
        .click()
      const status = page.getByTestId('learn-availability')
      await expect(status).toHaveCount(1)
      await expect(status).toHaveAttribute('data-state', mode === 'delay' ? 'calculating' : 'error')
      await expect(status).toContainText(
        mode === 'delay'
          ? lang === 'zh'
            ? '正在计算仿真结果'
            : 'Calculating simulation results'
          : lang === 'zh'
            ? '仿真结果加载失败'
            : 'Simulation results could not be loaded',
      )
      await expect(status).not.toContainText(
        lang === 'zh' ? '当前数据源不支持' : 'unavailable for this data source',
      )
      for (const button of await page.locator('.lesson-cards button').all())
        await expect(button).toBeDisabled()
      // Reference activities remain available while calculations are blocked.
      await expect(page.getByTestId('learn-glossary')).toBeEnabled()
      await release(page)
      if (mode === 'error')
        await status
          .getByRole('button', { name: lang === 'zh' ? '重新计算' : 'Retry calculation' })
          .click()
      await expect(status).toHaveCount(0)
      for (const button of await page.locator('.lesson-cards button').all())
        await expect(button).toBeEnabled()
    })
  }
  test(`hub explains unsupported data sources in ${lang}`, async ({ page }) => {
    // Mount the real App with its public source prop; no production test switches.
    await page.route('**/src/main.tsx', async (route) => {
      const response = await route.fetch()
      let body = await response.text()
      body = body.replace(
        /import App from ([^;]+);/,
        `import RealApp from $1;
import React from '/node_modules/.vite/deps/react.js';
import { simulationSource } from '/src/data/simulationSource.ts';
const App = () => React.createElement(RealApp, { source: simulationSource });`,
      )
      await route.fulfill({ response, body })
    })
    await page.goto('/')
    await expect(page.getByTestId('kpi-soc')).toBeVisible()
    if (lang === 'zh') await page.getByRole('button', { name: '切换到中文' }).click()
    await page.getByRole('button', { name: lang === 'zh' ? '学习' : 'Learn', exact: true }).click()
    const status = page.getByTestId('learn-availability')
    await expect(status).toHaveAttribute('data-state', 'unavailable')
    await expect(status).toContainText(
      lang === 'zh' ? '当前数据源不支持课程和挑战' : 'unavailable for this data source',
    )
    await expect(status.getByRole('button')).toHaveCount(0)
    for (const button of await page.locator('.lesson-cards button').all())
      await expect(button).toBeDisabled()
    await page.getByTestId('learn-glossary').click()
    await expect(page.getByRole('searchbox')).toBeVisible()
  })
}
