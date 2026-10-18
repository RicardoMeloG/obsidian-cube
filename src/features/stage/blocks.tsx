import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Composition, TemplateId } from '@/kernel/compositions'
import type { FaceCta } from '@/kernel/siteContent'
import type { ResolvedFace } from '@/kernel/visualContent'
import { RichText } from '@/features/content/RichText'
import { splitTitleIntoTwoLines } from '@/features/content/splitTitle'
import { cx } from '@/ui/cx'
import { GithubMark } from './StageIcon'

// What every template receives: its own slots, the face around them (heading,
// CTAs), the counter and the way to open the detail dialog.
export type TemplateProps<T extends TemplateId> = {
  composition: Extract<Composition, { template: T }>
  face: ResolvedFace
  counter: string
  onOpenDetail: (trigger?: HTMLElement) => void
}

// The few blocks every template is built from (panel, heading, chips, labels,
// calls to action), so the faces differ in shape, not in style (spec 011).

export function Heading({ face, counter, size = 'l' }: { face: ResolvedFace; counter: string; size?: 'l' | 'm' }) {
  const [first, second] = splitTitleIntoTwoLines(face.title)
  return (
    <div className="st-heading">
      <div className="st-heading__top">
        <p className="st-eyebrow">
          <span aria-hidden className="st-eyebrow__mark" />
          {face.eyebrow}
        </p>
        <span className="st-counter">{counter}</span>
      </div>
      <h2 className={cx('st-title', size === 'm' && 'st-title--m')}>
        <span>{first}</span>
        {second && <span className="st-title__accent">{second}</span>}
      </h2>
      <RichText className="st-summary" html={face.summary} />
    </div>
  )
}

export function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="st-chips">
      {items.map((chip, index) => (
        <li key={`${chip}-${index}`}>{chip}</li>
      ))}
    </ul>
  )
}

export function SectionLabel({ children, trail }: { children: ReactNode; trail?: string }) {
  return (
    <div className="st-label">
      <span>{children}</span>
      {trail && <small>{trail}</small>}
    </div>
  )
}

// A call to action from the content: a link when it has a target (external
// ones open in a new tab), otherwise it opens the face's detail dialog.
export function Cta({ cta, primary, icon, onOpenDetail }: { cta?: FaceCta; primary?: boolean; icon?: ReactNode; onOpenDetail: (trigger?: HTMLElement) => void }) {
  if (!cta) return null
  const className = cx('st-button focus-ring', primary && 'st-button--primary')
  // A repository link carries the GitHub mark.
  const mark = icon ?? (cta.href?.includes('github.com') ? <GithubMark size={16} /> : undefined)
  const inner = (
    <>
      {mark}
      <span>{cta.label}</span>
      <ChevronRight aria-hidden size={16} strokeWidth={1.8} />
    </>
  )
  if (cta.href) {
    const external = /^https?:/.test(cta.href)
    return (
      <a className={className} href={cta.href} target={external ? '_blank' : undefined} rel="noreferrer">
        {inner}
      </a>
    )
  }
  return (
    <button className={className} type="button" onClick={(event) => onOpenDetail(event.currentTarget)}>
      {inner}
    </button>
  )
}

// The face's two calls to action, as the templates place them.
export function FaceActions({ face, stack, onOpenDetail }: { face: ResolvedFace; stack?: boolean; onOpenDetail: (trigger?: HTMLElement) => void }) {
  if (!face.ctaPrimary && !face.ctaSecondary) return null
  return (
    <div className={cx('st-actions', stack && 'st-actions--stack')}>
      <Cta cta={face.ctaPrimary} primary onOpenDetail={onOpenDetail} />
      <Cta cta={face.ctaSecondary} onOpenDetail={onOpenDetail} />
    </div>
  )
}

// A link a template holds (a featured case, a proof, a document): an anchor
// when it has a target, plain otherwise.
export function MaybeLink({ href, className, children }: { href?: string; className: string; children: ReactNode }) {
  if (!href) return <div className={className}>{children}</div>
  const external = /^https?:/.test(href)
  return (
    <a className={cx(className, 'focus-ring')} href={href} target={external ? '_blank' : undefined} rel="noreferrer">
      {children}
    </a>
  )
}
