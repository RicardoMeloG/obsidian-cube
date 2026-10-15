import { Rotate3d, X } from 'lucide-react'
import type { SiteContent, SiteLocale } from '@/kernel/siteContent'
import type { InterfaceCopy } from '@/features/content/copy'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { GithubMark, LinkedinMark, StageIcon } from './StageIcon'

type StageTopProps = {
  identity: SiteContent['identity']
  copy: InterfaceCopy
  locale: SiteLocale
  localeOptions: readonly { value: SiteLocale; label: string }[]
  onLocaleChange: (locale: SiteLocale) => void
  explore: boolean
  onExplore: (explore: boolean) => void
  onContact: () => void
}

// The stage's top bar: the name first, the button that brings the cube
// forward, and the ways to reach the owner (CONTACT and the profiles in
// `identity.links`, spec 011, AD-02).
export function StageTop({ identity, copy, locale, localeOptions, onLocaleChange, explore, onExplore, onContact }: StageTopProps) {
  const links = identity.links ?? {}
  return (
    <header className="stage-top">
      <div className="stage-identity">
        <h1>{identity.displayName}</h1>
        <p className="stage-identity__role">{identity.role}</p>
        {identity.keywords && <p className="stage-identity__keywords">{identity.keywords}</p>}
      </div>

      <button className="stage-explore focus-ring" type="button" aria-pressed={explore} onClick={() => onExplore(!explore)}>
        {explore ? <X aria-hidden size={15} strokeWidth={1.8} /> : <Rotate3d aria-hidden size={15} strokeWidth={1.6} />}
        <span>{explore ? copy.exploreBack : copy.explore}</span>
      </button>

      <div className="stage-actions">
        <button className="stage-link focus-ring" type="button" onClick={onContact}>
          <StageIcon id="mail" size={16} />
          <span>{copy.contactLink}</span>
        </button>
        {links.github && (
          <a className="stage-link focus-ring" href={links.github} target="_blank" rel="noreferrer">
            <GithubMark />
            <span>{copy.githubLink}</span>
          </a>
        )}
        {links.linkedin && (
          <a className="stage-link focus-ring" href={links.linkedin} target="_blank" rel="noreferrer">
            <LinkedinMark />
            <span>{copy.linkedinLink}</span>
          </a>
        )}
        <SegmentedControl className="stage-locale" label={copy.languageLabel} options={localeOptions} value={locale} onChange={onLocaleChange} />
      </div>
    </header>
  )
}
