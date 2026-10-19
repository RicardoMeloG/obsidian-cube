import { useEffect, useRef } from 'react'
import type { MouseEvent, RefObject } from 'react'
import type { FaceDetail } from '@/kernel/siteContent'
import { RichText } from '@/features/content/RichText'
import { cx } from '@/ui/cx'
import './DetailDialog.css'

type DetailDialogProps = {
  detail: FaceDetail
  faceLabel: string
  closeLabel: string
  onClose: () => void
  // The control that opened the dialog; focus returns to it on close.
  restoreFocusRef: RefObject<HTMLElement | null>
}

// The long form of a face over the page, as a native
// modal <dialog>: the browser puts it in the top layer and makes the rest of
// the page inert. On top of that, focus lands on the title, Tab cycles inside
// the panel, Escape and a click on the backdrop close it, the page scroll is
// locked, and on close focus returns to the control that opened it.
export function DetailDialog({ detail, faceLabel, closeLabel, onClose, restoreFocusRef }: DetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    titleRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')).filter(
        (element) => !element.hasAttribute('disabled'),
      )
      if (focusables.length === 0) {
        event.preventDefault()
        titleRef.current?.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      // Focus on the title or anywhere outside the panel counts as a boundary
      // in both directions.
      const outside = !(active instanceof Element) || !dialog.contains(active) || active === titleRef.current
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (dialog.open) dialog.close()
      root.style.overflow = previousOverflow
      const restore = restoreFocusRef.current
      restoreFocusRef.current = null
      if (restore && restore.isConnected) restore.focus()
    }
  }, [onClose, restoreFocusRef])

  // A click on the backdrop reaches the dialog itself, outside its box.
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
    if (!inside) onClose()
  }

  return (
    <dialog
      aria-labelledby="detail-dialog-title"
      className="detail-dialog m-auto flex max-h-[min(76vh,46rem)] w-[min(46rem,calc(100vw-2*clamp(1rem,4vw,3rem)))] max-w-none flex-col overflow-hidden rounded-[10px] border border-violet-300/34 p-[clamp(1.25rem,3vw,2.2rem)] text-ink-50/94"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={handleClick}
    >
      <button
        className="focus-ring absolute top-[0.6rem] right-[0.6rem] grid size-11 cursor-pointer place-items-center rounded-full border border-violet-300/22 bg-night-950/78 font-[inherit] text-dialog-close text-ink-50/78"
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="min-h-0 overflow-auto overscroll-contain">
        {/* The first lines share the top-right corner with the close button. */}
        <p className="m-0 mb-3 pr-[2.9rem] text-dialog-eyebrow text-violet-300/88 uppercase">{faceLabel}</p>
        <h2
          className="m-0 max-w-[12ch] pr-[2.9rem] text-dialog-title text-ink-50/98 focus:outline-none focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-violet-300/55"
          id="detail-dialog-title"
          ref={titleRef}
          tabIndex={-1}
        >
          {detail.title}
        </h2>
        <RichText as="p" className="mt-4 mb-0 max-w-[42rem] text-dialog-lead text-ink-200/82" html={detail.summary} />
        {detail.points && detail.points.length > 0 && (
          <ul className="mt-[1.35rem] mb-0 grid list-none gap-[0.72rem] border-t border-violet-500/24 px-0 pt-5 pb-0">
            {detail.points.map((point) => (
              <RichText
                as="li"
                className="relative pl-[1.15rem] text-dialog-point text-ink-200/76 before:absolute before:top-[0.58em] before:left-0 before:size-[0.42rem] before:rotate-45 before:bg-violet-300/90 before:shadow-[0_0_12px_color-mix(in_srgb,var(--color-violet-300)_58%,transparent)] before:content-['']"
                key={point}
                html={point}
              />
            ))}
          </ul>
        )}
        {detail.links && detail.links.length > 0 && (
          // An odd last tile spans the row: the 1px gaps are the grid's own
          // background, so an empty cell would show as a violet block.
          <div className="mt-[1.4rem] grid grid-cols-2 gap-px border border-violet-500/18 bg-violet-500/18 narrow:grid-cols-1 [&>*:last-child:nth-child(odd)]:col-span-full">
            {detail.links.map((link) =>
              link.href ? (
                <a className={cx(LINK_TILE, 'focus-ring')} href={link.href} key={link.label} rel="noreferrer" target="_blank">
                  <strong className={LINK_LABEL}>{link.label}</strong>
                  {link.description && <RichText as="span" className={LINK_NOTE} html={link.description} />}
                </a>
              ) : (
                <span className={LINK_TILE} key={link.label}>
                  <strong className={LINK_LABEL}>{link.label}</strong>
                  {link.description && <RichText as="small" className={LINK_NOTE} html={link.description} />}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </dialog>
  )
}

const LINK_TILE = 'grid min-h-[5.8rem] gap-[0.35rem] bg-night-950/90 p-4 text-ink-50/90 no-underline'
const LINK_LABEL = 'text-link-label uppercase'
const LINK_NOTE = 'text-link-note text-ink-200/66'
