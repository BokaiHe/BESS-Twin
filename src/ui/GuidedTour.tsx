import { markActivity } from '../learning/progress'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react'
import { useI18n, type Dict } from '../i18n'
import type { Selection } from '../components/scene/shared'

type Focus = Selection | 'overview'
interface Step {
  key: keyof Dict['tour']['steps']
  target: string
  focus?: Focus
}
const STEPS: Step[] = [
  { key: 'overview', target: '.stage', focus: 'overview' },
  { key: 'generation', target: '.stage', focus: 'pv' },
  { key: 'storage', target: '.stage', focus: 'bess-cluster' },
  { key: 'grid', target: '.stage', focus: 'grid' },
  { key: 'loads', target: '.stage', focus: 'residential' },
  { key: 'scenarios', target: '.scenario-switch' },
  { key: 'metrics', target: '.kpi-strip' },
  { key: 'timeline', target: '.timeline' },
  { key: 'details', target: '.detail', focus: 'bess-cluster' },
  { key: 'devices', target: '.devices' },
  { key: 'savings', target: '.kpi-savings' },
  { key: 'alarms', target: '[data-tour="alarms"]' },
  { key: 'camera', target: '.cam-tools' },
]

export function GuidedTour({
  onClose,
  onFocus,
}: {
  onClose: () => void
  onFocus: (key: Focus) => void
}) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState({ left: 8, top: 8, width: 0, height: 0 })
  const [panelLeft, setPanelLeft] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const step = STEPS[index]
  const copy = t.tour.steps[step.key]

  useEffect(() => {
    const previous = document.querySelector<HTMLElement>('.learn-btn')
    const scroll = { left: window.scrollX, top: window.scrollY }
    const element = dialog.current
    element?.showModal()
    return () => {
      // Close before restoring focus: an open modal keeps the page inert,
      // including during StrictMode's setup/cleanup cycle.
      element?.close()
      window.scrollTo(scroll)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (step.focus) onFocus(step.focus)
    heading.current?.focus({ preventScroll: true })
  }, [step, onFocus])

  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(step.target)
    if (!target) return
    if (step.target !== '.stage') target.scrollIntoView({ block: 'center', behavior: 'instant' })
    const update = () => {
      const box = target.getBoundingClientRect()
      // Keep scene highlights inside the central view rather than outlining the whole window.
      const scene = step.target === '.stage'
      const left = scene ? 16 : Math.max(6, box.left - 6)
      const top = scene ? 175 : Math.max(6, box.top - 6)
      const right = scene ? window.innerWidth - 16 : Math.min(window.innerWidth - 6, box.right + 6)
      const bottom = scene
        ? window.innerHeight - 285
        : Math.min(window.innerHeight - 6, box.bottom + 6)
      setRect({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) })
      setPanelLeft(!scene && box.left + box.width / 2 > window.innerWidth / 2)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(target)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])

  return (
    <dialog
      ref={dialog}
      className="guide-dialog"
      aria-labelledby="guide-title"
      aria-describedby="guide-body"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="guide-highlight" style={rect} aria-hidden="true" />
      <section className={`guide-card${panelLeft ? ' is-left' : ''}`} data-testid="guide-card">
        <div className="guide-top">
          <span>
            <Sparkles size={16} /> {t.tour.start}
          </span>
          <button className="icon-btn" aria-label={t.tour.skip} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="guide-progress" aria-hidden="true">
          <i style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>
        <small className="guide-count" data-testid="guide-progress">
          {index + 1} / {STEPS.length}
        </small>
        <h2 id="guide-title" ref={heading} tabIndex={-1}>
          {copy.title}
        </h2>
        <p id="guide-body">{copy.body}</p>
        <p className="guide-hint">{t.tour.hint}</p>
        <footer>
          <button
            className="guide-back"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ArrowLeft size={15} />
            {t.tour.back}
          </button>
          <button
            className="guide-next"
            onClick={() => {
              if (index === STEPS.length - 1) {
                markActivity('tour')
                onClose()
              } else setIndex((i) => i + 1)
            }}
          >
            {index === STEPS.length - 1 ? t.tour.finish : t.tour.next}
            <ArrowRight size={15} />
          </button>
        </footer>
      </section>
    </dialog>
  )
}
