import type { ComponentProps } from 'react'
import { cx } from './cx'

// A step number in a circle: 01, 02…
export function NumberBadge({ value, className, ...rest }: { value: number } & ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      className={cx(
        'grid size-[2.4rem] place-items-center rounded-full border border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-night-900/84 text-badge text-ink-200/86',
        className,
      )}
      {...rest}
    >
      {String(value).padStart(2, '0')}
    </span>
  )
}
