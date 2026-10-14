import type { ComponentProps } from 'react'
import { cx } from './cx'

// The small accented line above a heading, led by a turned square.
// Uses the face accent (accent-scope) of its surroundings.
export function Eyebrow({ children, className, ...rest }: ComponentProps<'p'>) {
  return (
    <p className={cx('m-0 inline-flex items-center gap-[0.6rem] text-eyebrow text-(--accent) uppercase', className)} {...rest}>
      <span aria-hidden className="size-[0.42rem] rotate-45 bg-(--accent) shadow-[0_0_12px_var(--accent-glow)]" />
      {children}
    </p>
  )
}
