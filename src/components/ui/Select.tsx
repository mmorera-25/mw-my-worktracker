import React from 'react'
import clsx from 'clsx'

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx(
        'w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--color-accent-ring)]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)

Select.displayName = 'Select'

export default Select
