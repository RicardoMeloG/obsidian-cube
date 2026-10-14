import { useEffect, useMemo, useState } from 'react'
import { getDefaultSiteContent, normalizeSections } from '@/kernel/siteContent'
import type { SiteContent, SiteLocale } from '@/kernel/siteContent'
import { loadSiteContent, resolveSiteLocale } from './loadContent'

export function useSiteContent() {
  const [locale, setLocale] = useState<SiteLocale>(() => resolveSiteLocale())
  const [content, setContent] = useState<SiteContent>(() => getDefaultSiteContent(resolveSiteLocale()))
  const sections = useMemo(() => normalizeSections(content.sections, content.locale), [content.sections, content.locale])

  useEffect(() => {
    let isCurrent = true

    void loadSiteContent(locale).then((loadedContent) => {
      if (isCurrent) {
        setContent(loadedContent)
        document.title = loadedContent.seo.title
      }
    })

    return () => {
      isCurrent = false
    }
  }, [locale])

  function changeLocale(nextLocale: SiteLocale) {
    setLocale(nextLocale)

    const url = new URL(window.location.href)
    url.searchParams.set('lang', nextLocale)
    window.history.replaceState({}, '', url)
  }

  return {
    content,
    locale,
    sections,
    setLocale: changeLocale,
  }
}
