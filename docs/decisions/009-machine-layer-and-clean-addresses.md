# 009: A Layer for Machines and Clean Addresses

**Status:** accepted
**Date:** 2026-10-20 (decided during the content stage; recorded as an ADR on 2026-11-12)

## Context

Most visitors of a portfolio never run its JavaScript: search engines index the raw HTML, AI crawlers and answer engines read it without executing scripts, link previews read its meta tags, and sourcing tools match titles and skills literally. Until the content stage the built `index.html` carried a short JSON-LD `Person` and one title for the whole site, and the face and language lived in query parameters (`?lang=es`), so a shared link could not open on a face and Spanish had no address to index.

A link that passes the publish rule (an `https:` scheme) may still not open for a stranger: a private repository or a login page reads as the opposite of evidence.

## Decision

1. **A layer for machines, with the same facts and more depth.** Machines may get longer and more structured text than the faces, because it has no layout to fit, but never different claims: showing crawlers what people do not see is cloaking. Every recognised title and skill is named once, in a structure, never repeated as keyword stuffing.
   - `/llms.txt` (the llmstxt.org convention, English) and two plain profile pages, `/profile.html` and `/profile.es.html`, each naming the other and linked from the site, so a person can open them too.
   - The fuller JSON-LD (`ProfilePage`, the `Person`, the public works as `SoftwareSourceCode` or `CreativeWork`) lives in the profile pages; `index.html` keeps its short `Person`, so the first view does not grow.
   - The text comes from a document of its own per language, `profile.{en,es}.json` (gitignored; examples committed), edited in the admin and rendered at build time by `src/kernel/seo/renderMachine.ts`. A document of its own, not a block of the site document, because the site bundles its example: inside it, the profile took the first view 0.6 KB over its limit (measured 2026-10-20).
2. **Clean addresses: one static page per language and face.** English at the root (`/`, `/agentic`, `/products`, `/systems`, `/security`, `/research`, `/contact`), Spanish under `/es` (`/es/agentico`, `/es/productos`, …). The slugs are a public contract in `src/kernel/sitePaths.ts` and never follow the content's labels.
   - The build writes one HTML file per page with its `lang`, title (`<face title> | <name>`), description, share preview and plain body; with `seo.siteUrl` set, each page carries its canonical and `hreflang` alternates. Every face heading of the plain body links its page, so a crawler that does not run JavaScript reaches all fourteen.
   - The browser keeps the address and the title in step with `history.replaceState`; there is no router. The bare `/` opens in the language the visitor last chose, otherwise in `navigator.language`.
   - The address bar never shows a query: review parameters are read on arrival and removed, development tools keep theirs only in development.
   - CloudFront serves each path from its file through a viewer-request function (`infra/lib/static-site-stack.ts`).
3. **An artifact opens for a stranger.** `npm run report:objective` reads the published documents and the built pages, requests every artifact link without credentials and reports, per face, the host and the status, never the text; it also checks that the raw HTML names the person, the role, the keywords and the links, and that the description does not say "prototype". It is a local report, not a CI gate, because CI has no private content.

## Consequences

- Every page is a first view, so `check:budget` measures the heaviest of the fourteen; the Spanish pages, with longer text, are the heaviest, and the limit rose by 0.7 KB for the code that reads and writes the addresses (`scripts/checks/budget.json`).
- A build without the private documents (CI) renders the pages and the machine files from the example content.
- `robots.txt` admitting the AI crawlers by name and `sitemap.xml` with the fourteen pages and their alternates need the domain; they came after the first release (2026-11-13, `src/kernel/seo/crawlFiles.ts`), and CloudFront's viewer-response function names UTF-8 on text responses S3 serves without a charset, `llms.txt` among them (spec 014, D-7).
- Rejected: a single address with the language kept in the browser (no link opens on a face, and Spanish has nothing to index); fragments (`/#seguridad`), which search engines ignore.
