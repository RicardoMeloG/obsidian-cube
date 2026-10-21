import { describe, expect, it } from 'vitest'
import { FACE_ORDER } from './faces'
import { pagePath, readPagePath, sitePages } from './sitePaths'

const SITE_PAGES = sitePages()

describe('site paths', () => {
  it('give each language and face a clean path, English at the root', () => {
    expect(pagePath({ locale: 'en', face: null })).toBe('/')
    expect(pagePath({ locale: 'es', face: null })).toBe('/es')
    expect(pagePath({ locale: 'en', face: 'security' })).toBe('/security')
    expect(pagePath({ locale: 'es', face: 'research' })).toBe('/es/investigacion')
  })

  it('read back every page they write, with or without a trailing slash', () => {
    for (const page of SITE_PAGES) {
      const expected = { locale: page.path === '/' ? null : page.locale, face: page.face }
      expect(readPagePath(page.path)).toEqual(expected)
      expect(readPagePath(`${page.path}/`)).toEqual(expected)
    }
  })

  it('name no page for an unknown path or a slug in the other language', () => {
    expect(readPagePath('/seguridad')).toBeNull()
    expect(readPagePath('/es/security')).toBeNull()
    expect(readPagePath('/security/extra')).toBeNull()
    expect(readPagePath('/profile.html')).toBeNull()
  })

  it('write one file per page, each path served by its own file', () => {
    expect(SITE_PAGES).toHaveLength(2 * (FACE_ORDER.length + 1))
    expect(new Set(SITE_PAGES.map((page) => page.file)).size).toBe(SITE_PAGES.length)
    expect(SITE_PAGES[0]).toMatchObject({ path: '/', file: 'index.html' })
    expect(SITE_PAGES.find((page) => page.path === '/es')?.file).toBe('es.html')
    expect(SITE_PAGES.find((page) => page.path === '/es/seguridad')?.file).toBe('es/seguridad.html')
  })
})
