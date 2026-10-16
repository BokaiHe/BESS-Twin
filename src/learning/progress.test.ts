import { describe, expect, it, vi } from 'vitest'
import { createProgressStore, parseProgress, PROGRESS_KEY } from './progress'
function memory() {
  const values = new Map<string, string>()
  const port = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
  }
  return { values, port }
}
describe('learning progress', () => {
  it('loads lazily and returns a stable snapshot between changes', () => {
    const { port } = memory(),
      storage = vi.fn(() => port),
      store = createProgressStore(storage)
    expect(storage).not.toHaveBeenCalled()
    const first = store.getSnapshot()
    expect(first.persistent).toBe(true)
    expect(store.getSnapshot()).toBe(first)
    expect(storage).toHaveBeenCalledTimes(1)
  })
  it('accepts previous v1 lessons/challenges without inventing activity completion', () => {
    expect(
      parseProgress(
        JSON.stringify({
          lessons: { 'l1-basics': 'done' },
          challenges: {
            'c1-cloudy-supply': { best: 10, stars: 3 },
          },
        }),
      ),
    ).toEqual({
      lessons: { 'l1-basics': 'done' },
      challenges: { 'c1-cloudy-supply': { best: 10, stars: 3 } },
      activities: {},
    })
  })
  it('sanitizes malformed JSON, unknown IDs and invalid scores/statuses', () => {
    for (const value of [null, '{bad', '[]', 'null', '3'])
      expect(parseProgress(value)).toEqual({ lessons: {}, challenges: {}, activities: {} })
    expect(
      parseProgress(
        JSON.stringify({
          lessons: { unknown: 'done', 'l2-solar': false },
          challenges: {
            'c1-cloudy-supply': { best: -1, stars: 3 },
            'c2-import-cap': { best: 2, stars: 4 },
            'c3-spread': { best: 1, stars: 1.5 },
            'c4-curtailment': { best: '3', stars: 2 },
          },
          activities: { tour: 'viewed', flows: 'done', glossary: 'viewed', unknown: 'done' },
        }),
      ),
    ).toEqual({
      lessons: {},
      challenges: {},
      activities: { glossary: 'viewed' },
    })
  })
  it('persists distinct viewed/completed status without mutating earlier snapshots', () => {
    const { port } = memory(),
      store = createProgressStore(() => port),
      listener = vi.fn()
    const first = store.getSnapshot(),
      unsubscribe = store.subscribe(listener)
    store.markActivity('glossary')
    store.markActivity('tour')
    store.markActivity('flows')
    expect(first.progress.activities).toEqual({})
    expect(createProgressStore(() => port).getSnapshot().progress.activities).toEqual({
      glossary: 'viewed',
      tour: 'done',
      flows: 'viewed',
    })
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    store.resetProgress()
    expect(listener).toHaveBeenCalledTimes(3)
  })
  it('keeps session records after quota failures even if reads still work', () => {
    const { port } = memory()
    port.setItem.mockImplementation(() => {
      throw new Error('Quota')
    })
    const store = createProgressStore(() => port)
    store.markActivity('glossary')
    store.refresh()
    store.markActivity('flows')
    store.refresh()
    expect(store.getSnapshot()).toEqual({
      persistent: false,
      progress: {
        lessons: {},
        challenges: {},
        activities: { glossary: 'viewed', flows: 'viewed' },
      },
    })
  })
  it('does not promise persistence when reading is blocked but writing succeeds', () => {
    const { port } = memory()
    port.getItem.mockImplementation(() => {
      throw new Error('Read denied')
    })
    const store = createProgressStore(() => port)
    store.markActivity('tour')
    expect(store.getSnapshot().persistent).toBe(false)
    store.refresh()
    expect(store.getSnapshot().progress.activities.tour).toBe('done')
  })
  it('survives a throwing storage getter and reset failure', () => {
    const store = createProgressStore(() => {
      throw new Error('Security')
    })
    expect(store.getSnapshot().persistent).toBe(false)
    store.markActivity('tour')
    store.refresh()
    expect(store.getSnapshot().progress.activities.tour).toBe('done')
    store.resetProgress()
    expect(store.getSnapshot().progress.activities).toEqual({})
    expect(store.getSnapshot().persistent).toBe(false)
  })
  it('reset removes only learning data including future lesson and challenge scores', () => {
    const { port, values } = memory()
    values.set('bess-twin-language', 'zh')
    values.set(
      PROGRESS_KEY,
      JSON.stringify({
        lessons: { 'l1-basics': 'done' },
        challenges: { 'c1-cloudy-supply': { best: 10, stars: 2 } },
      }),
    )
    const store = createProgressStore(() => port)
    store.markActivity('tour')
    store.resetProgress()
    expect(values.has(PROGRESS_KEY)).toBe(false)
    expect(values.get('bess-twin-language')).toBe('zh')
    expect(store.getSnapshot().progress).toEqual({ lessons: {}, challenges: {}, activities: {} })
  })
  it('refreshes external records and merges another tab before writing', () => {
    const { port, values } = memory(),
      store = createProgressStore(() => port)
    store.markActivity('tour')
    values.set(
      PROGRESS_KEY,
      JSON.stringify({ activities: { glossary: 'viewed' }, lessons: { 'l3-peak': 'done' } }),
    )
    store.markActivity('flows')
    expect(store.getSnapshot().progress.activities).toEqual({ glossary: 'viewed', flows: 'viewed' })
    expect(store.getSnapshot().progress.lessons).toEqual({ 'l3-peak': 'done' })
    values.delete(PROGRESS_KEY)
    store.refresh()
    expect(store.getSnapshot().progress.activities).toEqual({})
  })
})
