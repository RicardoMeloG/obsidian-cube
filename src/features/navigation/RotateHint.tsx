// The invitation to drag the cube, just under it, until the first drag of the
// session. Styled by App.css (`cube-hint`, also used by the intro) until P4.
export function RotateHint({ visible, label }: { visible: boolean; label: string }) {
  return (
    <p className="cube-hint" data-visible={visible}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 13.5a8 4.5 0 0 0 15 0" />
        <path d="M16.6 16.4l2.9-2.9 0.6 4" />
      </svg>
      <span>{label}</span>
    </p>
  )
}
