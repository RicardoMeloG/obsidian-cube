import type { SiteContent } from '@/kernel/siteContent'

// Who the page is about, first thing read: name (the page's h1), role and
// keywords in the top-left corner; on stacked layouts the full name also signs
// the cube. `identity-chrome` is a hook for the intro choreography (intro.css).
// It sits above the rails, whose scrim used to dim the name, and takes no
// pointer events, so the rails stay clickable.
export function IdentityChrome({ identity }: { identity: SiteContent['identity'] }) {
  return (
    <div className="identity-chrome pointer-events-none absolute inset-0 z-6 grid grid-rows-[auto_1fr_auto] transition-opacity duration-480 motion-reduce:duration-1 stacked:bottom-auto stacked:h-[52svh]">
      <header className="grid gap-[0.34rem] self-start justify-self-start pt-edge-top pl-edge uppercase">
        <h1 className="m-0 text-name text-ink-50/97 text-shadow-name narrow:text-name-narrow">{identity.displayName}</h1>
        <p className="m-0 text-role text-violet-200/90 narrow:text-role-narrow">{identity.role}</p>
        {identity.keywords && <p className="m-0 text-keywords normal-case text-ink-300/70 narrow:text-keywords-narrow">{identity.keywords}</p>}
      </header>
      {/* The full name under the cube, on stacked layouts only: on desktop the
          face strip carries it. */}
      <p className="hidden w-[min(70vw,520px)] translate-y-[0.4rem] grid-cols-[1fr_auto] items-center gap-[0.9rem] self-end justify-self-end pr-edge pb-[clamp(1.5rem,4vw,3.4rem)] text-right text-signature uppercase text-steel-300/48 before:h-px before:bg-linear-to-r before:from-transparent before:to-steel-400/28 before:content-[''] stacked:grid narrow:w-[min(88vw,420px)] narrow:gap-[0.7rem] narrow:text-signature-narrow">
        {identity.fullName}
      </p>
    </div>
  )
}
