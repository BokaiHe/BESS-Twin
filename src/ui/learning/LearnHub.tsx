import { useRef, useState, useSyncExternalStore } from 'react'
import { ArrowUpRight, BookOpen, CheckCircle2, GitBranch, Sparkles } from 'lucide-react'
import { useI18n } from '../../i18n'
import { hubCopy } from '../../learning/hubCopy'
import { getProgressSnapshot, subscribeProgress, resetProgress } from '../../learning/progress'
import { Modal } from '../Modal'
import './learn-hub.css'

export default function LearnHub({
  onClose,
  onTour,
  onGlossary,
  onFlows,
}: {
  onClose: () => void
  onTour: () => void
  onGlossary: (trigger: HTMLButtonElement) => void
  onFlows: () => void
}) {
  const { lang, t } = useI18n()
  const c = hubCopy[lang]
  const { progress, persistent } = useSyncExternalStore(subscribeProgress, getProgressSnapshot)
  const resetButton = useRef<HTMLButtonElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const activities = progress.activities
  const count = Object.keys(activities).length
  const cards = [
    {
      id: 'tour' as const,
      title: t.tour.start,
      description: c.tourDescription,
      Icon: Sparkles,
      open: () => onTour(),
    },
    {
      id: 'glossary' as const,
      title: c.glossary,
      description: c.glossaryDescription,
      Icon: BookOpen,
      open: (trigger: HTMLButtonElement) => onGlossary(trigger),
    },
    {
      id: 'flows' as const,
      title: c.flows,
      description: c.flowsDescription,
      Icon: GitBranch,
      open: () => onFlows(),
    },
  ]
  return (
    <Modal title={c.title} onClose={onClose} wide className="learn-hub-modal">
      <div className="learn-hub">
        <p>{c.intro}</p>
        <section className="learn-progress" aria-label={c.progress}>
          <div>
            <strong>{c.progress}</strong>
            <span data-testid="learning-progress">
              {count} / {cards.length}
            </span>
          </div>
          <progress value={count} max={cards.length} aria-label={c.progress} />
          <small>{c.progressNote}</small>
        </section>
        <div className="learn-cards">
          {cards.map(({ id, title, description, Icon, open }) => (
            <button
              key={id}
              className="learn-card"
              data-testid={`learn-${id}`}
              aria-label={title}
              aria-describedby={`learn-description-${id} learn-state-${id}`}
              onClick={(event) => open(event.currentTarget)}
            >
              <span className="learn-card-icon">
                <Icon size={22} />
              </span>
              <span className="learn-card-copy">
                <strong>{title}</strong>
                <span id={`learn-description-${id}`}>{description}</span>
                <small
                  className={activities[id] ? 'is-done' : ''}
                  id={`learn-state-${id}`}
                  data-testid={`learn-status-${id}`}
                >
                  {activities[id] && <CheckCircle2 size={13} />}
                  {activities[id] ? (id === 'tour' ? c.completed : c.viewed) : c.notStarted}
                </small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
        <aside className="learn-next">
          <strong>{c.next}</strong>
          <p>{c.future}</p>
        </aside>
        <footer className="learn-storage">
          <p role="status">{persistent ? c.saved : c.sessionOnly}</p>
          <button
            ref={resetButton}
            className="link-btn"
            onClick={() => {
              setConfirmReset(true)
              setResetDone(false)
            }}
          >
            {c.reset}
          </button>
          {confirmReset && (
            <div className="learn-reset">
              <p>{c.resetQuestion}</p>
              <button
                className="pill-btn"
                onClick={() => {
                  resetProgress()
                  setConfirmReset(false)
                  setResetDone(true)
                  resetButton.current?.focus()
                }}
              >
                {c.confirmReset}
              </button>
              <button
                className="pill-btn"
                onClick={() => {
                  setConfirmReset(false)
                  resetButton.current?.focus()
                }}
              >
                {c.cancel}
              </button>
            </div>
          )}
          {resetDone && <p role="status">{c.resetDone}</p>}
        </footer>
      </div>
    </Modal>
  )
}
