export const PROGRESS_KEY = 'bess-twin-learning-v1'
export const LESSON_IDS = ['l1-basics', 'l2-solar', 'l3-peak', 'l4-cloudy', 'l5-fault'] as const
export const CHALLENGE_IDS = [
  'c1-cloudy-supply',
  'c2-import-cap',
  'c3-spread',
  'c4-curtailment',
] as const
export type LessonId = (typeof LESSON_IDS)[number]
export type ChallengeId = (typeof CHALLENGE_IDS)[number]
export type ActivityId = 'tour' | 'glossary' | 'flows'
export interface LearningProgress {
  lessons: Partial<Record<LessonId, 'done'>>
  challenges: Partial<Record<ChallengeId, { best: number; stars: 0 | 1 | 2 | 3 }>>
  activities: { tour?: 'done'; glossary?: 'viewed'; flows?: 'viewed' }
}
const empty = (): LearningProgress => ({ lessons: {}, challenges: {}, activities: {} })
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** Only accept known IDs and valid values; older v1 records need no migration. */
export function parseProgress(raw: string | null): LearningProgress {
  const result = empty()
  try {
    const input = record(JSON.parse(raw ?? 'null'))
    const lessons = record(input.lessons),
      challenges = record(input.challenges)
    for (const id of LESSON_IDS) if (lessons[id] === 'done') result.lessons[id] = 'done'
    for (const id of CHALLENGE_IDS) {
      const item = record(challenges[id])
      if (
        typeof item.best === 'number' &&
        Number.isFinite(item.best) &&
        item.best >= 0 &&
        typeof item.stars === 'number' &&
        Number.isInteger(item.stars) &&
        item.stars >= 0 &&
        item.stars <= 3
      )
        result.challenges[id] = { best: item.best, stars: item.stars as 0 | 1 | 2 | 3 }
    }
    const activities = record(input.activities)
    if (activities.tour === 'done') result.activities.tour = 'done'
    if (activities.glossary === 'viewed') result.activities.glossary = 'viewed'
    if (activities.flows === 'viewed') result.activities.flows = 'viewed'
  } catch {
    /* Invalid JSON is an empty record, never a broken learning UI. */
  }
  return result
}
interface ProgressSnapshot {
  progress: LearningProgress
  persistent: boolean
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Lazy, session-safe store. A failed storage access never discards in-session progress. */
export function createProgressStore(storage: () => StoragePort) {
  let snapshot: ProgressSnapshot | undefined
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  const read = (): ProgressSnapshot => {
    if (snapshot?.persistent === false) return snapshot
    try {
      return { progress: parseProgress(storage().getItem(PROGRESS_KEY)), persistent: true }
    } catch {
      return { progress: snapshot?.progress ?? empty(), persistent: false }
    }
  }
  const getSnapshot = () => (snapshot ??= read())
  const markActivity = (id: ActivityId) => {
    const current = read()
    if (current.progress.activities[id]) {
      snapshot = current
      emit()
      return
    }
    const progress = {
      ...current.progress,
      activities: {
        ...current.progress.activities,
        [id]: id === 'tour' ? ('done' as const) : ('viewed' as const),
      },
    }
    let persistent = current.persistent
    try {
      storage().setItem(PROGRESS_KEY, JSON.stringify(progress))
    } catch {
      persistent = false
    }
    snapshot = { progress, persistent }
    emit()
  }
  const markLessonDone = (id: LessonId) => {
    const current = read()
    const progress: LearningProgress = {
      ...current.progress,
      lessons: { ...current.progress.lessons, [id]: 'done' },
    }
    let persistent = current.persistent
    try {
      storage().setItem(PROGRESS_KEY, JSON.stringify(progress))
    } catch {
      persistent = false
    }
    snapshot = { progress, persistent }
    emit()
  }
  const resetProgress = () => {
    let persistent = true
    try {
      storage().removeItem(PROGRESS_KEY)
    } catch {
      persistent = false
    }
    snapshot = { progress: empty(), persistent }
    emit()
  }
  const refresh = () => {
    snapshot = read()
    emit()
  }
  return {
    getSnapshot,
    markActivity,
    markLessonDone,
    resetProgress,
    refresh,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
const store = createProgressStore(() => window.localStorage)
export const getProgressSnapshot = store.getSnapshot
export const markActivity = store.markActivity
export const markLessonDone = store.markLessonDone
export const resetProgress = store.resetProgress
export function subscribeProgress(listener: () => void) {
  const unsubscribe = store.subscribe(listener)
  const sync = (event: StorageEvent) => {
    if (event.key === PROGRESS_KEY || event.key === null) store.refresh()
  }
  window.addEventListener('storage', sync)
  // Catch changes made in another tab while the hub was closed.
  store.refresh()
  return () => {
    unsubscribe()
    window.removeEventListener('storage', sync)
  }
}
