import { INPUT_DATA_ID, MODEL_VERSION } from '../domain/parameters'
import { freezeDeep } from '../simulation/engine'
import {
  studyKey,
  type StudyInput,
  type StudyRequest,
  type StudyResponse,
  type StudyResult,
} from './studyProtocol'

interface Job {
  request: StudyRequest
  resolve: (r: StudyResult) => void
  reject: (e: Error) => void
  started: number
}
/** One active job plus only the latest queued request. Superseded results never reach the UI. */
export class StudyClient {
  private worker?: Worker
  private active?: Job
  private queued?: Job
  private serial = 0
  // Three recent scenario comparisons, including their shared immutable days.
  private cache = new Map<string, StudyResult>()
  peek(input: StudyInput) {
    const key = studyKey(input)
    const result = this.cache.get(key)
    if (result) {
      this.cache.delete(key)
      this.cache.set(key, result)
    }
    return result
  }
  /** Speculative work never queues ahead of a user request or changes the UI. */
  async prewarm(input: StudyInput): Promise<boolean> {
    if (this.peek(input)) return true
    if (this.active || this.queued) return false
    try {
      await this.compute(input)
      return true
    } catch {
      return false
    }
  }
  constructor(
    private readonly makeWorker = () =>
      new Worker(new URL('./study.worker.ts', import.meta.url), { type: 'module' }),
  ) {}
  compute(input: StudyInput): Promise<StudyResult> {
    this.queued?.reject(new DOMException('Superseded', 'AbortError'))
    this.active?.reject(new DOMException('Superseded', 'AbortError'))
    this.queued = undefined
    const cached = this.peek(input)
    if (cached) return Promise.resolve(cached)
    return new Promise((resolve, reject) => {
      this.queued = {
        request: {
          ...input,
          requestId: ++this.serial,
          key: studyKey(input),
          modelVersion: MODEL_VERSION,
          inputDataId: INPUT_DATA_ID,
        },
        resolve,
        reject,
        started: 0,
      }
      this.pump()
    })
  }
  private pump() {
    if (this.active || !this.queued) return
    // A just-finished warm-up may satisfy the foreground request queued behind it.
    const cached = this.peek(this.queued.request)
    if (cached) {
      this.queued.resolve(cached)
      this.queued = undefined
      return
    }
    if (!this.worker) {
      this.worker = this.makeWorker()
      this.worker.onmessage = (event: MessageEvent<StudyResponse>) => {
        const job = this.active
        if (!job) return
        const response = event.data
        const id = 'result' in response ? response.result.requestId : response.requestId
        if (id !== job.request.requestId) return
        this.active = undefined
        if ('error' in response) job.reject(new Error(response.error))
        else if (response.result.key !== job.request.key)
          job.reject(new Error('Mismatched study result'))
        else {
          const result = freezeDeep({
            ...response.result,
            roundTripMs: performance.now() - job.started,
          })
          this.cache.set(result.key, result)
          if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value!)
          if (!this.queued) job.resolve(result)
        }
        this.pump()
      }
      this.worker.onerror = (event) => {
        const error = new Error(event.message || 'Simulation worker failed')
        this.active?.reject(error)
        this.queued?.reject(error)
        this.active = undefined
        this.queued = undefined
        this.worker?.terminate()
        this.worker = undefined
      }
    }
    this.active = this.queued
    this.queued = undefined
    this.active.started = performance.now()
    this.worker.postMessage(this.active.request)
  }
  dispose() {
    this.cache.clear()
    const error = new DOMException('Disposed', 'AbortError')
    this.active?.reject(error)
    this.queued?.reject(error)
    this.active = undefined
    this.queued = undefined
    this.worker?.terminate()
    this.worker = undefined
  }
}
