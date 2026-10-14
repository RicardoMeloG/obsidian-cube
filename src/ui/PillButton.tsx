import type { ComponentProps } from 'react'
import { cx } from './cx'
import './ornaments.css'

type PillButtonProps =
  | ({ href: string } & Omit<ComponentProps<'a'>, 'href'>)
  | ({ href?: undefined } & ComponentProps<'button'>)

const CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

const PILL =
  'pill focus-ring inline-flex cursor-pointer items-center gap-[0.55rem] rounded-full border border-[color-mix(in_srgb,var(--accent)_50%,transparent)] px-4 py-[0.62rem] text-cta text-ink-100/92 uppercase no-underline transition-[border-color,background,transform] duration-180 hover:-translate-y-px hover:border-(--accent)'

// A call to action: a link when it has a target, otherwise a button.
// External links open in a new tab.
export function PillButton(props: PillButtonProps) {
  if (props.href !== undefined) {
    const { children, className, href, ...rest } = props
    return (
      <a className={cx(PILL, className)} href={href} rel="noreferrer" target={href.startsWith('http') ? '_blank' : undefined} {...rest}>
        <span>{children}</span>
        {CHEVRON}
      </a>
    )
  }
  const { children, className, ...rest } = props
  return (
    <button className={cx(PILL, 'font-[inherit]', className)} type="button" {...rest}>
      <span>{children}</span>
      {CHEVRON}
    </button>
  )
}
