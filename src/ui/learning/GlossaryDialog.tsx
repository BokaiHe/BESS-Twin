import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { GLOSSARY, searchGlossary, type GlossaryId } from '../../learning/glossary'
import { learningCopy } from '../../learning/copy'
import { Modal } from '../Modal'
import './learning.css'
export default function GlossaryDialog({
  initialId,
  onClose,
}: {
  initialId?: GlossaryId
  onClose: () => void
}) {
  const { lang } = useI18n()
  const c = learningCopy[lang]
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<GlossaryId | undefined>(initialId)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setSelected(initialId)
    setQuery('')
  }, [initialId])
  useEffect(() => {
    if (selected)
      content.current
        ?.querySelector<HTMLElement>(`[data-glossary-id="${selected}"]`)
        ?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  const rows = selected ? GLOSSARY.filter((e) => e.id === selected) : searchGlossary(query)
  return (
    <Modal title={c.glossary} onClose={onClose} wide className="glossary-modal">
      <div
        onKeyDownCapture={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <p>{c.intro}</p>
        <label className="glossary-search">
          {c.search}
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setSelected(undefined)
              setQuery(e.target.value)
            }}
          />
        </label>
        {selected && (
          <button
            className="pill-btn"
            onClick={() => {
              setSelected(undefined)
              setQuery('')
            }}
          >
            {c.glossary}
          </button>
        )}
        <div className="glossary-results" ref={content}>
          {rows.length === 0 && <p role="status">{c.empty}</p>}
          {rows.map((entry) => (
            <article key={entry.id} data-glossary-id={entry.id}>
              <h3>{entry.term[lang]}</h3>
              <p>{entry.short[lang]}</p>
              {entry.long && <p>{entry.long[lang]}</p>}
              {entry.analogy && (
                <p>
                  <strong>{c.analogy}: </strong>
                  {entry.analogy[lang]}
                </p>
              )}
              {!!entry.related?.length && (
                <div className="glossary-related">
                  <span>{c.related}: </span>
                  {entry.related.map((id) => (
                    <button
                      className="link-btn"
                      key={id}
                      onClick={() => {
                        setSelected(id)
                        setQuery('')
                      }}
                    >
                      {GLOSSARY.find((e) => e.id === id)!.term[lang]}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </Modal>
  )
}
