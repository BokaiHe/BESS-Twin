import { chromium, expect } from '@playwright/test'
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })
const requests = [],
  errors = []
page.on('request', (r) => requests.push(r.url()))
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => localStorage.setItem('bess-twin-tour-seen', '1'))
try {
  await page.goto('http://127.0.0.1:5180/BESS-Twin/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  if (requests.some((x) => /AboutProject|demo\.(gif|webm)/.test(x)))
    throw Error('Project content loaded on startup')
  await page.getByRole('button', { name: 'About the model', exact: true }).click()
  await page.getByRole('tab', { name: 'About this project' }).click()
  await expect(
    page.getByRole('heading', { name: 'Make an energy system understandable.' }),
  ).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/about-project.png' })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.getByRole('button', { name: '关于模型', exact: true }).click()
  await page.getByRole('tab', { name: '关于这个项目' }).click()
  await page.screenshot({ path: 'docs/screenshots/about-project-mobile-zh.png' })
  expect(
    await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  expect(errors).toEqual([])
  console.log(
    'Local Pages project tab: lazy loading, bilingual screenshots and no page errors verified.',
  )
} finally {
  await browser.close()
}
