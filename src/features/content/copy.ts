import type { SiteLocale } from '@/kernel/siteContent'

// Interface strings that are not owner content (ADR 006, AD-07): labels for
// assistive technology, the rotate hint, the dialog's close button. Owner
// content lives in the content documents; nothing here is editable from the
// admin. Components never compare locales themselves (lint rule).
export type InterfaceCopy = {
  experienceLabel: string
  languageLabel: string
  faceStripLabel: string
  close: string
  hintPointer: string
  hintTouch: string
  // The stage (spec 011): the button that brings the cube forward, its
  // way back and the hint while exploring, and the top bar's way to CONTACT.
  explore: string
  exploreBack: string
  exploreHint: string
  // The bubble that invites the first click on the cube, once per visitor.
  nudge: string
  contactLink: string
  githubLink: string
  linkedinLink: string
}

const COPY: Record<SiteLocale, InterfaceCopy> = {
  en: {
    experienceLabel: 'Portfolio',
    languageLabel: 'Language',
    faceStripLabel: 'Cube faces',
    close: 'Close',
    hintPointer: 'Drag to rotate',
    hintTouch: 'Swipe to rotate',
    explore: 'Explore the cube',
    exploreBack: 'Back to the content',
    exploreHint: 'Drag to rotate · click a face to open it · Esc to go back',
    nudge: 'Click me!',
    contactLink: 'Email',
    githubLink: 'GitHub',
    linkedinLink: 'LinkedIn',
  },
  es: {
    experienceLabel: 'Portafolio',
    languageLabel: 'Idioma',
    faceStripLabel: 'Caras del cubo',
    close: 'Cerrar',
    hintPointer: 'Arrastra para girar',
    hintTouch: 'Desliza para girar',
    explore: 'Explorar el cubo',
    exploreBack: 'Volver al contenido',
    exploreHint: 'Arrastra para girar · haz clic en una cara para abrirla · Esc para volver',
    nudge: '¡Haz clic!',
    contactLink: 'Correo',
    githubLink: 'GitHub',
    linkedinLink: 'LinkedIn',
  },
}

export function interfaceCopy(locale: SiteLocale): InterfaceCopy {
  return COPY[locale]
}
