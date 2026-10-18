import { expect, test } from '@playwright/test'

const firstVisit = { storageState: { cookies: [], origins: [] } }

test.describe('first visit', () => {
  test.use(firstVisit)

  test('opens the guided tour once without advancing time', async ({ page }) => {
    await page.goto('/')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Meet the energy site')
    await expect(dialog.getByTestId('guide-progress')).toHaveText('1 / 13')
    const minute = await page.getByTestId('timeline-time').textContent()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('timeline-time')).toHaveText(minute!)
    expect(await page.evaluate(() => localStorage.getItem('bess-twin-tour-hint-seen'))).toBe('1')
    await page.reload()
    await expect(page.getByTestId('kpi-soc')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(500)
    await expect(dialog).toHaveCount(0)
    // The tour stays available from the learning centre.
    await page.getByRole('button', { name: 'Learn', exact: true }).click()
    await page.getByRole('button', { name: 'Guided tour', exact: true }).click()
    await expect(dialog).toContainText('Meet the energy site')
  })

  test('unavailable local storage still opens and closes the tour', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      for (const method of ['getItem', 'setItem'])
        Object.defineProperty(Storage.prototype, method, {
          value: () => {
            throw new DOMException('Storage disabled', 'SecurityError')
          },
        })
    })
    await page.goto('/')
    await expect(page.getByRole('dialog')).toContainText('Meet the energy site')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Learn', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
})

test('public context and source link remain reachable in both languages and short/narrow windows', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Storage fault', exact: true }).click()
  await page.getByRole('button', { name: 'Show equipment explorers' }).click()
  for (const [width, height] of [
    [1600, 1080],
    [1024, 768],
    [1366, 600],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    for (const lang of ['en', 'zh']) {
      if (lang === 'zh') await page.getByRole('button', { name: '切换到中文' }).click()
      const footer = page.getByRole('contentinfo')
      await footer.scrollIntoViewIfNeeded()
      await expect(footer).toContainText(lang === 'zh' ? '非真实项目数据' : 'Not real project data')
      const link = footer.getByRole('link')
      await expect(link).toHaveAttribute('href', 'https://github.com/BokaiHe/BESS-Twin')
      await link.click({ trial: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      expect(await footer.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      if (lang === 'zh') await page.getByRole('button', { name: 'Switch to English' }).click()
      // A language change may wrap only the absolutely positioned footer, with
      // no change to the timeline size. Its height must still reserve space.
      if (width > 900 && height > 740) {
        await expect
          .poll(async () => {
            const hub = (await page.locator('.hub-panel').boundingBox())!
            const note = (await footer.boundingBox())!
            return hub.y + hub.height <= note.y
          })
          .toBe(true)
      }
    }
  }
})

test('share metadata is in the initial HTML and the preview image is served locally', async ({
  request,
}) => {
  const response = await request.get('/')
  const html = await response.text()
  expect(html).toContain('property="og:title"')
  expect(html).toContain('property="og:type" content="website"')
  expect(html).toContain('https://bokaihe.github.io/BESS-Twin/social-preview.png')
  expect(html).toContain('name="twitter:card" content="summary_large_image"')
  const preview = await request.get('/social-preview.png')
  expect(preview.ok()).toBe(true)
  expect(preview.headers()['content-type']).toContain('image/png')
  const png = await preview.body()
  expect(png.readUInt32BE(16)).toBe(1367)
  expect(png.readUInt32BE(20)).toBe(839)
})

test('short-screen tour entry stays compact', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 600 })
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  const tour = page.getByRole('button', { name: 'Learn', exact: true })
  await expect(tour).toBeVisible()
  await expect(tour.locator('span')).toBeVisible()
  expect(await tour.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await tour.click()
  await expect(page.getByRole('dialog')).toContainText('Learning centre')
  await page.getByRole('button', { name: 'Guided tour', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Meet the energy site')
})

test('loading shows no placeholder data and commits scenario, clock and data together', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('bess-twin-tour-hint-seen', '1')
    // Hold real worker responses until each assertion explicitly releases them.
    // A fixed delay is unreliable when the GPU takes longer to initialize.
    const control = window as unknown as {
      releaseOneStudy: () => void
      releaseAllStudies: () => void
    }
    let permits = 0,
      open = false
    const pending: Array<() => void> = []
    const flush = () => {
      while (pending.length && (open || permits > 0)) {
        if (!open) permits--
        pending.shift()!()
      }
    }
    control.releaseOneStudy = () => {
      permits++
      flush()
    }
    control.releaseAllStudies = () => {
      open = true
      flush()
    }
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      set onmessage(handler: ((this: Worker, ev: MessageEvent) => unknown) | null) {
        super.onmessage = (event) => {
          pending.push(() => {
            handler?.call(this, event)
          })
          flush()
        }
      }
    }
  })
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(page.locator('.scene-boot-status')).toBeVisible()
  await expect(canvas).toHaveCount(0)
  await expect(page.getByTestId('kpi-renewable')).toHaveCount(0)
  await page.evaluate(() =>
    (window as unknown as { releaseOneStudy: () => void }).releaseOneStudy(),
  )
  await expect(canvas).toBeVisible()
  const mounted = await canvas.elementHandle()
  await expect(page.getByTestId('kpi-renewable')).toBeVisible({ timeout: 15000 })
  await page.setViewportSize({ width: 1366, height: 600 })
  const sunny = page.getByRole('button', { name: 'Sunny day', exact: true })
  const fault = page.getByRole('button', { name: 'Storage fault', exact: true })
  await fault.click()
  await expect(page.getByTestId('scene-computing')).toContainText('Storage fault')
  await expect(page.getByTestId('scene-computing')).toBeInViewport({ ratio: 1 })
  await expect(sunny).toHaveAttribute('aria-pressed', 'true')
  await expect(fault).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('timeline-time')).toHaveText('12:00')
  await page.evaluate(() =>
    (window as unknown as { releaseAllStudies: () => void }).releaseAllStudies(),
  )
  await expect(fault).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })
  await expect(page.getByTestId('timeline-time')).toHaveText('17:30')
  await expect(page.locator('.alarm-toast')).toContainText('tripped on over-temperature')
  await expect(page.getByTestId('scene-computing')).toHaveCount(0)
  expect(await canvas.evaluate((node, first) => node === first, mounted)).toBe(true)
})
