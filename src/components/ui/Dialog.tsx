import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import clsx from 'clsx'
import Card from './Card'

type DialogProps = {
  open: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
  contentClassName?: string
}

const Dialog = ({ open, onClose, title, children, contentClassName }: DialogProps) => {
  const el = document.getElementById('dialog-root') || document.body

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    if (open) {
      window.addEventListener('keydown', handler)
    }
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <Card
        className={clsx(
          "w-full max-w-lg border-border bg-surface p-6 shadow-[var(--shadow-soft)]",
          contentClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          {title ? (
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          ) : null}
          <button
            aria-label="Close dialog"
            onClick={onClose}
            className={clsx(
              'rounded-full p-1 text-text-secondary transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            )}
          >
            ✕
          </button>
        </div>
        <div className="mt-4 text-text-primary">{children}</div>
      </Card>
    </div>,
    el,
  )
}

export default Dialog
