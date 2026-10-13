import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../i18n'

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { t } = useI18n()
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog
      ref={dialog}
      className={`modal${wide ? ' is-wide' : ''}`}
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
