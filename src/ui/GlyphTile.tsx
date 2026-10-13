import type { ComponentProps } from 'react'
import { cx } from './cx'
import './ornaments.css'

// A square turned 45° holding an upright icon, in the face accent.
export function GlyphTile({ children, className, ...rest }: ComponentProps<'span'>) {
  return (
    <span
      className={cx(
        'glyph-tile grid size-[2.4rem] rotate-45 place-items-center rounded-[9px] border border-(--accent-line) text-(--accent) [&>svg]:-rotate-45',
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
