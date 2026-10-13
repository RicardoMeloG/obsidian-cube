import { useEffect, useRef } from 'react'
import type { CubeSection, CubeSectionId } from '@/kernel/faces'
import type { SiteLocale } from '@/kernel/siteContent'

type FaceStripProps = {
  activeSectionId: CubeSectionId
  fullName: string
  label: string
  locale: SiteLocale
  onSelectSection: (id: CubeSectionId) => void
  sections: CubeSection[]
}

// The strip of face names at the bottom; selecting one asks for that face.
export function FaceStrip({
  activeSectionId,
  fullName,
  label,
  locale,
  onSelectSection,
  sections,
}: FaceStripProps) {
  const navRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    function findSectionId(event: Event) {
      const target = event.target instanceof Element ? event.target : null
      const link = target?.closest<HTMLAnchorElement>('.cube-section-nav a[data-section-id]')
      if (!link || !nav?.contains(link)) return null
      return link.dataset.sectionId as CubeSectionId | undefined
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const sectionId = findSectionId(event)
      if (!sectionId) return

      event.preventDefault()
      onSelectSection(sectionId)
    }

    function handleClick(event: MouseEvent) {
      const sectionId = findSectionId(event)
      if (!sectionId) return

      event.preventDefault()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const sectionId = findSectionId(event)
      if (!sectionId) return

      event.preventDefault()
      onSelectSection(sectionId)
    }

    nav.addEventListener('pointerdown', handlePointerDown)
    nav.addEventListener('click', handleClick)
    nav.addEventListener('keydown', handleKeyDown)

    return () => {
      nav.removeEventListener('pointerdown', handlePointerDown)
      nav.removeEventListener('click', handleClick)
      nav.removeEventListener('keydown', handleKeyDown)
    }
  }, [onSelectSection])

  return (
    <nav className="cube-section-nav" aria-label={label} ref={navRef}>
      <ul>
        {sections.map((section) => (
          <li key={section.id}>
            <a
              aria-current={section.id === activeSectionId ? 'page' : undefined}
              className={section.id === activeSectionId ? 'is-active' : undefined}
              data-section-id={section.id}
              href={buildSectionHref(section.id, locale)}
            >
              <span aria-hidden />
              {section.label}
            </a>
          </li>
        ))}
      </ul>
      <span className="cube-section-nav__name">{fullName}</span>
    </nav>
  )
}

function buildSectionHref(sectionId: CubeSectionId, locale: SiteLocale) {
  return `/?section=${encodeURIComponent(sectionId)}&lang=${encodeURIComponent(locale)}`
}
