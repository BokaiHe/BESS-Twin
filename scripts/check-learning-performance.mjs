import { createServer } from 'node:http'
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { resolve, sep, extname, dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'

// Compare two already-built Pages distributions on the same machine, without network noise.
// Usage: node scripts/check-learning-performance.mjs <baseline-dist> [candidate-dist]
const baseline = process.argv[2]
if (!baseline)
  throw new Error('Pass the baseline dist directory; build both versions in Pages mode first.')
const roots = { baseline: resolve(baseline), learning: resolve(process.argv[3] ?? 'dist') }
const prefix = '/BESS-Twin/'
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}
async function serve(root) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      if (!path.startsWith(prefix)) {
        res.writeHead(404).end()
        return
      }
      const file = resolve(root, path.slice(prefix.length) || 'index.html')
      if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      res.end(await readFile(file))
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  return { server, url: `http://127.0.0.1:${server.address().port}${prefix}` }
}
async function initialJs(root) {
  const html = await readFile(resolve(root, 'index.html'), 'utf8')
  const paths = [...new Set([...html.matchAll(/(?:src|href)="([^" ]+\.js)"/g)].map((m) => m[1]))]
  let gzipBytes = 0
  for (const path of paths)
    gzipBytes += gzipSync(await readFile(resolve(root, path.slice(prefix.length)))).length
  return { paths, gzipBytes }
}
const assets = {
  baseline: await initialJs(roots.baseline),
  learning: await initialJs(roots.learning),
}
const addedGzipBytes = assets.learning.gzipBytes - assets.baseline.gzipBytes
if (addedGzipBytes > 15_000) throw new Error(`Initial JS increased by ${addedGzipBytes} gzip bytes`)
const hosts = { baseline: await serve(roots.baseline), learning: await serve(roots.learning) }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const runs = []
try {
  // An unmeasured context warms the browser/GPU; measured contexts have separate caches.
  for (const [index, variant] of [
    'baseline',
    'baseline',
    'learning',
    'learning',
    'baseline',
    'baseline',
    'learning',
  ].entries()) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('bess-twin-tour-seen', '1')
      window.__learningBench = { replies: 0, canvasMs: null, dataMs: null }
      const WorkerBase = window.Worker
      window.Worker = class extends WorkerBase {
        constructor(...args) {
          super(...args)
          this.addEventListener('message', () => window.__learningBench.replies++)
        }
      }
      const observer = new MutationObserver(() => {
        const out = window.__learningBench
        if (out.canvasMs === null && document.querySelector('canvas')?.checkVisibility())
          out.canvasMs = performance.now()
        if (
          out.dataMs === null &&
          document.querySelector('[data-testid="kpi-soc"]')?.checkVisibility()
        )
          out.dataMs = performance.now()
        if (out.canvasMs !== null && out.dataMs !== null) observer.disconnect()
      })
      observer.observe(document, { childList: true, subtree: true, attributes: true })
      document.addEventListener(
        'click',
        (event) => {
          const button =
            event.target instanceof Element ? event.target.closest('.scenario-switch button') : null
          if (!button) return
          const started = performance.now()
          const observeCommit = new MutationObserver(() => {
            if (button.getAttribute('aria-pressed') === 'true') {
              window.__learningBench.lastCommitMs = performance.now() - started
              observeCommit.disconnect()
            }
          })
          observeCommit.observe(button.parentElement, { attributes: true, subtree: true })
        },
        true,
      )
    })
    await page.goto(hosts[variant].url)
    await page.locator('canvas').waitFor({ state: 'visible' })
    await page.getByTestId('kpi-soc').waitFor({ state: 'visible' })
    await page.waitForFunction(() => window.__learningBench.replies >= 3)
    const switches = {}
    for (const [key, name] of [
      ['fault', 'Storage fault'],
      ['cloudy', 'Cloudy, low wind'],
      ['sunny', 'Sunny day'],
    ]) {
      const start = performance.now()
      const button = page.getByRole('button', { name, exact: true })
      await button.click()
      await page.waitForFunction(
        (label) =>
          document.querySelector('.scenario-switch [aria-pressed="true"]')?.textContent.trim() ===
          label,
        name,
      )
      switches[key] = {
        actionMs: Math.round(performance.now() - start),
        commitMs: Math.round(await page.evaluate(() => window.__learningBench.lastCommitMs)),
      }
    }
    const metrics = await page.evaluate(() => window.__learningBench)
    if (errors.length) throw new Error(errors.join('\n'))
    if (index) {
      const run = { variant, ...metrics, switches }
      runs.push(run)
      console.log(JSON.stringify(run))
    }
    await context.close()
  }
  const report = {
    measuredAt: new Date().toISOString(),
    note: 'Edge headless, 1366x768, fresh contexts, warmed browser/GPU, local production builds. Canvas/data visibility is not a GPU frame-time measurement. Switches wait for idle prewarming.',
    assets,
    addedGzipBytes,
    runs,
  }
  const target = resolve('test-results/learning-performance.json')
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(report, null, 2) + '\n')
  console.log(`Saved ${target}; initial JS delta ${addedGzipBytes} gzip bytes`)
} finally {
  await browser.close()
  await Promise.all(
    Object.values(hosts).map(({ server }) => new Promise((done) => server.close(done))),
  )
}
