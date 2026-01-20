import React from 'react'
import clsx from 'clsx'

type CardProps = React.HTMLAttributes<HTMLDivElement>

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]',
        className,
      )}
      {...props}
    />
  ),
)

Card.displayName = 'Card'

export default Card
