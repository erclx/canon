import { Marked, type Tokens } from 'marked'

const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const thumb = (alt: string) => `<span class="thumb">${escape(alt)}</span>`

/**
 * Raw HTML in a record never reaches the page as a live tag. An image keeps its
 * alt as a placeholder, a `details` keeps its summary as a line, and a line
 * break reads as a space, since a sheet is read rather than clicked through.
 */
function rawHtml(html: string, block: boolean): string {
  if (/^<br\s*\/?>$/i.test(html.trim())) return ' '
  const parts: string[] = []
  for (const match of html.matchAll(
    /<img\b[^>]*?\balt="([^"]*)"[^>]*>|<summary>([\s\S]*?)<\/summary>/gi,
  )) {
    if (match[1] !== undefined) parts.push(thumb(match[1]))
    else if (block) parts.push(`<p class="sum">${escape(match[2] ?? '')}</p>`)
  }
  return parts.join('')
}

const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }: Tokens.Heading) {
      const text = this.parser.parseInline(tokens)
      return depth === 1 ? `<h4 class="t">${text}</h4>` : `<h4>${text}</h4>`
    },
    listitem(item: Tokens.ListItem) {
      const text = this.parser.parse(item.tokens).trim()
      if (!item.task) return `<li>${text}</li>`
      const box = item.checked
        ? '<span class="box x" role="img" aria-label="done"></span>'
        : '<span class="box" role="img" aria-label="not done"></span>'
      return `<li class="ck">${box}<span>${text}</span></li>`
    },
    checkbox() {
      return ''
    },
    strong({ tokens }: Tokens.Strong) {
      return `<b>${this.parser.parseInline(tokens)}</b>`
    },
    link({ tokens, text, autolink }: Tokens.Link) {
      const label = autolink ? escape(text) : this.parser.parseInline(tokens)
      return `<span class="ln">${label}</span>`
    },
    image({ text }: Tokens.Image) {
      return thumb(text)
    },
    html({ text, block }: Tokens.HTML | Tokens.Tag) {
      return rawHtml(text, block)
    },
  },
})

/** The `key: value` lines between a leading pair of `---` fences, a quoted value unwrapped. */
function frontmatter(source: string): {
  fields: [string, string][]
  body: string
} {
  const fence = /^---\n([\s\S]*?)\n---\n/.exec(source)
  if (!fence) return { fields: [], body: source }
  const fields: [string, string][] = []
  for (const line of (fence[1] ?? '').split('\n')) {
    const at = line.indexOf(':')
    if (at < 1) continue
    const value = line.slice(at + 1).trim()
    const quoted = /^(['"])([\s\S]*)\1$/.exec(value)
    fields.push([line.slice(0, at).trim(), quoted ? (quoted[2] ?? '') : value])
  }
  return { fields, body: source.slice(fence[0].length) }
}

/** The whitespace marked writes after a block, which would set a gap between inline siblings. */
const BLOCK_BREAK =
  /(<\/(?:p|ul|ol|li|h4|table|thead|tbody|tr|th|td|dl|blockquote|pre)>|<(?:ul|ol|table|thead|tbody|tr|blockquote)>)\n+/g

/**
 * A record's markdown as the body of a sheet in the records fan, in the markup
 * the fan's stylesheet sets: the frontmatter as `dl.fm`, the title as `h4.t`,
 * a task item as `li.ck` with its `.box`, and an image as a labeled `.thumb`.
 */
export function renderRecord(source: string): string {
  const { fields, body } = frontmatter(source)
  const head = fields.length
    ? `<dl class="fm">${fields.map(([key, value]) => `<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>`
    : ''
  const html = marked.parse(body, { async: false })
  return (head + html).replace(BLOCK_BREAK, '$1').trim()
}
