import { expect, it } from 'vitest'
import { StudyClient } from './studyClient'
import { DEFAULT_PARAMETERS as D } from '../domain/parameters'
import type { StudyRequest, StudyResponse } from './studyProtocol'

class FakeWorker {
  onmessage: ((event: MessageEvent<StudyResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  sent: StudyRequest[] = []
  terminated = false
  postMessage(request: StudyRequest) {
    this.sent.push(request)
  }
  terminate() {
    this.terminated = true
  }
  fail(request: StudyRequest) {
    this.onmessage?.({
      data: { requestId: request.requestId, error: 'intentional' },
    } as MessageEvent<StudyResponse>)
  }
}
it('keeps only the newest queued request and ignores stale worker responses', async () => {
  const worker = new FakeWorker(),
    client = new StudyClient(() => worker as unknown as Worker)
  const input = { proposal: D, original: D, scenario: 'sunny' as const }
  const first = client.compute(input).catch((e: Error) => e.name)
  const middle = client
    .compute({ ...input, proposal: { ...D, batteryMWh: 30 } })
    .catch((e: Error) => e.name)
  const last = client
    .compute({ ...input, proposal: { ...D, batteryMWh: 40 } })
    .catch((e: Error) => e.message)
  expect(await first).toBe('AbortError')
  expect(await middle).toBe('AbortError')
  expect(worker.sent).toHaveLength(1)
  worker.fail(worker.sent[0])
  expect(worker.sent).toHaveLength(2)
  expect(worker.sent[1].proposal.batteryMWh).toBe(40)
  worker.fail(worker.sent[0])
  worker.fail(worker.sent[1])
  expect(await last).toBe('intentional')
  client.dispose()
  expect(worker.terminated).toBe(true)
})
it('rejects an incorrect result identity instead of committing mixed data', async () => {
  const worker = new FakeWorker(),
    client = new StudyClient(() => worker as unknown as Worker)
  const promise = client
    .compute({ proposal: D, original: D, scenario: 'sunny' })
    .catch((e: Error) => e.message)
  worker.onmessage?.({
    data: { result: { requestId: worker.sent[0].requestId, key: 'wrong' } },
  } as MessageEvent<StudyResponse>)
  expect(await promise).toBe('Mismatched study result')
  client.dispose()
})

function succeed(worker: FakeWorker, request: StudyRequest) {
  worker.onmessage?.({
    data: {
      result: {
        requestId: request.requestId,
        key: request.key,
        computeMs: 10,
        roundTripMs: 0,
        cacheHits: 0,
      },
    },
  } as MessageEvent<StudyResponse>)
}
it('reuses an immutable main-thread result without another worker transfer', async () => {
  const worker = new FakeWorker(),
    client = new StudyClient(() => worker as unknown as Worker)
  const input = { proposal: D, original: D, scenario: 'sunny' as const }
  const first = client.compute(input)
  succeed(worker, worker.sent[0])
  const result = await first
  expect(Object.isFrozen(result)).toBe(true)
  expect(await client.compute(input)).toBe(result)
  expect(worker.sent).toHaveLength(1)
  client.dispose()
})
it('promotes a running warm-up without sending the same day twice', async () => {
  const worker = new FakeWorker(),
    client = new StudyClient(() => worker as unknown as Worker)
  const input = { proposal: D, original: D, scenario: 'fault' as const }
  const warm = client.prewarm(input)
  const foreground = client.compute(input)
  succeed(worker, worker.sent[0])
  expect((await foreground).key).toBe(worker.sent[0].key)
  await warm
  expect(worker.sent).toHaveLength(1)
  client.dispose()
})
it('never queues speculative work ahead of the newest foreground request', async () => {
  const worker = new FakeWorker(),
    client = new StudyClient(() => worker as unknown as Worker)
  const input = { proposal: D, original: D, scenario: 'sunny' as const }
  const first = client.compute(input).catch((e: Error) => e.name)
  expect(await client.prewarm({ ...input, scenario: 'cloudy' })).toBe(false)
  const last = client.compute({ ...input, scenario: 'fault' })
  expect(await first).toBe('AbortError')
  succeed(worker, worker.sent[0])
  expect(worker.sent).toHaveLength(2)
  expect(worker.sent[1].scenario).toBe('fault')
  succeed(worker, worker.sent[1])
  await last
  client.dispose()
})
it('cached navigation cancels queued edits and the result cache remains bounded', async () => {
  const worker = new FakeWorker(),
    client = new StudyClient(() => worker as unknown as Worker)
  const input = { proposal: D, original: D, scenario: 'sunny' as const }
  const initial = client.compute(input)
  succeed(worker, worker.sent[0])
  const initialResult = await initial
  const active = client.compute({ ...input, scenario: 'fault' }).catch((e: Error) => e.name)
  const queued = client.compute({ ...input, scenario: 'cloudy' }).catch((e: Error) => e.name)
  expect(await client.compute(input)).toBe(initialResult)
  expect(await active).toBe('AbortError')
  expect(await queued).toBe('AbortError')
  succeed(worker, worker.sent[1])
  expect(worker.sent).toHaveLength(2)
  for (const batteryMWh of [30, 40, 50]) {
    const next = client.compute({ ...input, proposal: { ...D, batteryMWh } })
    succeed(worker, worker.sent.at(-1)!)
    await next
  }
  expect(client.peek(input)).toBeUndefined()
  client.dispose()
})
