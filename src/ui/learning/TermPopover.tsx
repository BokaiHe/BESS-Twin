import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { GLOSSARY, type GlossaryId } from '../../learning/glossary'
import { learningCopy } from '../../learning/copy'
import { openGlossary } from '../../learning/termLinks'
import { useI18n } from '../../i18n'
import './learning.css'
export default function TermPopover({
  id,
  uid,
  anchor,
  onClose,
  beforeGlossary,
}: {
  id: GlossaryId
  uid: string
  anchor: RefObject<HTMLButtonElement | null>
  onClose: (restore: boolean) => void
  beforeGlossary: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const { lang } = useI18n()
  const c = learningCopy[lang]
  const entry = GLOSSARY.find((e) => e.id === id)!
  const callbacks = useRef({ onClose, beforeGlossary })
  callbacks.current = { onClose, beforeGlossary }
  useLayoutEffect(() => {
    const el = box.current!,
      trigger = anchor.current!
    el.showPopover()
    const place = () => {
      const rect = trigger.getBoundingClientRect()
      const w = Math.min(340, window.innerWidth - 24)
      el.style.width = `${w}px`
      const h = el.getBoundingClientRect().height
      el.style.left = `${window.innerWidth <= 600 ? 12 : Math.max(12, Math.min(rect.left, window.innerWidth - w - 12))}px`
      el.style.top = `${window.innerWidth <= 600 ? Math.max(12, window.innerHeight - h - 12) : Math.max(12, Math.min(rect.bottom + 8 + h > window.innerHeight - 12 ? rect.top - h - 8 : rect.bottom + 8, window.innerHeight - h - 12))}px`
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      el.hidePopover()
    }
  }, [anchor])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        callbacks.current.onClose(true)
      }
    }
    const focus = (e: FocusEvent) => {
      if (
        e.target instanceof Node &&
        !box.current?.contains(e.target) &&
        e.target !== anchor.current
      )
        callbacks.current.onClose(false)
    }
    const outside = (e: PointerEvent) => {
      if (
        e.target instanceof Node &&
        !box.current?.contains(e.target) &&
        e.target !== anchor.current &&
        !anchor.current?.contains(e.target)
      )
        callbacks.current.onClose(false)
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', key, true)
    document.addEventListener('focusin', focus)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('focusin', focus)
    }
  }, [anchor])
  return (
    <div
      ref={box}
      popover="manual"
      className="term-popover"
      id={uid}
      role="region"
      aria-label={entry.term[lang]}
    >
      <div className="term-popover-heading">
        <strong>{entry.term[lang]}</strong>
        <button
          type="button"
          className="icon-btn"
          aria-label={c.close}
          onClick={() => onClose(true)}
        >
          ×
        </button>
      </div>
      <p>{entry.short[lang]}</p>
      {entry.analogy && <p className="muted">{entry.analogy[lang]}</p>}
      <button
        type="button"
        className="link-btn"
        onClick={() => {
          beforeGlossary()
          openGlossary({ id, trigger: anchor.current! })
          onClose(false)
        }}
      >
        {c.view}
      </button>
    </div>
  )
}
