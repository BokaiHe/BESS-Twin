import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1600, height: 1080 } })
const errors = [],
  requests = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('request', (r) => requests.push(r.url()))
page.on('requestfailed', (r) => errors.push(`${r.url()} ${r.failure()?.errorText}`))
await page.addInitScript(() => localStorage.setItem('bess-twin-tour-hint-seen', '1'))
try {
  await page.goto('http://127.0.0.1:5180/BESS-Twin/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  if (requests.some((x) => /ContainerExplorer|RenewableExplorer|\/iso-.*\.js/.test(x)))
    throw Error('Explorers loaded on startup')
  await page.getByRole('tab', { name: /Generation/ }).click()
  await page.locator('.device-row').filter({ hasText: 'WT-03' }).click()
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  await expect(page.getByTestId('explorer-snapshot')).toHaveAttribute('data-node', 'wind-3')
  await expect(page.locator('.generation-overlay')).toHaveAttribute('data-running', 'true')
  await expect(page.locator('.renewable-info-copy')).toHaveCSS('opacity', '1')
  await mkdir('docs/screenshots', { recursive: true })
  await page.screenshot({ path: 'docs/screenshots/linked-wind.png' })
  await page.keyboard.press('Escape')
  await page.locator('.timeline input[type="range"]').fill('1140')
  await page.getByRole('tab', { name: /Storage/ }).click()
  await page.locator('.device-row').filter({ hasText: 'BESS-01' }).click()
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  await page
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await page.getByRole('button', { name: 'Open cell cutaway' }).click()
  await page.locator('.cell-cutaway-svg').scrollIntoViewIfNeeded()
  await expect(page.locator('.cell-transport')).toHaveAttribute('data-mode', 'discharge')
  await expect(page.locator('.cell-transport')).toHaveAttribute('data-running', 'true')
  await page.getByRole('dialog').evaluate((el) => {
    el.scrollTop = 0
  })
  await page.screenshot({ path: 'docs/screenshots/linked-cell.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('timeline-time')).toHaveText('19:00')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '切换到中文' }).click()
  await page.locator('.hub-badge').click()
  await page.locator('.hub-tile').nth(2).click()
  await page.locator('.renewable-icon').click()
  await expect(page.getByTestId('explorer-snapshot')).toContainText('示意转速')
  await expect(page.locator('.generation-overlay')).toHaveAttribute('data-running', 'false')
  expect(
    await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  await page.screenshot({ path: 'docs/screenshots/linked-wind-mobile-zh.png' })
  if (errors.length) throw Error(errors.join('\n'))
  await mkdir('test-results', { recursive: true })
  await writeFile(
    'test-results/linked-explorers-preview.json',
    JSON.stringify(
      {
        initialExplorerCode: false,
        errors,
        requests: requests.filter((x) =>
          /ContainerExplorer|RenewableExplorer|\/iso-.*\.js/.test(x),
        ),
      },
      null,
      2,
    ),
  )
  console.log(
    'Pages preview: selected-unit animation, lazy loading, frozen time and bilingual mobile checks passed.',
  )
} finally {
  await browser.close()
}
