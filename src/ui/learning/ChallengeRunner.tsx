import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../../i18n'
import { Modal } from '../Modal'
import { DesignStudy } from '../DesignStudy'
import {
  CHALLENGES,
  challengeStart,
  challengeProposal,
  challengeReady,
  evaluateChallenge,
} from '../../learning/challenges'
import { challengeCopy } from '../../learning/challengeCopy'
import {
  getProgressSnapshot,
  subscribeProgress,
  markChallenge,
  type ChallengeId,
} from '../../learning/progress'
import type { LessonSavedState } from '../../learning/lessonTypes'
import type { ScenarioId } from '../../domain/types'
import type { SimulationParameters } from '../../domain/parameters'
import { studyKey, type StudyResult } from '../../data/studyProtocol'
import './challenges.css'
export interface ChallengeRunnerProps {
  session: { id: ChallengeId; saved: LessonSavedState }
  proposal: SimulationParameters
  result: StudyResult | null
  busy: boolean
  error: string
  prepare: (scenario: ScenarioId, p: SimulationParameters) => void
  onChange: (p: SimulationParameters, debounce?: boolean) => void
  restore: (saved: LessonSavedState, phase: 'request' | 'finish') => void
  retry: () => void
}
export default function ChallengeRunner(props: ChallengeRunnerProps) {
  const { lang, l } = useI18n(),
    c = challengeCopy[lang]
  const api = useRef(props)
  api.current = props
  const [index, setIndex] = useState(() => CHALLENGES.findIndex((x) => x.id === props.session.id))
  const challenge = CHALLENGES[index]
  const [phase, setPhase] = useState<'active' | 'restore'>('active')
  const { progress, persistent } = useSyncExternalStore(subscribeProgress, getProgressSnapshot)
  const ready = challengeReady(challenge, props.proposal, props.result, props.busy, props.error)
  const evaluation = ready && props.result ? evaluateChallenge(challenge, props.result) : null
  const best = progress.challenges[challenge.id]
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    api.current.prepare(challenge.scenario, challengeStart(challenge))
    heading.current?.focus({ preventScroll: true })
  }, [challenge])
  useEffect(() => {
    if (phase === 'restore') api.current.restore(api.current.session.saved, 'request')
  }, [phase])
  useEffect(() => {
    if (
      phase === 'restore' &&
      props.result &&
      !props.busy &&
      !props.error &&
      props.result.key === studyKey(props.session.saved)
    )
      api.current.restore(props.session.saved, 'finish')
  }, [phase, props.result, props.busy, props.error, props.session.saved])
  useEffect(() => {
    if (phase === 'active' && evaluation?.pass && evaluation.stars > 0)
      markChallenge(challenge.id, evaluation.score, evaluation.stars as 1 | 2 | 3)
  }, [phase, challenge.id, evaluation?.pass, evaluation?.score, evaluation?.stars])
  const exit = () => setPhase('restore')
  return (
    <Modal title={l(challenge.title)} className="study-modal challenge-modal" onClose={exit}>
      <section
        className="challenge-goals"
        data-testid="challenge-goals"
        aria-busy={!ready || phase === 'restore'}
      >
        <h3 ref={heading} tabIndex={-1}>
          {c.goals}
        </h3>
        <p>{c.intro}</p>
        {phase === 'restore' ? (
          <p role="status">{props.error || c.restoring}</p>
        ) : (
          <>
            {!ready && (
              <p role="status" data-testid="challenge-pending">
                {props.error || c.waiting}
              </p>
            )}
            <ul>
              {challenge.criteria.map((rule) => {
                const row = evaluation?.criteria.find((x) => x.id === rule.id)
                return (
                  <li key={rule.id} data-testid={`goal-${rule.id}`} data-pass={row?.pass ?? false}>
                    <span aria-hidden="true">{row?.pass ? '✓' : '○'}</span>
                    <strong>{l(rule.label)}</strong>
                    <span>{row ? `${row.value} · ${row.pass ? c.passed : c.pending}` : '—'}</span>
                  </li>
                )
              })}
            </ul>
            <details>
              <summary>{c.hint}</summary>
              <p>{l(challenge.hint)}</p>
            </details>
            <p>
              {c.rating}:{' '}
              {challenge.score.stars
                .map((limit, i) => `${'★'.repeat(i + 1)} ≤ ${limit} ${challenge.score.unit}`)
                .join(' · ')}
            </p>
            {evaluation && (
              <p data-testid="challenge-score">
                {c.score}: {evaluation.score.toFixed(2)} {challenge.score.unit}
              </p>
            )}
            {evaluation?.pass && (
              <div className="challenge-success" data-testid="challenge-success" role="status">
                <strong>
                  {c.success} ·{' '}
                  <span data-testid="challenge-stars">
                    {'★'.repeat(evaluation.stars)}
                    {'☆'.repeat(3 - evaluation.stars)}
                  </span>
                </strong>
                <p>{l(challenge.explain)}</p>
                {index < CHALLENGES.length - 1 && (
                  <button className="pill-btn" onClick={() => setIndex(index + 1)}>
                    {c.next}
                  </button>
                )}
              </div>
            )}
            {best && (
              <p data-testid="challenge-best">
                {c.best}: {best.best.toFixed(2)} {challenge.score.unit} · {'★'.repeat(best.stars)}
              </p>
            )}
            {!persistent && <p role="status">{c.sessionOnly}</p>}
            <p>{c.reference}</p>
          </>
        )}
        <button className="pill-btn" disabled={phase === 'restore'} onClick={exit}>
          {c.exit}
        </button>
        {props.error && (
          <button className="pill-btn" onClick={props.retry}>
            {c.retry}
          </button>
        )}
      </section>
      {phase === 'active' && props.result && (
        <DesignStudy
          key={challenge.id}
          mode={{ challenge: challenge.id }}
          challengeRules={{
            editable: challenge.editable,
            start: challengeStart(challenge),
            lockedText: c.locked,
          }}
          proposal={props.proposal}
          onChange={(p, debounce) => props.onChange(challengeProposal(challenge, p), debounce)}
          onPin={() => {}}
          result={props.result}
          busy={!ready}
          error={props.error}
          scenario={challenge.scenario}
          onScenario={() => {}}
          onRetry={props.retry}
        />
      )}
    </Modal>
  )
}
