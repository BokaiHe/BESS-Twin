import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const report = { at: new Date().toISOString(), numerical: [], ui: [] }
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
})
try {
  const { createSimulationEngine } = await server.ssrLoadModule('/src/simulation/engine.ts')
  const { DEFAULT_PARAMETERS } = await server.ssrLoadModule('/src/domain/parameters.ts')
  const { energyFlows } = await server.ssrLoadModule('/src/simulation/energyFlows.ts')
  const { GLOSSARY } = await server.ssrLoadModule('/src/learning/glossary.ts')
  report.glossary = {
    count: GLOSSARY.length,
    longShortDefinitions: GLOSSARY.filter(
      (e) =>
        e.short.en.trim().split(/\s+/).length > 25 ||
        (e.short.zh.match(/\p{Script=Han}/gu) ?? []).length > 40,
    ).map((e) => e.id),
  }
  const cases = [
    {},
    { batteryMW: 0, batteryMWh: 0 },
    { batteryMW: 0, batteryMWh: 80 },
    { batteryMW: 20, batteryMWh: 1 },
    { batteryMW: 20, batteryMWh: 80 },
    { gridImportMW: 0, gridExportMW: 0, pvDCMWp: 0, windMW: 0 },
    { pvDCMWp: 80, windMW: 60, gridExportMW: 0 },
    { gridImportMW: 2 },
    { socMinPct: 0, socMaxPct: 100, chargeEfficiencyPct: 100, dischargeEfficiencyPct: 100 },
    { socMinPct: 40, socMaxPct: 60, chargeEfficiencyPct: 80, dischargeEfficiencyPct: 80 },
  ]
  for (const patch of cases) {
    const engine = createSimulationEngine({ ...DEFAULT_PARAMETERS, ...patch })
    for (const scenario of ['sunny', 'cloudy', 'fault']) {
      try {
        const day = engine.simulateDay(scenario)
        let worst = 0
        for (const [a, b] of [
          [0, 0],
          [0, 1],
          [0, 720],
          [720, 1050],
          [1050, 1061],
          [1061, 1440],
          [0, 1440],
        ]) {
          const r = energyFlows(day, a, b)
          const sum = (xs) => xs.reduce((x, y) => x + y, 0)
          const differences = [
            Math.abs(sum(Object.values(r.sources)) - sum(Object.values(r.sinks))),
            Math.abs(sum(r.flows.map((f) => f.mwh)) - sum(Object.values(r.sources))),
          ]
          for (const [key, value] of Object.entries(r.sources))
            differences.push(
              Math.abs(sum(r.flows.filter((f) => f.from === key).map((f) => f.mwh)) - value),
            )
          for (const [key, value] of Object.entries(r.sinks))
            differences.push(
              Math.abs(sum(r.flows.filter((f) => f.to === key).map((f) => f.mwh)) - value),
            )
          if (a === 0 && b === 1440)
            differences.push(
              Math.abs(r.sources.gridImport - day.summary.importMWh),
              Math.abs(r.sinks.gridExport - day.summary.exportMWh),
            )
          worst = Math.max(worst, ...differences)
          if (worst > 1e-6 || r.storage.lossMWh < 0) throw Error('Accounting mismatch')
        }
        report.numerical.push({
          patch,
          scenario,
          solver: day.diagnostics.solver.status,
          worstMWh: worst,
        })
      } catch (e) {
        report.numerical.push({ patch, scenario, error: String(e) })
      }
    }
  }
} finally {
  await server.close()
}
const browser = await chromium.launch({ channel: 'msedge' })
await mkdir('test-results/learning-audit', { recursive: true })
try {
  for (const [width, height] of [
    [390, 844],
    [1024, 768],
    [1366, 768],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.setItem('bess-twin-tour-seen', '1'))
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('http://127.0.0.1:5180/BESS-Twin/')
    await page.getByRole('button', { name: 'Learn', exact: true }).click()
    await page.getByTestId('learn-l1-basics').click()
    await expect(page.getByTestId('lesson-runner')).toHaveAttribute('data-phase', 'read')
    await expect(page.getByTestId('snapshot-tank')).toBeAttached()
    const bounds = async () =>
      page.evaluate(() => {
        const target = document.querySelector('[data-testid="snapshot-tank"]'),
          panel = document.querySelector('.lesson-runner')
        const r = target.getBoundingClientRect(),
          p = panel.getBoundingClientRect()
        const visibleHeight = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top))
        const overlapHeight = Math.max(0, Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top))
        const overlapWidth = Math.max(0, Math.min(r.right, p.right) - Math.max(r.left, p.left))
        return {
          target: r.toJSON(),
          panel: p.toJSON(),
          viewport: [innerWidth, innerHeight],
          visibleHeight,
          overlapArea: overlapHeight * overlapWidth,
          scrollY,
        }
      })
    const initial = await bounds()
    await page.screenshot({ path: `test-results/learning-audit/l1-${width}-initial.png` })
    await page.getByTestId('snapshot-tank').scrollIntoViewIfNeeded()
    const scrolled = await bounds()
    await page.screenshot({ path: `test-results/learning-audit/l1-${width}-scrolled.png` })
    await page.getByTestId('lesson-runner').getByRole('button', { name: 'Exit lesson' }).click()
    await expect(page.getByTestId('lesson-runner')).toHaveCount(0)
    report.ui.push({ width, height, initial, scrolled, errors })
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await page.addInitScript(() => {
    localStorage.setItem('bess-twin-tour-seen', '1')
    let first = true,
      blocked = true
    const pending = []
    window.releaseAudit = () => {
      blocked = false
      pending.splice(0).forEach((f) => f())
    }
    const Native = window.Worker
    window.Worker = class extends Native {
      set onmessage(handler) {
        super.onmessage = (event) => {
          const deliver = () => handler?.call(this, event)
          if (first) {
            first = false
            deliver()
          } else if (blocked) pending.push(deliver)
          else deliver()
        }
      }
    }
  })
  await page.goto('http://127.0.0.1:5180/BESS-Twin/')
  await expect(page.getByTestId('kpi-soc')).toBeVisible()
  await page.getByRole('button', { name: 'Storage fault', exact: true }).click()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await expect(page.getByTestId('learn-l1-basics')).toBeDisabled()
  report.pendingHub = {
    disabled: await page.getByTestId('learn-l1-basics').isDisabled(),
    misleadingSourceMessages: await page
      .getByText('Lessons need the built-in simulation.', { exact: true })
      .count(),
  }
  await page.getByTestId('learn-l1-basics').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/learning-audit/pending-hub.png' })
  await page.evaluate(() => window.releaseAudit())
  await expect(page.getByTestId('learn-l1-basics')).toBeEnabled({ timeout: 25000 })
  report.pendingHub.recovers = true
} finally {
  await browser.close()
}
await writeFile('docs/learning-audit-evidence.json', JSON.stringify(report, null, 2) + '\n')
console.log(
  JSON.stringify(
    {
      numericalCases: report.numerical.length,
      errors: report.numerical.filter((x) => x.error),
      glossary: report.glossary,
      pendingHub: report.pendingHub,
      ui: report.ui,
    },
    null,
    2,
  ),
)
