import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, Layers3, X } from 'lucide-react'
import { useI18n } from '../i18n'

export type ExplorerKind = 'container' | 'pv' | 'wind'
const KINDS: ExplorerKind[] = ['container', 'pv', 'wind']
const IMAGE: Record<ExplorerKind, string> = { container: 'bess', pv: 'pv', wind: 'wind' }
const src = (kind: ExplorerKind) => `${import.meta.env.BASE_URL}explorers/${IMAGE[kind]}.jpg`

/**
 * Overview entry to the three equipment explorers: a compact badge that expands into
 * preview cards. Previews are static captures (`npm run explorers:previews`).
 */
export function ExplorerHub({ onOpen }: { onOpen: (kind: ExplorerKind) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  // Expanding/collapsing swaps the focused control, so hand focus to its counterpart:
  // the first preview after expanding, the badge after collapsing. Skip the first render.
  const badge = useRef<HTMLButtonElement>(null)
  const firstTile = useRef<HTMLButtonElement>(null)
  const toggled = useRef(false)
  useEffect(() => {
    if (!toggled.current) return
    const target = (open ? firstTile : badge).current
    target?.focus({ preventScroll: true })
    // Collapsing a tall panel changes document height. Reveal the new focus target
    // after scroll anchoring has adjusted the page, including short-window layouts.
    const frame = requestAnimationFrame(() =>
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [open])
  const toggle = (next: boolean) => {
    toggled.current = true
    setOpen(next)
  }

  if (!open)
    return (
      <button
        ref={badge}
        className="card hub-badge"
        aria-expanded={false}
        aria-label={t.hub.show}
        onClick={() => toggle(true)}
      >
        <span className="hub-thumbs" aria-hidden="true">
          {KINDS.map((k) => (
            <img key={k} src={src(k)} alt="" />
          ))}
        </span>
        <span className="hub-badge-text">
          <strong>{t.hub.title}</strong>
          <small>{t.hub.count}</small>
        </span>
        <ChevronDown size={16} className="hub-chev" />
      </button>
    )

  return (
    <section className="card hub-panel" aria-label={t.hub.title}>
      <header className="hub-head">
        <span className="hub-icon">
          <Layers3 size={17} />
        </span>
        <div>
          <strong>{t.hub.title}</strong>
          <p>{t.hub.sub}</p>
        </div>
        <button
          className="icon-btn"
          aria-expanded={true}
          aria-label={t.hub.hide}
          title={t.hub.hide}
          onClick={() => toggle(false)}
        >
          <X size={15} />
        </button>
      </header>
      <div className="hub-grid">
        {KINDS.map((k, i) => (
          <button
            key={k}
            ref={i === 0 ? firstTile : undefined}
            className="hub-tile"
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => onOpen(k)}
          >
            <span className="hub-image">
              <img src={src(k)} alt="" />
            </span>
            <span className="hub-tile-text">
              <strong>{t.hub.items[k].name}</strong>
              <small>{t.hub.items[k].desc}</small>
            </span>
            <span className="hub-enter">
              {t.hub.enter}
              <ArrowUpRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
