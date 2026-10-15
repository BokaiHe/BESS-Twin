import { expect, test } from '@playwright/test'

test('first-visit hint is optional, remembered and starts the existing tour with focus return', async ({
  page,
}) => {
  await page.goto('/')
  const hint = page.locator('.first-visit-hint')
  const tour = page.getByRole('button', { name: 'Guided tour', exact: true })
  await expect(hint).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await hint.getByRole('button', { name: 'Explore on my own' }).click()
  await expect(tour).toBeFocused()
  await page.reload()
  await expect(tour).toBeVisible()
  await expect(hint).toHaveCount(0)
  // A new visitor can explicitly start the tour from the hint.
  await page.evaluate(() => localStorage.removeItem('bess-twin-tour-hint-seen'))
  await page.reload()
  const minute = await page.getByTestId('timeline-time').textContent()
  await hint.getByRole('button', { name: 'Start tour' }).click()
  await expect(page.getByRole('dialog')).toContainText('Meet the energy site')
  await page.keyboard.press('Escape')
  await expect(tour).toBeFocused()
  await expect(hint).toHaveCount(0)
  await expect(page.getByTestId('timeline-time')).toHaveText(minute!)
  await page.reload()
  await expect(tour).toBeVisible()
  await expect(hint).toHaveCount(0)
})

test('public context and source link remain reachable in both languages and short/narrow windows', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore on my own' }).click()
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

test('unavailable local storage does not prevent using or dismissing the hint', async ({
  page,
}) => {
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
  await page.getByRole('button', { name: 'Start tour', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.first-visit-hint')).toHaveCount(0)
  expect(errors).toEqual([])
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
