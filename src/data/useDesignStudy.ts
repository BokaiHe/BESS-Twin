import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_PARAMETERS } from '../domain/parameters'
import type { ScenarioId, TwinDataSource } from '../domain/types'
import { StudyClient } from './studyClient'
import { studyKey, type StudyResult } from './studyProtocol'

export function useDesignStudy(scenario: ScenarioId, source?: TwinDataSource) {
  const [proposal, updateProposal] = useState(DEFAULT_PARAMETERS)
  const debounceEdit = useRef(false)
  const setProposal = useCallback((p: typeof DEFAULT_PARAMETERS, debounce = true) => {
    debounceEdit.current = debounce
    updateProposal(p)
  }, [])
  const [original, setOriginal] = useState(DEFAULT_PARAMETERS)
  const [result, setResult] = useState<StudyResult | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [client] = useState(() => new StudyClient())
  const previous = useRef<{ proposal: typeof proposal; scenario: ScenarioId } | null>(null)
  const key = studyKey({ proposal, original, scenario })
  const busy = result?.key !== key
  useEffect(() => () => client.dispose(), [client])
  useEffect(() => {
    let cancelled = false
    setError('')
    const delay =
      debounceEdit.current &&
      previous.current?.scenario === scenario &&
      previous.current.proposal !== proposal
        ? 300
        : 0
    previous.current = { proposal, scenario }
    let warmTimer: ReturnType<typeof setTimeout> | undefined
    let idleTask: number | undefined
    const whenIdle = (callback: () => void, wait: number) => {
      warmTimer = setTimeout(() => {
        if (cancelled) return
        if ('requestIdleCallback' in window)
          idleTask = window.requestIdleCallback(callback, { timeout: 2000 })
        else callback()
      }, wait)
    }
    const run = () => {
      const promise = source
        ? Promise.all([source.loadDay(scenario), source.loadDay('sunny')]).then(([day, sunny]) => ({
            requestId: 0,
            key,
            proposal: day,
            original: day,
            sunny,
            computeMs: 0,
            roundTripMs: 0,
            cacheHits: 0,
          }))
        : client.compute({ proposal, original, scenario })
      promise
        .then((next) => {
          if (cancelled) return
          setResult(next)
          // Give the first scene paint priority, then warm one scenario at a time.
          const scenarios = (['sunny', 'cloudy', 'fault'] as const).filter((id) => id !== scenario)
          const warmNext = async () => {
            if (cancelled || source) return
            const id = scenarios.shift()
            if (!id) return
            await client.prewarm({ proposal, original, scenario: id })
            if (!cancelled) whenIdle(warmNext, 250)
          }
          whenIdle(warmNext, 750)
        })
        .catch((e) => {
          if (!cancelled && e.name !== 'AbortError') setError(String(e))
        })
    }
    // Initial load, scenario switches and retries have no artificial delay.
    const timer =
      delay && !client.peek({ proposal, original, scenario }) ? setTimeout(run, delay) : undefined
    if (!timer) run()
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(warmTimer)
      if (idleTask !== undefined) window.cancelIdleCallback(idleTask)
    }
  }, [proposal, original, scenario, source, key, client, retry])
  return {
    proposal,
    setProposal,
    original,
    setOriginal,
    result,
    busy,
    error,
    enabled: !source,
    retry: () => setRetry((n) => n + 1),
  }
}
