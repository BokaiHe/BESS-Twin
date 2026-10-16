import { describe, expect, it } from 'vitest'
import {
  CHALLENGES,
  challengeStart,
  challengeProposal,
  evaluateChallenge,
  challengeReady,
} from './challenges'
import { createSimulationEngine } from '../simulation/engine'
import { studyKey, type StudyResult } from '../data/studyProtocol'
import type { SimulationParameters } from '../domain/parameters'
import { savingsBreakdown } from '../simulation/savings'
import { createProgressStore } from './progress'
function result(index: number, patch: Partial<SimulationParameters> = {}): StudyResult {
  const c = CHALLENGES[index],
    p = challengeStart(c),
    proposal = createSimulationEngine({ ...p, ...patch }).simulateDay(c.scenario),
    original = createSimulationEngine(p).simulateDay(c.scenario)
  return {
    requestId: 1,
    key: studyKey({ scenario: c.scenario, proposal: proposal.parameters, original: p }),
    proposal,
    original,
    sunny: proposal,
    computeMs: 0,
    roundTripMs: 0,
    cacheHits: 0,
  }
}
const witnesses = [
  [{ batteryMWh: 80 }, { batteryMWh: 40 }, { batteryMWh: 30 }],
  [
    { batteryMW: 20, batteryMWh: 30 },
    { batteryMW: 10, batteryMWh: 30 },
    { batteryMW: 8, batteryMWh: 30 },
  ],
  [{ peakPrice: 1.95 }, { peakPrice: 1.55 }, { peakPrice: 1.4 }],
  [{ batteryMWh: 80 }, { batteryMWh: 50 }, { batteryMWh: 35 }],
]
describe('engine-verified challenges', () => {
  CHALLENGES.forEach((c, i) => {
    it(`${c.id}: initial fails, all three star bands are reachable`, () => {
      const initial = result(i)
      expect(initial.proposal.diagnostics.solver.status).toBe('converged')
      expect(evaluateChallenge(c, initial).pass).toBe(false)
      witnesses[i].forEach((p, j) => {
        const r = result(i, p),
          e = evaluateChallenge(c, r)
        expect(e.pass).toBe(true)
        expect(e.stars).toBe(j + 1)
      })
    })
  })
  it('allows reliability improvement with different served energy', () => {
    for (const i of [0, 1]) {
      const r = result(i, witnesses[i][2])
      expect(r.original.summary.unservedMWh).toBeGreaterThan(0.001)
      expect(r.proposal.summary.unservedMWh).toBeLessThanOrEqual(0.001)
      expect(evaluateChallenge(CHALLENGES[i], r).pass).toBe(true)
    }
  })
  it('rejects a genuinely nonconverged configuration', () => {
    const r = result(1, { batteryMW: 6, batteryMWh: 60 })
    expect(r.proposal.diagnostics.solver.status).toBe('not-converged')
    expect(evaluateChallenge(CHALLENGES[1], r).pass).toBe(false)
  })
  it('scores C3 against the new tariff no-storage baseline and rejects price-lifting loophole', () => {
    const r = result(2, { peakPrice: 1.4 }),
      e = evaluateChallenge(CHALLENGES[2], r)
    expect(e.score).toBe(1.05)
    expect(e.criteria.find((x) => x.id === 'savings')?.value).toBe(
      `${savingsBreakdown(r.proposal, 1440).estimatedSavingsCny!.toFixed(2)} CNY`,
    )
    expect(
      evaluateChallenge(CHALLENGES[2], result(2, { valleyPrice: 3, flatPrice: 3, peakPrice: 3 }))
        .pass,
    ).toBe(false)
    const bad = {
      ...r,
      proposal: {
        ...r.proposal,
        diagnostics: {
          ...r.proposal.diagnostics,
          solver: { ...r.proposal.diagnostics.solver, status: 'not-converged' as const },
        },
      },
    }
    expect(evaluateChallenge(CHALLENGES[2], bad).pass).toBe(false)
  })
  it('enforces locked fields and rejects pending, stale, failed, and foreign results', () => {
    const c = CHALLENGES[0],
      r = result(0, { batteryMWh: 30 }),
      p = r.proposal.parameters
    expect(challengeProposal(c, { ...p, gridImportMW: 15 }).gridImportMW).toBe(10)
    expect(challengeReady(c, p, r, false, '')).toBe(true)
    for (const [busy, error] of [
      [true, ''],
      [false, 'failure'],
    ] as const)
      expect(challengeReady(c, p, r, busy, error)).toBe(false)
    expect(challengeReady(c, { ...p, batteryMWh: 31 }, r, false, '')).toBe(false)
    expect(challengeReady(c, p, { ...r, key: 'stale' }, false, '')).toBe(false)
    expect(evaluateChallenge(c, result(0, { gridImportMW: 15, batteryMWh: 30 })).pass).toBe(false)
  })
  it('preserves best score and other learning progress, including session-only storage', () => {
    const store = createProgressStore(() => ({
      getItem: () => null,
      setItem: () => {
        throw Error('quota')
      },
      removeItem: () => {},
    }))
    store.markLessonDone('l1-basics')
    store.markActivity('glossary')
    store.markChallenge('c1-cloudy-supply', 40, 2)
    store.markChallenge('c1-cloudy-supply', 30, 3)
    store.markChallenge('c1-cloudy-supply', 80, 1)
    expect(store.getSnapshot().progress.challenges['c1-cloudy-supply']).toEqual({
      best: 30,
      stars: 3,
    })
    expect(store.getSnapshot().progress.lessons['l1-basics']).toBe('done')
    expect(store.getSnapshot().progress.activities.glossary).toBe('viewed')
    expect(store.getSnapshot().persistent).toBe(false)
    store.markChallenge('c1-cloudy-supply', NaN, 3)
    expect(store.getSnapshot().progress.challenges['c1-cloudy-supply']?.best).toBe(30)
  })
})
