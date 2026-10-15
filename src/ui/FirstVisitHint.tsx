import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'

const SEEN_KEY = 'bess-twin-tour-hint-seen'
let seenInSession = false

function shouldShow() {
  if (seenInSession) return false
  try {
    return localStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

export function FirstVisitHint({
  touring,
  onStart,
  hasExplored,
}: {
  touring: boolean
  onStart: () => void
  hasExplored: boolean
}) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(shouldShow)
  useEffect(() => {
    if (!visible) return
    seenInSession = true
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // The hint still works for this visit when browser storage is unavailable.
    }
  }, [visible])
  useEffect(() => {
    if (touring || hasExplored) setVisible(false)
  }, [touring, hasExplored])

  const dismiss = () => {
    setVisible(false)
    // Both hint actions disappear; leave focus on the persistent tour entry.
    document.querySelector<HTMLButtonElement>('.tour-btn')?.focus({ preventScroll: true })
  }
  if (!visible || touring || hasExplored) return null
  return (
    <aside className="card first-visit-hint" aria-label={t.publicPage.welcome}>
      <strong>{t.publicPage.welcome}</strong>
      <p>{t.publicPage.hint}</p>
      <div>
        <button
          onClick={() => {
            dismiss()
            onStart()
          }}
        >
          {t.publicPage.start}
        </button>
        <button onClick={dismiss}>{t.publicPage.dismiss}</button>
      </div>
    </aside>
  )
}
