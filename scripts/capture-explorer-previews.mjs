// Captures the three equipment-explorer figures as static preview images for the
// overview hub. Run after changing explorer geometry: `npm run explorers:previews`.
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const OUT = 'public/explorers'
const server = await createServer({
  server: { host: '127.0.0.1', port: 5191, strictPort: true },
  logLevel: 'error',
})
await server.listen()
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' })
try {
  await mkdir(OUT, { recursive: true })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  })
  // Reduced motion settles every disassembly immediately; English keeps selectors stable.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('bess-twin-language', 'en'))
  // Language-specific captions are hidden so one image serves both languages.
  const hideText = `.iso-plate-corner, .renewable-plate figcaption, .renewable-caption, .container-figure-heading,
    .container-figure-bottom, .module-name-legend { visibility: hidden !important; }`

  async function open(tab, row) {
    await page.goto('http://127.0.0.1:5191/')
    await page.locator('canvas').waitFor({ timeout: 60_000 })
    await page.getByRole('tab', { name: tab }).click()
    await page.locator('.device-row').filter({ hasText: row }).click()
    await page.locator('.detail button.container-entry').click()
    await page.getByRole('dialog').waitFor()
    await page.addStyleTag({ content: hideText })
  }
  async function shoot(selector, file) {
    const plate = page.getByRole('dialog').locator(selector).first()
    await plate.waitFor()
    await page.waitForTimeout(800)
    await plate.screenshot({
      path: `${OUT}/${file}`,
      type: 'jpeg',
      quality: 82,
      animations: 'disabled',
    })
    console.log(`saved ${OUT}/${file}`)
  }

  await open(/Storage/, 'BESS-01')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove enclosure', exact: true })
    .click()
  await shoot('.container-plate', 'bess.jpg')

  await open(/Generation/, 'Solar farm')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Laminate layers/ })
    .click()
  await shoot('.renewable-plate', 'pv.jpg')

  await open(/Generation/, 'WT-02')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Drivetrain/ })
    .click()
  await shoot('.renewable-plate', 'wind.jpg')
} finally {
  await browser.close()
  await server.close()
}
