import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
})
try {
  const { createSimulationEngine } = await server.ssrLoadModule('/src/simulation/engine.ts')
  const { CHALLENGES, challengeStart, challengeProposal, evaluateChallenge } =
    await server.ssrLoadModule('/src/learning/challenges.ts')
  const { studyKey } = await server.ssrLoadModule('/src/data/studyProtocol.ts')
  const { MODEL_VERSION, INPUT_DATA_ID } = await server.ssrLoadModule('/src/domain/parameters.ts')
  const report = {
    modelVersion: MODEL_VERSION,
    inputDataId: INPUT_DATA_ID,
    note: 'Finite candidate scan, not a claim of a global optimum. Stars are ordered from one to three.',
    challenges: [],
  }
  for (const c of CHALLENGES) {
    const start = challengeStart(c),
      original = createSimulationEngine(start).simulateDay(c.scenario)
    const run = (patch) => {
      const parameters = challengeProposal(c, { ...start, ...patch }),
        proposal = createSimulationEngine(parameters).simulateDay(c.scenario)
      const result = {
        requestId: 1,
        key: studyKey({ scenario: c.scenario, original: start, proposal: parameters }),
        original,
        proposal,
        sunny: proposal,
        computeMs: 0,
        roundTripMs: 0,
        cacheHits: 0,
      }
      const e = evaluateChallenge(c, result)
      return {
        parameters,
        pass: e.pass,
        stars: e.stars,
        score: e.score,
        solver: proposal.diagnostics.solver.status,
        criteria: e.criteria.map(({ id, pass, value }) => ({ id, pass, value })),
      }
    }
    const candidates = []
    if (c.id === 'c3-spread')
      for (const valleyPrice of [0.2, 0.35])
        for (const flatPrice of [0.5, 0.68])
          for (const peakPrice of [1.08, 1.37, 1.4, 1.55, 1.95])
            candidates.push(run({ valleyPrice, flatPrice, peakPrice }))
    else
      for (const batteryMW of [4, 6, 8, 10, 20])
        for (const batteryMWh of [20, 30, 35, 40, 50, 80])
          candidates.push(run({ batteryMW, batteryMWh }))
    const patches =
      c.id === 'c1-cloudy-supply'
        ? [{ batteryMWh: 80 }, { batteryMWh: 40 }, { batteryMWh: 30 }]
        : c.id === 'c2-import-cap'
          ? [
              { batteryMW: 20, batteryMWh: 30 },
              { batteryMW: 10, batteryMWh: 30 },
              { batteryMW: 8, batteryMWh: 30 },
            ]
          : c.id === 'c3-spread'
            ? [{ peakPrice: 1.95 }, { peakPrice: 1.55 }, { peakPrice: 1.4 }]
            : [{ batteryMWh: 80 }, { batteryMWh: 50 }, { batteryMWh: 35 }]
    const initial = run({}),
      witnesses = patches.map(run)
    if (initial.pass || witnesses.some((x, i) => !x.pass || x.stars !== i + 1))
      throw new Error(`Invalid challenge: ${c.id}`)
    report.challenges.push({ id: c.id, initial, witnesses, candidates })
    console.log(
      c.id,
      'start fails; 1/2/3-star solutions verified;',
      candidates.length,
      'candidates',
    )
  }
  await writeFile('docs/challenge-scan.json', JSON.stringify(report, null, 2) + '\n')
} finally {
  await server.close()
}
