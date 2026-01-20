import React from 'react'
import clsx from 'clsx'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline'
  size?: 'sm' | 'md'
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-ring)]'

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-accent text-white shadow-soft hover:bg-[var(--color-accent-hover)] active:scale-[0.98]',
  ghost:
    'bg-surface-2 text-text-primary ring-1 ring-inset ring-border hover:bg-[var(--color-overlay-hover)] active:bg-[var(--color-overlay-active)]',
  outline:
    'bg-transparent text-text-primary ring-1 ring-inset ring-border hover:bg-[var(--color-overlay-hover)] active:bg-[var(--color-overlay-active)]',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(baseClasses, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'

export default Button
