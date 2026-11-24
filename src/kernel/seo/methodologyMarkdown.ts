// The Markdown of the methodology page (spec 022, D-5): a fixed subset, parsed
// by hand so the kernel keeps depending on zod only (ADR 005). Headings to
// three levels, paragraphs, flat lists, bold, code and links; a figure and the
// counts by name. Anything else throws, so a page is never published with
// syntax that was silently read as text. Raw HTML is not part of it.
import { isAllowedHref } from '../links'
import { escapeHtml } from './renderSeo'

export type MarkdownOptions = {
  /** The repository's public address, which repository links point into. */
  repositoryUrl: string
  /** `{{name}}` in the text. */
  values: Record<string, string>
  /** `{{figure:name}}` on a line of its own, already rendered as HTML. */
  figures: Record<string, string>
}

// The text lives two folders under the repository's root, so its links also
// work where GitHub shows the file. A folder's link ends in a slash.
const REPOSITORY_LINK = /^\.\.\/\.\.\/((?:[\w.-]+\/)*[\w.-]*)$/

/** The repository path a link names, or null when it names none. */
export function repositoryPath(href: string): string | null {
  const path = REPOSITORY_LINK.exec(href)?.[1]
  return path && !path.split('/').includes('..') ? path : null
}

function resolveLink(href: string, repositoryUrl: string): string {
  const path = repositoryPath(href)
  if (path) return path.endsWith('/') ? `${repositoryUrl}/tree/main/${path.slice(0, -1)}` : `${repositoryUrl}/blob/main/${path}`
  if (/^(https:|\/)/i.test(href) && isAllowedHref(href)) return href
  throw new Error(`[methodology] link not allowed: ${href}`)
}

// What is left once bold, code, links and counts are read must be plain text.
const SYNTAX = /[*_`<>[\]\\{}]/

function renderText(text: string): string {
  if (SYNTAX.test(text)) throw new Error(`[methodology] syntax outside the subset: ${text.trim()}`)
  return escapeHtml(text)
}

const INLINE = /\*\*(?<bold>[^*]+)\*\*|`(?<code>[^`]+)`|(?<image>!?)\[(?<label>[^\]]+)\]\((?<href>[^()\s]+)\)|\{\{(?<value>\w+)\}\}/g

function renderInline(text: string, options: MarkdownOptions): string {
  let html = ''
  let end = 0
  for (const match of text.matchAll(INLINE)) {
    html += renderText(text.slice(end, match.index))
    end = match.index + match[0].length
    const { bold, code, image, label, href, value } = match.groups!
    if (bold !== undefined) html += `<strong>${renderInline(bold, options)}</strong>`
    else if (code !== undefined) html += `<code>${escapeHtml(code)}</code>`
    else if (label !== undefined) {
      if (image) throw new Error(`[methodology] images are outside the subset: ${match[0]}`)
      html += `<a href="${escapeHtml(resolveLink(href, options.repositoryUrl))}">${renderInline(label, options)}</a>`
    } else {
      if (!Object.hasOwn(options.values, value)) throw new Error(`[methodology] unknown placeholder: ${match[0]}`)
      html += escapeHtml(options.values[value])
    }
  }
  return html + renderText(text.slice(end))
}

const HEADING = /^(#{1,3}) (\S.*)$/
const FIGURE = /^\{\{figure:(\w+)\}\}$/
const BULLET = /^- (\S.*)$/
const NUMBER = /^(\d+)\. (\S.*)$/
// Blocks Markdown knows and the subset does not: indentation (nested lists,
// code), quotes, tables, rules, fences, other bullets, deeper headings. A
// paragraph line may not start like a list item either.
const OTHER_BLOCK = /^(\s|>|\||#|-|\+|\d+[.)]\s|={3,}|~{3,})/

function renderList(lines: string[], pattern: RegExp, tag: 'ul' | 'ol', options: MarkdownOptions): string {
  const items = lines.map((line, index) => {
    const match = pattern.exec(line)
    if (!match) throw new Error(`[methodology] a list item takes one line: ${line}`)
    if (tag === 'ol' && Number(match[1]) !== index + 1) throw new Error(`[methodology] list out of order: ${line}`)
    return `<li>${renderInline(match.at(-1)!, options)}</li>`
  })
  return `<${tag}>\n${items.join('\n')}\n</${tag}>`
}

function renderBlock(block: string, options: MarkdownOptions): string {
  const lines = block.split('\n')
  const [first] = lines
  if (BULLET.test(first)) return renderList(lines, BULLET, 'ul', options)
  if (NUMBER.test(first)) return renderList(lines, NUMBER, 'ol', options)
  const heading = HEADING.exec(first)
  const figure = FIGURE.exec(first)
  if ((heading || figure) && lines.length > 1) throw new Error(`[methodology] a blank line must follow: ${first}`)
  if (heading) return `<h${heading[1].length}>${renderInline(heading[2], options)}</h${heading[1].length}>`
  if (figure) {
    if (!Object.hasOwn(options.figures, figure[1])) throw new Error(`[methodology] unknown figure: ${first}`)
    return options.figures[figure[1]]
  }
  for (const line of lines) if (OTHER_BLOCK.test(line)) throw new Error(`[methodology] block outside the subset: ${line}`)
  return `<p>${renderInline(lines.join(' '), options)}</p>`
}

// A line of spaces is a blank line to Markdown.
const blocksOf = (markdown: string) =>
  markdown
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]+$/gm, '')
    .replace(/^\n+|\s+$/g, '')
    .split(/\n{2,}/)

export function renderMarkdown(markdown: string, options: MarkdownOptions): string {
  return blocksOf(markdown)
    .map((block) => renderBlock(block, options))
    .join('\n')
}

/** The page's title: the first block, the text's only first-level heading. */
export function markdownTitle(markdown: string): string {
  const [first, ...rest] = blocksOf(markdown)
  const title = /^# (\S.*)$/.exec(first)?.[1]
  if (!title || SYNTAX.test(title) || rest.some((block) => /^# /.test(block))) {
    throw new Error('[methodology] the text starts with its one first-level heading, in plain text')
  }
  return title
}

/** Every link target of the text, in order. */
export function markdownLinks(markdown: string): string[] {
  return [...markdown.matchAll(INLINE)].flatMap((match) => (match.groups!.href ? [match.groups!.href] : []))
}
