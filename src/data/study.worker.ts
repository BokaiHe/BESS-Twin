import { createSimulationEngine } from '../simulation/engine'
import {
  INPUT_DATA_ID,
  MODEL_VERSION,
  normalizeParameters,
  parameterKey,
  type SimulationParameters,
} from '../domain/parameters'
import type { ScenarioId, SimulationDay } from '../domain/types'
import { studyKey, type StudyRequest, type StudyResponse } from './studyProtocol'

// At most six complete days (~40 MB serialized); refreshing never grows this without bound.
const cache = new Map<string, SimulationDay>()
// Preserve each configuration's periodic solutions across scenario requests.
const engines = new Map<string, ReturnType<typeof createSimulationEngine>>()
self.onmessage = (event: MessageEvent<StudyRequest>) => {
  const request = event.data
  try {
    if (
      request.modelVersion !== MODEL_VERSION ||
      request.inputDataId !== INPUT_DATA_ID ||
      !['sunny', 'cloudy', 'fault'].includes(request.scenario) ||
      request.key !== studyKey(request)
    )
      throw new Error('Unsupported study request')
    const started = performance.now()
    let cacheHits = 0
    const load = (parameters: SimulationParameters, scenario: ScenarioId) => {
      const normalized = normalizeParameters(parameters)
      const configKey = parameterKey(normalized)
      const key = `${MODEL_VERSION}|${INPUT_DATA_ID}|${configKey}|${scenario}`
      let day = cache.get(key)
      if (day) {
        cache.delete(key)
        cache.set(key, day)
        cacheHits++
        return day
      }
      let engine = engines.get(configKey)
      if (!engine) {
        engine = createSimulationEngine(normalized)
        engines.set(configKey, engine)
        if (engines.size > 3) engines.delete(engines.keys().next().value!)
      }
      day = engine.simulateDay(scenario)
      cache.set(key, day)
      if (cache.size > 6) cache.delete(cache.keys().next().value!)
      return day
    }
    const proposal = load(request.proposal, request.scenario)
    const original = load(request.original, request.scenario)
    const sunny = request.scenario === 'fault' ? load(request.proposal, 'sunny') : proposal
    const response: StudyResponse = {
      result: {
        requestId: request.requestId,
        key: request.key,
        proposal,
        original,
        sunny,
        computeMs: performance.now() - started,
        roundTripMs: 0,
        cacheHits,
      },
    }
    self.postMessage(response)
  } catch (error) {
    self.postMessage({ requestId: request.requestId, error: String(error) } satisfies StudyResponse)
  }
}
