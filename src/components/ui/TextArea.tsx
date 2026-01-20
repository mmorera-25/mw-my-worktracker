import React from 'react'
import clsx from 'clsx'

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(
        'w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--color-accent-ring)]',
        className,
      )}
      {...props}
    />
  ),
)

TextArea.displayName = 'TextArea'

export default TextArea
