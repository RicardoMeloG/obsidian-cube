import type { CSSProperties } from 'react'
import type { FaceId } from '@/kernel/faces'
import type { SiteLocale } from '@/kernel/siteContent'
import { pagePath } from '@/kernel/sitePaths'
import type { ResolvedFace } from '@/kernel/visualContent'
import { cx } from '@/ui/cx'
import { StageIcon } from './StageIcon'

type StageDockProps = {
  sections: ResolvedFace[]
  activeFace: FaceId
  locale: SiteLocale
  label: string
  onRequestFace: (face: FaceId) => void
}

// The dock of faces: each with its icon (visual.json) and tagline (the
// content), in its own accent. A link per face, so the face is shareable.
export function StageDock({ sections, activeFace, locale, label, onRequestFace }: StageDockProps) {
  return (
    <nav className="stage-dock" aria-label={label}>
      <ul>
        {sections.map((section) => {
          const active = section.id === activeFace
          return (
            <li key={section.id} style={{ '--section-accent': section.accent } as CSSProperties} className="accent-scope">
              <a
                className={cx('stage-dock__item focus-ring', active && 'is-active')}
                aria-current={active ? 'page' : undefined}
                data-section-id={section.id}
                href={pagePath({ locale, face: section.id })}
                onClick={(event) => {
                  event.preventDefault()
                  onRequestFace(section.id)
                }}
              >
                <span className="stage-dock__icon">
                  <StageIcon id={section.icon} size={17} />
                </span>
                <span className="stage-dock__text">
                  <strong>{section.label}</strong>
                  {section.tagline && <small>{section.tagline}</small>}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
