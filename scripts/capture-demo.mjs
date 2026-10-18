import { chromium, expect } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname, basename } from 'node:path'
import { spawnSync } from 'node:child_process'

// High-frame-rate demo recorder.
// Frames come from the Chrome DevTools screencast (one JPEG per composited frame, each with
// its own timestamp) instead of Playwright's fixed 25 fps recorder. FFmpeg then rebuilds a
// constant-rate video from those timestamps, so motion keeps real timing at 60 fps.
//
// Usage: npm run demo:record -- [local-url]
// Environment: FFMPEG_PATH, PLAYWRIGHT_CHANNEL (default msedge), DEMO_HEADLESS=1 to hide the
// browser window (headed mode renders faster; keep its window uncovered while recording).
const url = new URL(process.argv[2] ?? 'http://127.0.0.1:5173/')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  throw Error('Use a local development or production-preview URL.')
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg'
if (spawnSync(ffmpeg, ['-version'], { stdio: 'ignore' }).status !== 0)
  throw Error('FFmpeg is required to assemble the recording. Install it or set FFMPEG_PATH.')

const VIEWPORT = { width: 1440, height: 1080 }
const VIDEO_FPS = 60
const PREVIEW_FPS = 30 // animated WebP in the README
const PREVIEW_WIDTH = 960
const DURATION = 30

await mkdir('docs', { recursive: true })
const temporary = await mkdtemp(join(tmpdir(), 'bess-demo-'))
const headless = process.env.DEMO_HEADLESS === '1'
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
  headless,
  args: [
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    // A partly covered recording window must not be throttled.
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    ...(headless ? [] : ['--window-position=0,0']),
  ],
})
let completed = false
try {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage(),
    errors = [],
    chapters = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    localStorage.setItem('bess-twin-tour-hint-seen', '1')
    localStorage.setItem('bess-twin-language', 'en')
  })
  await page.goto(url.href)
  await expect(page.getByTestId('kpi-soc')).toBeVisible({ timeout: 25000 })
  // The dashboard can arrive before the separately loaded 3D scene.
  await expect(page.locator('canvas')).toBeVisible({ timeout: 25000 })
  await expect(page.locator('.scene-chip').first()).toBeVisible({ timeout: 25000 })
  await page.waitForTimeout(1000) // let the scene fade-in finish before frame 0

  // ---- screencast capture -------------------------------------------------------------
  const cdp = await context.newCDPSession(page)
  const frames = [] // { file, t } — t in seconds from the screencast clock
  const pending = []
  let capturing = true
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    // Acknowledge first so the browser keeps producing frames at full rate.
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    if (!capturing) return
    const file = join(temporary, `f${String(frames.length).padStart(6, '0')}.jpg`)
    frames.push({ file, t: metadata.timestamp })
    pending.push(
      new Promise((done, fail) => {
        const out = createWriteStream(file)
        out.on('finish', done).on('error', fail)
        out.end(Buffer.from(data, 'base64'))
      }),
    )
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: 1,
  })

  // ---- storyboard (see docs/demo-storyboard.md) ---------------------------------------
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
  await at(DURATION)
  if (performance.now() - start > (DURATION + 4) * 1000)
    throw Error('Recording exceeded its timing budget; retry on an idle machine.')
  if (errors.length) throw Error(errors.join('\n'))

  capturing = false
  await cdp.send('Page.stopScreencast')
  await Promise.all(pending)
  await context.close()
  if (frames.length < DURATION * 10)
    throw Error(`Only ${frames.length} frames captured; the browser was probably throttled.`)

  // ---- assemble ------------------------------------------------------------------------
  // Each frame is shown until the next one arrived; static moments produce no frames, so
  // their duration is carried by the previous frame. The result is trimmed to DURATION.
  const t0 = frames[0].t
  const lines = ['ffconcat version 1.0']
  for (let i = 0; i < frames.length; i++) {
    const next = i + 1 < frames.length ? frames[i + 1].t : frames[i].t + 1 / VIDEO_FPS
    lines.push(`file '${frames[i].file.replaceAll('\\', '/')}'`)
    lines.push(`duration ${Math.max(0.001, next - frames[i].t).toFixed(6)}`)
  }
  lines.push(`file '${frames.at(-1).file.replaceAll('\\', '/')}'`) // concat demuxer quirk
  const list = join(temporary, 'frames.ffconcat')
  await writeFile(list, lines.join('\n') + '\n')
  const capturedSeconds = frames.at(-1).t - t0
  const convert = (args) => {
    const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      encoding: 'utf8',
    })
    if (result.status !== 0) throw Error(result.stderr || 'FFmpeg conversion failed')
  }
  const source = ['-f', 'concat', '-safe', '0', '-i', list]
  const constantRate = `fps=${VIDEO_FPS},format=yuv420p`
  convert([
    ...source,
    '-t',
    String(DURATION),
    '-vf',
    constantRate,
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-crf',
    '28',
    '-b:v',
    '0',
    '-row-mt',
    '1',
    '-cpu-used',
    '3',
    '-threads',
    '8',
    resolve('docs/demo.webm'),
  ])
  convert([
    ...source,
    '-t',
    String(DURATION),
    '-vf',
    constantRate,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    resolve('docs/demo.mp4'),
  ])
  // README preview: smaller animated WebP. GIF cannot show frame delays under 20 ms
  // reliably and is several times larger at the same quality.
  convert([
    '-i',
    resolve('docs/demo.mp4'),
    '-vf',
    `fps=${PREVIEW_FPS},scale=${PREVIEW_WIDTH}:-2:flags=lanczos`,
    '-an',
    '-c:v',
    'libwebp_anim',
    '-quality',
    '72',
    '-compression_level',
    '6',
    '-loop',
    '0',
    resolve('docs/demo.webp'),
  ])
  await writeFile(
    'docs/demo-recording.json',
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        url: url.href,
        durationSeconds: DURATION,
        capture: {
          method: 'Chrome DevTools screencast (timestamped frames)',
          headless,
          frames: frames.length,
          capturedSeconds: +capturedSeconds.toFixed(2),
          averageCaptureFps: +(frames.length / capturedSeconds).toFixed(1),
        },
        outputs: {
          'docs/demo.webm': `${VIDEO_FPS} fps VP9, ${VIEWPORT.width}×${VIEWPORT.height}`,
          'docs/demo.mp4': `${VIDEO_FPS} fps H.264, ${VIEWPORT.width}×${VIEWPORT.height}`,
          'docs/demo.webp': `${PREVIEW_FPS} fps animated WebP, ${PREVIEW_WIDTH} px wide`,
        },
        chapters,
        originalCapacityMWh: 20,
        proposedCapacityMWh: 40,
        errors,
        note: 'Chapter offsets are measured from the start of capture. Actual comparison values are rendered by the app; no result text is replaced.',
      },
      null,
      2,
    ) + '\n',
  )
  completed = true
  console.log(
    `Captured ${frames.length} frames over ${capturedSeconds.toFixed(1)} s ` +
      `(${(frames.length / capturedSeconds).toFixed(1)} fps average).`,
  )
  console.log('Saved docs/demo.webm, docs/demo.mp4, docs/demo.webp and docs/demo-recording.json')
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
  } else console.error(`Frames retained for diagnosis: ${temporary}`)
}
