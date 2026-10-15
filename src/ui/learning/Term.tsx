import { Suspense, lazy, useId, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { GlossaryId } from '../../learning/glossary'
import { learningCopy } from '../../learning/copy'
import { useI18n } from '../../i18n'
const TermPopover = lazy(() => import('./TermPopover'))
let active: string | null = null
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
function activate(id: string | null) {
  active = id
  listeners.forEach((listener) => listener())
}
/** Small entry-bundle trigger. Definitions and popup layout load only on interaction. */
export function Term({
  id,
  children,
  label,
}: {
  id: GlossaryId
  children: ReactNode
  label?: string
}) {
  const uid = useId()
  const button = useRef<HTMLButtonElement>(null)
  const suppressFocus = useRef(false)
  const current = useSyncExternalStore(
    subscribe,
    () => active,
    () => null,
  )
  const { lang } = useI18n()
  const c = learningCopy[lang]
  const close = (restore: boolean) => {
    if (active === uid) activate(null)
    if (restore && button.current) {
      suppressFocus.current = true
      button.current.focus({ preventScroll: true })
      // Focusing an already-focused trigger emits no focus event.
      queueMicrotask(() => {
        suppressFocus.current = false
      })
    }
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        className="term"
        data-term={id}
        aria-label={label ? `${c.explain} ${label}` : undefined}
        aria-expanded={current === uid}
        aria-controls={current === uid ? `${uid}-explanation` : undefined}
        onFocus={() => {
          if (suppressFocus.current || button.current?.dataset.termRestore)
            suppressFocus.current = false
          else activate(uid)
        }}
        onClick={(event) => {
          event.stopPropagation()
          activate(uid)
        }}
      >
        {children}
      </button>
      {current === uid && (
        <Suspense
          fallback={
            <span className="sr-only" role="status">
              {c.loading}
            </span>
          }
        >
          <TermPopover
            id={id}
            uid={`${uid}-explanation`}
            anchor={button}
            onClose={close}
            beforeGlossary={() => {
              suppressFocus.current = true
            }}
          />
        </Suspense>
      )}
    </>
  )
}
