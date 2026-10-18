import type { CSSProperties } from 'react'

// Order in which a block rises when the face enters (stage.css).
export const rise = (order: number) => ({ '--i': order }) as CSSProperties

// Two-digit position, as the stage shows it: 01, 02…
export const ordinal = (index: number) => String(index + 1).padStart(2, '0')
