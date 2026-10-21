import { useEffect, useMemo, useState } from 'react'
import { getDefaultSiteContent, normalizeSections } from '@/kernel/siteContent'
import type { SiteContent, SiteLocale } from '@/kernel/siteContent'
import { loadSiteContent, rememberLocale, resolveSiteLocale } from './loadContent'

export function useSiteContent() {
  const [locale, setLocale] = useState<SiteLocale>(() => resolveSiteLocale())
  const [content, setContent] = useState<SiteContent>(() => getDefaultSiteContent(resolveSiteLocale()))
  // False while the page shows the bundled example, before the first load.
  const [ready, setReady] = useState(false)
  const sections = useMemo(() => normalizeSections(content.sections, content.locale), [content.sections, content.locale])

  useEffect(() => {
    let isCurrent = true

    void loadSiteContent(locale).then((loadedContent) => {
      if (!isCurrent) return
      setContent(loadedContent)
      setReady(true)
    })

    return () => {
      isCurrent = false
    }
  }, [locale])

  // Screen readers and translators read the page in its language.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  // The address follows the content (faceUrl.ts); the choice is remembered
  // for the bare address.
  function changeLocale(nextLocale: SiteLocale) {
    setLocale(nextLocale)
    rememberLocale(nextLocale)
  }

  return {
    content,
    ready,
    locale,
    sections,
    setLocale: changeLocale,
  }
}
