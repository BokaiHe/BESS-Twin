import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-hint-seen', '1'))
})
test('project documentation is lazy, keyboard accessible and read-only, with focus return', async ({
  page,
}) => {
  const requested: string[] = []
  page.on('request', (r) => requested.push(r.url()))
  await page.goto('/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  expect(requested.some((x) => /AboutProject|projectCopy/.test(x))).toBe(false)
  await page.locator('.timeline input[type="range"]').fill('1140')
  const soc = await page.getByTestId('kpi-soc').textContent()
  const open = page.getByRole('button', { name: 'About the model', exact: true })
  await open.click()
  const assumptions = page.getByRole('tab', { name: 'Model assumptions' })
  await expect(assumptions).toHaveAttribute('aria-selected', 'true')
  await assumptions.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'About this project' })).toBeFocused()
  await expect(
    page.getByRole('heading', { name: 'Make an energy system understandable.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('list', { name: 'How the pieces connect' }).getByRole('listitem'),
  ).toHaveCount(4)
  await expect(page.getByRole('link', { name: 'View source on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/BokaiHe/BESS-Twin',
  )
  await page.keyboard.press('Home')
  await expect(assumptions).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'About this project' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(open).toBeFocused()
  await expect(page.getByTestId('timeline-time')).toHaveText('19:00')
  await expect(page.getByTestId('kpi-soc')).toHaveText(soc!)
})
test('bilingual project tabs fit mobile and short screens with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const [width, height] of [
    [1366, 600],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.getByRole('button', { name: 'About the model', exact: true }).click()
    await page.getByRole('tab', { name: 'About this project' }).click()
    await expect(page.getByRole('heading', { name: 'What this project represents' })).toBeAttached()
    expect(
      await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '切换到中文' }).click()
    await page.getByRole('button', { name: '关于模型', exact: true }).click()
    await page.getByRole('tab', { name: '关于这个项目' }).click()
    await page.getByRole('link', { name: '在 GitHub 查看源码' }).scrollIntoViewIfNeeded()
    expect(
      await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Switch to English' }).click()
  }
})
