import type { Lang, Localized, ScenarioId, SimulationDay, Snapshot } from '../domain/types'
import type { Selection } from '../components/scene/shared'
import type { LessonId } from './progress'
import type { SimulationParameters } from '../domain/parameters'
import type { StudyResult } from '../data/studyProtocol'
export type LessonContext = { sunny: SimulationDay }
export type Predicate = (s: Snapshot, day: SimulationDay, context: LessonContext) => boolean
export type Template = (
  s: Snapshot,
  day: SimulationDay,
  context: LessonContext,
  lang: Lang,
) => string
export interface LessonStep {
  id: string
  minute: number
  playFrom?: number
  focus?: Selection | 'overview'
  highlight?: string
  title: Localized
  body: Template
  predict?: {
    question: Localized
    options: { id: string; label: Localized; correct: Predicate }[]
    revealAt: number
    explain: Template
  }
}
export interface Lesson {
  id: LessonId
  scenario: ScenarioId
  title: Localized
  summary: Localized
  steps: LessonStep[]
}
export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  zoom: number
}
export interface CameraPort {
  capture: () => CameraState | null
  restore: (state: CameraState) => void
}
export interface LessonSavedState {
  proposal: SimulationParameters
  original: SimulationParameters
  scenario: ScenarioId
  minute: number
  selected: Selection | null
  focus: Selection | 'overview'
  playing: boolean
  speed: number
  rotate: boolean
  camera: CameraState | null
  scroll: [number, number]
}
export interface LessonSession {
  id: LessonId
  saved: LessonSavedState
}
export interface LessonRunnerProps {
  session: LessonSession
  result: StudyResult | null
  busy: boolean
  error: string
  minute: number
  playing: boolean
  reducedMotion: boolean
  prepare: (scenario: ScenarioId) => void
  move: (minute: number, focus: Selection | 'overview') => void
  playUntil: (minute: number) => void
  restore: (saved: LessonSavedState, phase: 'request' | 'finish') => void
  retry: () => void
}
