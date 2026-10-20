import { MousePointerClick } from 'lucide-react'
import './cubeNudge.css'

// The invitation to click the cube, once per visitor: a bubble just over the
// cube, a few seconds after it waits untouched (useCubeNudge). Stage layout
// only; it follows the cube when the visitor takes it. Decorative like the
// canvas it sits on: the dock is the way through for assistive technology.
export function CubeNudge({ visible, explore, label }: { visible: boolean; explore: boolean; label: string }) {
  return (
    <p className="cube-nudge" data-visible={visible} data-explore={explore || undefined}>
      <span className="cube-nudge__bubble">
        <MousePointerClick aria-hidden size={16} strokeWidth={1.9} />
        {label}
      </span>
    </p>
  )
}
