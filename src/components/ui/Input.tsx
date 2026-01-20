import React from 'react'
import clsx from 'clsx'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        'w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-text-primary outline-none transition placeholder:text-text-secondary/80 focus:border-accent focus:ring-2 focus:ring-[var(--color-accent-ring)]',
        className,
      )}
      {...props}
    />
  ),
)

Input.displayName = 'Input'

export default Input
