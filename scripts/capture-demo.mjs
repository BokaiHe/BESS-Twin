import { chromium, expect } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join, dirname, basename } from 'node:path'
import { spawnSync } from 'node:child_process'

// Isolated browser storage: recording never modifies a user's open session.
// Usage: node scripts/capture-demo.mjs [local-url]
const url = new URL(process.argv[2] ?? 'http://127.0.0.1:5173/')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  throw Error('Use a local development or production-preview URL.')
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg'
if (spawnSync(ffmpeg, ['-version'], { stdio: 'ignore' }).status !== 0)
  throw Error(
    'FFmpeg is required for WebM trimming and GIF conversion. Install it or set FFMPEG_PATH.',
  )
await mkdir('docs', { recursive: true })
const temporary = await mkdtemp(join(tmpdir(), 'bess-demo-'))
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' })
let completed = false
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    recordVideo: { dir: temporary, size: { width: 1440, height: 1080 } },
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage(),
    errors = [],
    chapters = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('bess-twin-tour-hint-seen', '1'))
  await page.goto(url.href)
  await expect(page.getByTestId('kpi-soc')).toBeVisible({ timeout: 25000 })
  const start = performance.now()
  const at = async (seconds) => {
    const remaining = seconds * 1000 - (performance.now() - start)
    if (remaining > 0) await page.waitForTimeout(remaining)
  }
  const chapter = (title) =>
    chapters.push({ title, seconds: +((performance.now() - start) / 1000).toFixed(2) })
  chapter('Sunny day: read precomputed snapshots')
  await page.locator('.timeline input[type="range"]').fill('420')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await at(5)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.locator('.timeline input[type="range"]').fill('1140')
  chapter('Storage at the evening peak')
  await page.getByRole('tab', { name: /Storage/ }).click()
  await page.locator('.device-row').filter({ hasText: 'BESS-01' }).click()
  await at(8)
  chapter('Explore the container and its cell transport')
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  await expect(page.getByTestId('explorer-snapshot')).toHaveAttribute('data-mode', 'discharge')
  await at(9)
  await page
    .getByRole('group', { name: 'Viewing level' })
    .getByRole('button', { name: 'Cell layers', exact: true })
    .click()
  await page.getByRole('button', { name: 'Open cell cutaway' }).click()
  await expect(page.locator('.cell-transport')).toHaveAttribute('data-running', 'true')
  await page.locator('.cell-cutaway-svg').scrollIntoViewIfNeeded()
  await expect(page.locator('.cell-cutaway-svg')).toHaveAttribute('data-turn', '1.0000')
  chapter('Discharge flow fully visible')
  await page.waitForTimeout(2500)
  await at(20)
  await page.keyboard.press('Escape')
  chapter('Double capacity and wait for the recalculated comparison')
  await page.getByRole('button', { name: 'What if…', exact: true }).click()
  await page.getByTestId('parameter-batteryMWh').fill('40')
  await expect(page.getByTestId('study-results')).toHaveAttribute('aria-busy', 'false', {
    timeout: 25000,
  })
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-applied-capacity', '40')
  await expect(page.getByTestId('study-results')).toHaveAttribute('data-original-capacity', '20')
  await page.getByTestId('comparison-chart').scrollIntoViewIfNeeded()
  await at(30)
  if (performance.now() - start > 34000)
    throw Error('Recording exceeded its timing budget; retry on an idle machine.')
  if (errors.length) throw Error(errors.join('\n'))
  const rawVideo = await page.video().path()
  await context.close()
  const convert = (args) => {
    const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      encoding: 'utf8',
    })
    if (result.status !== 0) throw Error(result.stderr || 'FFmpeg conversion failed')
  }
  convert([
    '-sseof',
    '-30',
    '-i',
    rawVideo,
    '-t',
    '30',
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-cpu-used',
    '4',
    '-row-mt',
    '1',
    '-threads',
    '4',
    '-crf',
    '36',
    '-b:v',
    '0',
    resolve('docs/demo.webm'),
  ])
  convert([
    '-i',
    resolve('docs/demo.webm'),
    '-filter_complex',
    'fps=6,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5',
    '-loop',
    '0',
    resolve('docs/demo.gif'),
  ])
  await writeFile(
    'docs/demo-recording.json',
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        url: url.href,
        durationSeconds: 30,
        chapters,
        originalCapacityMWh: 20,
        proposedCapacityMWh: 40,
        errors,
        note: 'Chapter offsets are measured from the ready page before trimming. Actual comparison values are rendered by the app; no result text is replaced.',
      },
      null,
      2,
    ) + '\n',
  )
  completed = true
  console.log('Saved docs/demo.webm, docs/demo.gif and docs/demo-recording.json')
} finally {
  await browser.close()
  // Only remove this script's uniquely created temporary directory after success.
  if (completed) {
    if (
      dirname(resolve(temporary)) !== resolve(tmpdir()) ||
      !basename(temporary).startsWith('bess-demo-')
    )
      throw Error('Unexpected temporary recording path')
    await rm(temporary, { recursive: true })
  } else console.error(`Raw recording retained for diagnosis: ${temporary}`)
}
