import {
  INPUT_DATA_ID,
  MODEL_VERSION,
  parameterKey,
  type SimulationParameters,
} from '../domain/parameters'
import type { ScenarioId, SimulationDay } from '../domain/types'

export interface StudyInput {
  proposal: SimulationParameters
  original: SimulationParameters
  scenario: ScenarioId
}
export interface StudyRequest extends StudyInput {
  requestId: number
  key: string
  modelVersion: string
  inputDataId: string
}
export interface StudyResult {
  requestId: number
  key: string
  proposal: SimulationDay
  original: SimulationDay
  sunny: SimulationDay
  computeMs: number
  roundTripMs: number
  cacheHits: number
}
export type StudyResponse = { result: StudyResult } | { requestId: number; error: string }
export function studyKey(input: StudyInput) {
  return [
    MODEL_VERSION,
    INPUT_DATA_ID,
    input.scenario,
    parameterKey(input.original),
    parameterKey(input.proposal),
  ].join('|')
}
