import { useEffect, useRef } from 'react'
import { useI18n } from '../../i18n'
import { timeLabel } from '../../domain/config'
import { lessonCopy } from '../../learning/lessonCopy'
import type { LessonRunnerProps } from '../../learning/lessonTypes'
import { useLessonRunner } from './useLessonRunner'
import './lesson-runner.css'
import { useLessonTarget } from './useLessonTarget'
export default function LessonRunner(props: LessonRunnerProps) {
  const { lang, l } = useI18n(),
    c = lessonCopy[lang]
  const r = useLessonRunner(props)
  useLessonTarget(
    r.ready && r.lesson.id === 'l1-basics' && r.phase === 'read' ? '.storage-tank' : undefined,
    `${lang}:${r.index}`,
  )
  const heading = useRef<HTMLHeadingElement>(null)
  const playButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [r.lesson.id, r.index, r.phase === 'summary'])
  const waiting = !r.ready || ['prepare', 'enter'].includes(r.phase)
  const day = props.result?.proposal,
    context = props.result ? { sunny: props.result.sunny } : null
  const snapshot =
    day?.frames[r.phase === 'reveal' && r.step.predict ? r.step.predict.revealAt : r.step.minute]
  const matches =
    r.ready && r.phase === 'reveal' && snapshot && day && context && r.step.predict
      ? r.step.predict.options.filter((o) => o.correct(snapshot, day, context))
      : []
  return (
    <aside
      className="card lesson-runner"
      aria-label={c.lessons}
      data-testid="lesson-runner"
      data-phase={r.phase}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && r.phase !== 'restore') {
          event.stopPropagation()
          r.exit()
        }
      }}
    >
      <header>
        <span>{l(r.lesson.title)}</span>
        <button
          className="icon-btn"
          aria-label={c.exit}
          onClick={r.exit}
          disabled={r.phase === 'restore'}
        >
          ×
        </button>
      </header>
      <div className="lesson-scroll">
        <h2 tabIndex={-1} ref={heading}>
          {r.phase === 'summary' ? c.summary : l(r.step.title)}
        </h2>
        {r.phase === 'confirm' ? (
          <>
            <p>{c.confirm}</p>
            <button className="pill-btn" onClick={r.confirm}>
              {c.accept}
            </button>
          </>
        ) : r.phase === 'restore' ? (
          <p role="status">{props.error || c.restoring}</p>
        ) : waiting ? (
          <p role="status">{props.error || c.preparing}</p>
        ) : r.phase === 'summary' ? (
          <>
            <p>{l(r.lesson.summary)}</p>
            <p>{c.completed}</p>
            <div className="lesson-actions">
              <button className="pill-btn" onClick={r.exit}>
                {c.finish}
              </button>
              {r.hasNext && (
                <button className="pill-btn" onClick={r.nextLesson}>
                  {c.nextLesson}
                </button>
              )}
            </div>
          </>
        ) : (
          snapshot &&
          day &&
          context && (
            <>
              <div className="lesson-meta">
                {c.step} {r.index + 1} / {r.lesson.steps.length} · {timeLabel(props.minute)}
              </div>
              <p>{r.step.body(snapshot, day, context, lang)}</p>
              {r.step.predict ? (
                <>
                  {r.phase === 'read' && (
                    <fieldset className="lesson-predict">
                      <legend>
                        {c.predict}: {l(r.step.predict.question)} ·{' '}
                        {timeLabel(r.step.predict.revealAt)}
                      </legend>
                      {r.step.predict.options.map((o) => (
                        <label key={o.id}>
                          <input
                            type="radio"
                            name="lesson-prediction"
                            value={o.id}
                            checked={r.choice === o.id}
                            onChange={() => {
                              r.setChoice(o.id)
                              // Bring the now-enabled action into view in short panels.
                              requestAnimationFrame(() =>
                                playButton.current?.scrollIntoView({
                                  block: 'nearest',
                                  behavior: 'instant',
                                }),
                              )
                            }}
                          />
                          {l(o.label)}
                        </label>
                      ))}
                      <small>{c.ready}</small>
                      <button
                        ref={playButton}
                        className="pill-btn"
                        disabled={!r.choice}
                        onClick={r.play}
                      >
                        {c.play}
                      </button>
                    </fieldset>
                  )}
                  {r.phase === 'play' && (
                    <>
                      <p role="status">{c.observe}</p>
                      <button className="pill-btn" onClick={r.skip}>
                        {c.skip}
                      </button>
                    </>
                  )}
                  {r.phase === 'reveal' && (
                    <section
                      className="lesson-reveal"
                      data-testid="lesson-reveal"
                      aria-label={c.reveal}
                    >
                      <strong>
                        {matches.length === 0
                          ? c.none
                          : matches.some((o) => o.id === r.choice)
                            ? c.matched
                            : c.missed}
                      </strong>
                      <p>
                        {c.chosen}:{' '}
                        {l(r.step.predict.options.find((o) => o.id === r.choice)!.label)}
                      </p>
                      {matches.length > 0 && (
                        <p>
                          {c.actual}: {matches.map((o) => l(o.label)).join(' · ')}
                        </p>
                      )}
                      <p>{r.step.predict.explain(snapshot, day, context, lang)}</p>
                    </section>
                  )}
                </>
              ) : null}
              {(!r.step.predict || r.phase === 'reveal') && (
                <button className="pill-btn" onClick={r.advance}>
                  {c.next}
                </button>
              )}
            </>
          )
        )}
        {props.error && (
          <button className="pill-btn" onClick={props.retry}>
            {c.retry}
          </button>
        )}
      </div>
      <footer className="lesson-foot">
        <small className="lesson-lock">{c.lock}</small>
      </footer>
    </aside>
  )
}
