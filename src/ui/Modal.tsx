import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../i18n'

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = '',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  className?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { t } = useI18n()
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className={`modal${wide ? ' is-wide' : ''} ${className}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-btn" aria-label={t.close} onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  )
}
