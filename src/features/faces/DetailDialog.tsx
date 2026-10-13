import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { CubeSectionDetail } from '@/kernel/faces'
import { RichText } from '@/features/content/RichText'

type DetailDialogProps = {
  detail: CubeSectionDetail
  faceLabel: string
  closeLabel: string
  onClose: () => void
  // The page around the dialog, made inert while it is open.
  shellRef: RefObject<HTMLElement | null>
  // The control that opened the dialog; focus returns to it on close.
  restoreFocusRef: RefObject<HTMLElement | null>
}

// The long form of a face (or a research concept) over the page. While open,
// everything behind it is `inert` (no focus, no assistive-tech reading, no
// pointer), the page scroll is locked, focus lands on the title, Tab cycles
// inside the panel and Escape closes. On close by any path the page is
// restored and focus returns to the control that opened it. Styled by App.css
// until it becomes a native <dialog> (spec 010, P4).
export function DetailDialog({ detail, faceLabel, closeLabel, onClose, shellRef, restoreFocusRef }: DetailDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const panel = panelRef.current
    const shell = shellRef.current
    const inerted: Element[] = []
    if (shell && dialog) {
      for (const child of Array.from(shell.children)) {
        if (child !== dialog && !child.hasAttribute('inert')) {
          child.setAttribute('inert', '')
          inerted.push(child)
        }
      }
    }
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
      if (event.key !== 'Tab' || !panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')).filter(
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
      // Focus on the title, on the scrim, on <body> or anywhere outside the
      // panel counts as a boundary in both directions.
      const outside = !(active instanceof Element) || !panel.contains(active) || active === titleRef.current
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
      root.style.overflow = previousOverflow
      inerted.forEach((element) => element.removeAttribute('inert'))
      const restore = restoreFocusRef.current
      restoreFocusRef.current = null
      if (restore && restore.isConnected) restore.focus()
    }
  }, [onClose, restoreFocusRef, shellRef])

  return (
    <div className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title" ref={dialogRef}>
      {/* Pointer-only backdrop: not focusable, not announced. Keyboard and
          assistive tech close through the labelled button or Escape. */}
      <div className="detail-modal__scrim" aria-hidden="true" onClick={onClose} />
      <article className="detail-modal__panel" ref={panelRef}>
        <button className="detail-modal__close" type="button" aria-label={closeLabel} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
        <div className="detail-modal__body">
          <p className="detail-modal__eyebrow">{faceLabel}</p>
          <h2 id="detail-modal-title" ref={titleRef} tabIndex={-1}>
            {detail.title}
          </h2>
          <RichText as="p" className="detail-modal__summary" html={detail.summary} />
          {detail.points && detail.points.length > 0 && (
            <ul className="detail-modal__points">
              {detail.points.map((point) => (
                <RichText as="li" key={point} html={point} />
              ))}
            </ul>
          )}
          {detail.links && detail.links.length > 0 && (
            <div className="detail-modal__links">
              {detail.links.map((link) =>
                link.href ? (
                  <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
                    <strong>{link.label}</strong>
                    {link.description && <RichText as="span" html={link.description} />}
                  </a>
                ) : (
                  <span key={link.label}>
                    <strong>{link.label}</strong>
                    {link.description && <RichText as="small" html={link.description} />}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      </article>
    </div>
  )
}
