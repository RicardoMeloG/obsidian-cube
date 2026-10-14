import type { FeatureGlyphId } from '@/kernel/faces'

// The icons of a face's features, drawn in the face accent (currentColor).
type FeatureGlyphProps = {
  glyph: FeatureGlyphId
}

export function FeatureGlyph({ glyph }: FeatureGlyphProps) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (glyph) {
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 4.5 6v6c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V6L12 3Z" />
          <path d="m8.5 12 2.5 2.5L16 9.5" />
        </svg>
      )
    case 'rocket':
      return (
        <svg {...common}>
          <path d="M5 19c0-4 1-7 4-10s6-4 10-4c0 4-1 7-4 10s-6 4-10 4Z" />
          <circle cx="14.5" cy="9.5" r="1.6" />
          <path d="M5 19s1.5-.5 3-2M9 14l1 1" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M3.5 20.5h17" />
          <path d="M6 17V11M10 17V7M14 17V13M18 17V9" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="1.6" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          <circle cx="12" cy="15.5" r="1.2" />
        </svg>
      )
    default:
      return null
  }
}
