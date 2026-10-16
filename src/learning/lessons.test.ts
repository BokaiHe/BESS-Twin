import { describe, it, expect } from 'vitest'
import { createSimulationEngine } from '../simulation/engine'
import { DEFAULT_PARAMETERS } from '../domain/parameters'
import { studyKey, type StudyResult } from '../data/studyProtocol'
import { LESSONS, lessonReady } from './lessons'
import { createProgressStore } from './progress'
const engine = createSimulationEngine()
const sunny = engine.simulateDay('sunny'),
  cloudy = engine.simulateDay('cloudy'),
  fault = engine.simulateDay('fault')
const days = { sunny, cloudy, fault },
  context = { sunny }
describe('data-driven lessons', () => {
  it.each(LESSONS)('$id has finite bilingual templates and three to six steps', (lesson) => {
    expect(lesson.steps.length).toBeGreaterThanOrEqual(3)
    expect(lesson.steps.length).toBeLessThanOrEqual(6)
    const day = days[lesson.scenario]
    for (const step of lesson.steps)
      for (const lang of ['en', 'zh'] as const) {
        const s = day.frames[step.minute]
        expect(step.body(s, day, context, lang)).not.toMatch(/NaN|undefined|Infinity/)
        if (step.predict)
          expect(
            step.predict.explain(day.frames[step.predict.revealAt], day, context, lang),
          ).not.toMatch(/NaN|undefined|Infinity/)
      }
  })
  it.each([
    ['l2-solar', 'charge'],
    ['l3-peak', 'discharge'],
    ['l4-cloudy', 'reserve'],
    ['l5-fault', 'increase'],
  ])('%s proves its expected outcome with the engine', (id, answer) => {
    const lesson = LESSONS.find((l) => l.id === id)!,
      p = lesson.steps.find((s) => s.predict)!.predict!,
      day = days[lesson.scenario]
    expect(
      p.options.filter((o) => o.correct(day.frames[p.revealAt], day, context)).map((o) => o.id),
    ).toEqual([answer])
  })
  it('accepts the cloudy baseline alias; only fault lessons require a separate sunny day', () => {
    const result: StudyResult = {
      requestId: 1,
      key: studyKey({
        proposal: DEFAULT_PARAMETERS,
        original: DEFAULT_PARAMETERS,
        scenario: 'cloudy',
      }),
      proposal: cloudy,
      original: cloudy,
      sunny: cloudy,
      computeMs: 0,
      roundTripMs: 0,
      cacheHits: 0,
    }
    expect(lessonReady(result, false, '', LESSONS[3])).toBe(true)
    expect(
      lessonReady(
        {
          ...result,
          key: studyKey({
            proposal: DEFAULT_PARAMETERS,
            original: DEFAULT_PARAMETERS,
            scenario: 'fault',
          }),
          proposal: fault,
        },
        false,
        '',
        LESSONS[4],
      ),
    ).toBe(false)
  })
  it('supports simultaneous solar destinations and no matching prediction without fabricating a winner', () => {
    const p = LESSONS[1].steps[1].predict!,
      s = sunny.frames[p.revealAt]
    expect(
      p.options.filter((o) =>
        o.correct(
          { ...s, metrics: { ...s.metrics, batteryChargeMW: 1, gridExportMW: 2, curtailedMW: 3 } },
          sunny,
          context,
        ),
      ),
    ).toHaveLength(3)
    expect(
      p.options.filter((o) =>
        o.correct(
          { ...s, metrics: { ...s.metrics, batteryChargeMW: 0, gridExportMW: 0, curtailedMW: 0 } },
          sunny,
          context,
        ),
      ),
    ).toHaveLength(0)
  })
  it('never treats old scenario, wrong parameters, pending work or errors as lesson-ready', () => {
    const lesson = LESSONS[4]
    const result: StudyResult = {
      requestId: 1,
      key: studyKey({
        proposal: DEFAULT_PARAMETERS,
        original: DEFAULT_PARAMETERS,
        scenario: 'fault',
      }),
      proposal: fault,
      original: fault,
      sunny,
      computeMs: 0,
      roundTripMs: 0,
      cacheHits: 0,
    }
    expect(lessonReady(result, false, '', lesson)).toBe(true)
    expect(lessonReady(result, true, '', lesson)).toBe(false)
    expect(lessonReady(result, false, 'failed', lesson)).toBe(false)
    expect(lessonReady({ ...result, proposal: sunny }, false, '', lesson)).toBe(false)
    expect(lessonReady({ ...result, key: 'stale' }, false, '', lesson)).toBe(false)
    expect(
      lessonReady(
        { ...result, sunny: { ...sunny, parameters: { ...DEFAULT_PARAMETERS, batteryMWh: 40 } } },
        false,
        '',
        lesson,
      ),
    ).toBe(false)
  })
  it('lesson completion preserves other learning progress, including when storage fails', () => {
    let raw = JSON.stringify({
      activities: { glossary: 'viewed' },
      lessons: { 'l1-basics': 'done' },
      challenges: { 'c1-cloudy-supply': { best: 2, stars: 1 } },
    })
    const port = {
      getItem: () => raw,
      setItem: (_k: string, v: string) => {
        raw = v
      },
      removeItem: () => {
        raw = ''
      },
    }
    const store = createProgressStore(() => port)
    store.markLessonDone('l3-peak')
    expect(store.getSnapshot().progress.lessons).toEqual({ 'l1-basics': 'done', 'l3-peak': 'done' })
    expect(store.getSnapshot().progress.activities.glossary).toBe('viewed')
    expect(store.getSnapshot().progress.challenges['c1-cloudy-supply']?.best).toBe(2)
    const fallback = createProgressStore(() => {
      throw new Error('disabled')
    })
    fallback.markLessonDone('l2-solar')
    fallback.markActivity('flows')
    expect(fallback.getSnapshot().persistent).toBe(false)
    expect(fallback.getSnapshot().progress.lessons['l2-solar']).toBe('done')
  })
})
