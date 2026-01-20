import React from 'react'
import clsx from 'clsx'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement>

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full bg-[rgba(99,102,241,0.12)] px-3 py-1 text-xs font-semibold text-accent',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  ),
)

Badge.displayName = 'Badge'

export default Badge
