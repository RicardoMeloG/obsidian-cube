import { useEffect, useRef } from 'react'
import type { CubeSection, CubeSectionId } from '@/kernel/faces'
import type { SiteLocale } from '@/kernel/siteContent'
import { cx } from '@/ui/cx'
import './FaceStrip.css'

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
    <nav className={NAV} aria-label={label} ref={navRef}>
      <ul className={LIST}>
        {sections.map((section, index) => {
          const active = section.id === activeSectionId
          return (
            <li key={section.id} className="inline-flex items-center phone:flex phone:min-w-0">
              <a
                aria-current={active ? 'page' : undefined}
                className={cx(LINK, active ? LINK_ACTIVE : LINK_IDLE, index > 0 && SEPARATOR)}
                data-section-id={section.id}
                href={buildSectionHref(section.id, locale)}
              >
                <span aria-hidden className={cx(DOT, active ? DOT_ACTIVE : DOT_IDLE)} />
                {section.label}
              </a>
            </li>
          )
        })}
      </ul>
      {/* The full name signs the strip on desktop; it gives way first when the
          strip runs out of room (it is already the page's h1). */}
      <span className="min-w-0 overflow-hidden text-[0.6rem] font-semibold tracking-[0.28em] text-ellipsis whitespace-nowrap text-ink-200/42 uppercase stacked:hidden">
        {fullName}
      </span>
    </nav>
  )
}

// Fixed at the bottom. Desktop: one line with the name at the right.
// Stacked: a solid bar above the scrolling page, compact labels that scroll
// sideways. Phones: two rows of three, nothing clipped, nothing to scroll.
// `cube-section-nav` is a hook for the intro and the layout check.
const NAV = cx(
  'cube-section-nav strip-backdrop pointer-events-auto fixed right-[clamp(1rem,3vw,2.6rem)] bottom-[clamp(0.8rem,1.7vw,1.35rem)] left-[clamp(1rem,3vw,2.6rem)] z-12 flex flex-wrap items-center justify-between gap-[1.4rem] border-t border-violet-500/22 px-[0.2rem] pt-[0.7rem] pb-0',
  'desktop:flex-nowrap',
  'stacked:z-14 stacked:flex-nowrap stacked:gap-2 stacked:border-violet-500/34 stacked:px-[clamp(0.9rem,4vw,1.5rem)] stacked:pt-[0.55rem] stacked:pb-[calc(0.55rem+env(safe-area-inset-bottom,0px))]',
  'narrow:gap-[0.38rem] narrow:pt-[0.42rem]',
  'phone:pt-2',
)

const LIST = cx(
  'm-0 flex list-none flex-wrap p-0 desktop:flex-none',
  'stacked:w-full stacked:flex-nowrap stacked:overflow-x-auto stacked:[scrollbar-width:none] stacked:[&::-webkit-scrollbar]:hidden',
  'narrow:gap-y-[0.12rem]',
  'phone:grid phone:grid-cols-3 phone:gap-x-[0.2rem] phone:gap-y-[0.1rem] phone:overflow-visible',
)

const LINK = cx(
  'focus-ring m-0 inline-flex cursor-pointer items-center gap-[0.45rem] rounded-sm border-0 bg-transparent px-[0.45rem] py-1 text-strip uppercase no-underline transition-colors duration-180',
  // Compact labels whenever the stacked layout applies: the desktop sizing
  // needs about 890px for the six Spanish labels. 0.68 alpha keeps 4.5:1 on the bar.
  'stacked:min-h-9 stacked:gap-[0.32rem] stacked:px-[0.28rem] stacked:py-[0.16rem] stacked:text-[0.52rem] stacked:tracking-[0.16em]',
  'phone:min-h-10 phone:w-full phone:justify-center phone:px-[0.1rem] phone:py-[0.22rem] phone:text-[0.5rem] phone:tracking-[0.14em] phone:whitespace-nowrap',
  // 320-340px, Spanish: INVESTIGACIÓN needs about 86px of an 84px cell.
  'tiny:gap-[0.22rem] tiny:tracking-[0.08em]',
)
// Exactly one colour set applies, so no two colour utilities compete.
const LINK_IDLE = 'text-violet-300/58 hover:text-ink-50/96 stacked:text-violet-300/68 stacked:hover:text-ink-50/96'
const LINK_ACTIVE = 'text-ink-50/96'

// The "·" between labels; phones drop it.
const SEPARATOR = "before:mr-4 before:text-violet-300/36 before:content-['·'] stacked:before:mr-[0.52rem] phone:before:content-none"

const DOT = 'size-[0.32rem] flex-[0_0_0.32rem] rounded-full transition-[background,box-shadow] duration-180'
const DOT_IDLE = 'bg-violet-500/42'
const DOT_ACTIVE = 'bg-violet-300/96 shadow-[0_0_10px_color-mix(in_srgb,var(--color-violet-300)_70%,transparent)]'

function buildSectionHref(sectionId: CubeSectionId, locale: SiteLocale) {
  return `/?section=${encodeURIComponent(sectionId)}&lang=${encodeURIComponent(locale)}`
}
