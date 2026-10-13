import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

// Vite transforms the same TypeScript engine used in the app; no separate model.
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
})
try {
  const { simulateDay } = await server.ssrLoadModule('/src/simulation/engine.ts')
  const { savingsBreakdown } = await server.ssrLoadModule('/src/simulation/savings.ts')
  const report = ['sunny', 'cloudy', 'fault'].map((id) => {
    const started = performance.now()
    const day = simulateDay(id)
    const elapsedMs = performance.now() - started
    const ledger = savingsBreakdown(day, day.frames.length)
    const round = (n) => Number(n.toFixed(6))
    const max = (key) => Math.max(...day.frames.map((f) => f.metrics[key]))
    return {
      scenario: id,
      minuteCount: day.frames.length,
      computeMs: round(elapsedMs),
      maximumDemandMW: round(max('demandMW')),
      maximumImportMW: round(max('gridImportMW')),
      maximumExportMW: round(max('gridExportMW')),
      unservedMWh: round(day.summary.unservedMWh),
      noBatteryBaselineUnservedMWh: round(day.summary.baselineUnservedMWh),
      totalCostCny: round(day.summary.costCny),
      noBatteryBaselineCostCny: round(day.summary.baselineCostCny),
      daySavingsCny: ledger.estimatedSavingsCny === null ? null : round(ledger.estimatedSavingsCny),
      billDifferenceCny: round(ledger.billDifferenceCny),
      storedDeltaMWh: round(ledger.storedDeltaMWh),
      offlineStoredMWh: round(ledger.offlineStoredMWh),
      plannedPeakImportMW: day.summary.peakLevelMW,
      initialStoredMWh: round(day.summary.initialStoredMWh),
      finalStoredMWh: round(day.summary.finalStoredMWh),
      at1730: {
        importMW: round(day.frames[1050].metrics.gridImportMW),
        dischargeMW: round(day.frames[1050].metrics.batteryDischargeMW),
        installedSocPct: round(day.frames[1050].metrics.socPct),
        onlinePowerLimitMW: day.frames[1050].metrics.onlinePowerLimitMW,
        strategy: day.frames[1050].strategy.code,
      },
      at1900: {
        importMW: round(day.frames[1140].metrics.gridImportMW),
        dischargeMW: round(day.frames[1140].metrics.batteryDischargeMW),
        strategy: day.frames[1140].strategy.code,
      },
    }
  })
  await writeFile('docs/simulation-report.json', `${JSON.stringify(report, null, 2)}\n`)
  console.table(report.map(({ at1730: _a, at1900: _b, ...row }) => row))
  console.log('Saved docs/simulation-report.json (computeMs depends on hardware; excludes UI).')
} finally {
  await server.close()
}
