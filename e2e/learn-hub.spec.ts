import { expect, test } from '@playwright/test'
const KEY = 'bess-twin-learning-v1'
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bess-twin-tour-seen', '1')
    } catch {
      /* unavailable */
    }
  })
})
test('hub is lazy, references return focus, and activity survives reload and language changes', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  expect(requests.some((url) => /LearnHub|GuidedTour|learning\/progress/.test(url))).toBe(false)
  const learn = page.getByRole('button', { name: 'Learn', exact: true })
  await learn.focus()
  await page.keyboard.press('Enter')
  const hub = page.getByRole('dialog', { name: 'Learning centre', exact: true })
  await expect(hub.getByTestId('learning-progress')).toHaveText('0 / 3')
  await expect(hub.locator('.learn-card')).toHaveCount(3)
  await hub.getByRole('button', { name: 'Energy glossary', exact: true }).click()
  const glossary = page.getByRole('dialog', { name: 'Energy glossary', exact: true })
  await glossary.getByRole('searchbox').fill('BMS')
  await expect(glossary.locator('[data-glossary-id="bms"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(hub.getByTestId('learn-glossary')).toBeFocused()
  await expect(hub.getByTestId('learn-status-glossary')).toHaveText('Viewed')
  await hub.getByRole('button', { name: 'View energy flows', exact: true }).click()
  await expect(
    page
      .getByRole('dialog', { name: 'Where the energy goes' })
      .locator('[data-flow-link="pv-batteryCharge"]'),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(hub.getByTestId('learn-flows')).toBeFocused()
  await expect(hub.getByTestId('learning-progress')).toHaveText('2 / 3')
  await page.keyboard.press('Escape')
  await expect(learn).toBeFocused()
  await page.reload()
  await learn.click()
  await expect(hub.getByTestId('learning-progress')).toHaveText('2 / 3')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await expect(page.getByTestId('learning-progress')).toHaveText('2 / 3')
  await expect(page.getByTestId('learn-status-glossary')).toHaveText('已查看')
})
test('only finishing the tour completes it; confirmed reset preserves simulation and language', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('.timeline input[type="range"]').fill('600')
  const learn = page.getByRole('button', { name: 'Learn', exact: true })
  await learn.click()
  await page.getByTestId('learn-tour').click()
  await expect(page.getByTestId('guide-progress')).toHaveText('1 / 13')
  await page.keyboard.press('Escape')
  await expect(learn).toBeFocused()
  await learn.click()
  await expect(page.getByTestId('learn-status-tour')).toHaveText('Not yet explored')
  await page.getByTestId('learn-tour').click()
  for (let i = 1; i < 13; i++) await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Start exploring', exact: true }).click()
  await expect(learn).toBeFocused()
  await expect(page.getByTestId('timeline-time')).toHaveText('10:00')
  await learn.click()
  await expect(page.getByTestId('learn-status-tour')).toHaveText('Completed')
  const reset = page.getByRole('button', { name: 'Reset learning progress', exact: true })
  await reset.click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(reset).toBeFocused()
  await expect(page.getByTestId('learning-progress')).toHaveText('1 / 3')
  await reset.click()
  await page.getByRole('button', { name: 'Clear progress', exact: true }).click()
  await expect(reset).toBeFocused()
  await expect(page.getByTestId('learning-progress')).toHaveText('0 / 3')
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('timeline-time')).toHaveText('10:00')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
test('corrupt saved progress recovers, and storage events update the open hub', async ({
  page,
  context,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{broken'), KEY)
  await page.goto('/')
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await expect(page.getByTestId('learning-progress')).toHaveText('0 / 3')
  const other = await context.newPage()
  await other.goto('/')
  await other.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ activities: { tour: 'done', glossary: 'viewed' } }),
      ),
    KEY,
  )
  await expect(page.getByTestId('learning-progress')).toHaveText('2 / 3')
  await other.evaluate((key) => localStorage.removeItem(key), KEY)
  await expect(page.getByTestId('learning-progress')).toHaveText('0 / 3')
  await other.close()
})
for (const mode of ['blocked', 'quota'] as const)
  test(`learning remains usable with ${mode} storage and retains session activity`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(
      ({ key, mode }) => {
        for (const method of (mode === 'blocked'
          ? ['getItem', 'setItem', 'removeItem']
          : ['setItem']) as ('getItem' | 'setItem' | 'removeItem')[]) {
          const original = Storage.prototype[method]
          Object.defineProperty(Storage.prototype, method, {
            value: function (this: Storage, requested: string, value?: string) {
              if (requested === key) throw new DOMException('Storage unavailable', 'SecurityError')
              return original.call(this, requested, value!)
            },
          })
        }
      },
      { key: KEY, mode },
    )
    await page.goto('/')
    const learn = page.getByRole('button', { name: 'Learn', exact: true })
    await learn.click()
    await page.getByTestId('learn-glossary').click()
    await expect(page.getByRole('searchbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toContainText('Browser storage is unavailable')
    await page.keyboard.press('Escape')
    await learn.click()
    await expect(page.getByTestId('learning-progress')).toHaveText('1 / 3')
    await page.getByRole('button', { name: 'Reset learning progress', exact: true }).click()
    await page.getByRole('button', { name: 'Clear progress', exact: true }).click()
    await expect(page.getByTestId('learning-progress')).toHaveText('0 / 3')
    expect(errors).toEqual([])
  })
test('desktop controls stay on one row; bilingual hub and focus fit short/mobile windows', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const [width, height] of [
    [1600, 1080],
    [1366, 768],
    [1024, 768],
    [1366, 600],
    [1024, 650],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    for (const zh of [false, true]) {
      if (zh) await page.getByRole('button', { name: '切换到中文' }).click()
      const learn = page.getByRole('button', { name: zh ? '学习' : 'Learn', exact: true })
      await expect(learn).toBeVisible()
      if (width > 900) {
        const tops = await page.evaluate(() =>
          ['.brand', '.scenario-switch', '.topbar-right', '.study-entry'].map(
            (selector) => document.querySelector(selector)!.getBoundingClientRect().top,
          ),
        )
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(8)
        await expect(learn.locator('span')).toBeVisible()
      }
      await learn.click()
      const hub = page.getByRole('dialog', {
        name: zh ? '学习中心' : 'Learning centre',
        exact: true,
      })
      expect(await hub.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await hub
        .getByRole('button', { name: zh ? '重置学习进度' : 'Reset learning progress', exact: true })
        .click({ trial: true })
      await page.keyboard.press('Escape')
      await expect(learn).toBeFocused()
      if (zh) await page.getByRole('button', { name: 'Switch to English' }).click()
    }
  }
})
