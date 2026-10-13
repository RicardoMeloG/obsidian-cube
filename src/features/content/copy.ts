import type { SiteLocale } from '@/kernel/siteContent'

// Interface strings that are not owner content (ADR 006, AD-07): labels for
// assistive technology, the rotate hint, the dialog's close button. Owner
// content lives in the content documents; nothing here is editable from the
// admin. Components never compare locales themselves (lint rule).
export type InterfaceCopy = {
  experienceLabel: string
  languageLabel: string
  faceStripLabel: string
  researchConceptsLabel: string
  // Shown under a research concept in its dialog.
  conceptSource: string
  close: string
  hintPointer: string
  hintTouch: string
}

const COPY: Record<SiteLocale, InterfaceCopy> = {
  en: {
    experienceLabel: 'Portfolio',
    languageLabel: 'Language',
    faceStripLabel: 'Cube faces',
    researchConceptsLabel: 'Research concepts',
    conceptSource: 'A concept from the private philosophical archive.',
    close: 'Close',
    hintPointer: 'Drag to rotate',
    hintTouch: 'Swipe to rotate',
  },
  es: {
    experienceLabel: 'Portafolio',
    languageLabel: 'Idioma',
    faceStripLabel: 'Caras del cubo',
    researchConceptsLabel: 'Conceptos de investigación',
    conceptSource: 'Concepto curado desde el sistema filosófico privado.',
    close: 'Cerrar',
    hintPointer: 'Arrastra para girar',
    hintTouch: 'Desliza para girar',
  },
}

export function interfaceCopy(locale: SiteLocale): InterfaceCopy {
  return COPY[locale]
}
