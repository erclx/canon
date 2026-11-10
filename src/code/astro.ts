/**
 * Splits an `.astro` file into the parts that can carry another language
 * inline, each with the line it opens on in the file.
 *
 * Astro's compiler would give exact bounds, but it is not a dependency of the
 * published CLI, so the reader leans on the three shapes the format fixes: a
 * frontmatter fence that opens the file, a `set:html` binding on a tag, and an
 * `is:inline` script whose body Astro passes through untouched.
 */

export interface AstroFrontmatter {
  /** The file's text with everything outside the frontmatter blanked, so a line number read from it is the file's own. */
  readonly source: string
  /** The offset in the file just past the closing fence. */
  readonly end: number
}

export interface AstroBinding {
  readonly tag: 'script' | 'style'
  /** The frontmatter identifier the tag's `set:html` reads. */
  readonly name: string
  readonly line: number
}

export interface AstroInlineScript {
  /** The line the opening tag sits on. */
  readonly line: number
  readonly body: string
}

const FENCE = /^---[ \t]*$/

/**
 * The frontmatter, read only from a fence on the file's first line that is
 * not blank. A `---` anywhere else is template text or a string, never a
 * fence, which is how the compiler reads it too.
 */
export function astroFrontmatter(source: string): AstroFrontmatter | undefined {
  const lines = source.split('\n')
  const open = lines.findIndex((line) => line.trim() !== '')
  if (open === -1 || !FENCE.test(lines[open] ?? '')) return undefined

  const close = lines.findIndex(
    (line, index) => index > open && FENCE.test(line),
  )
  if (close === -1) return undefined

  const kept = lines.map((line, index) =>
    index > open && index < close ? line : '',
  )
  const end = lines
    .slice(0, close + 1)
    .reduce((sum, line) => sum + line.length + 1, 0)
  return { source: kept.join('\n'), end }
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length
}

function templateStart(source: string): number {
  return astroFrontmatter(source)?.end ?? 0
}

const OPENING_TAG = /<(script|style)\b([^>]*)>/gi
// Only a bare identifier names a frontmatter string. An expression such as
// `JSON.stringify(data)` builds its value at render, so no literal sits behind it.
const SET_HTML = /\bset:html\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/

/** Every `<script>` or `<style>` in the template whose `set:html` reads a frontmatter identifier. */
export function astroBindings(source: string): AstroBinding[] {
  const start = templateStart(source)
  const template = source.slice(start)
  const bindings: AstroBinding[] = []
  for (const match of template.matchAll(OPENING_TAG)) {
    const name = SET_HTML.exec(match[2] ?? '')?.[1]
    if (name === undefined) continue
    bindings.push({
      tag: (match[1] ?? '').toLowerCase() === 'style' ? 'style' : 'script',
      name,
      line: lineAt(source, start + match.index),
    })
  }
  return bindings
}

const SCRIPT_OPEN = /<script\b([^>]*)>/gi
const SCRIPT_CLOSE = /<\/script\s*>/i
// A type naming anything but JavaScript, such as a JSON data block, holds no program.
const SCRIPT_TYPE =
  /\btype\s*=\s*["']\s*(?:module|(?:text|application)\/javascript)?\s*["']/i
const ANY_TYPE = /\btype\s*=/i

/** The attribute names on a tag, with every value, quoted or braced, removed. */
function attributeNames(attributes: string): string[] {
  let bare = attributes.replace(/"[^"]*"|'[^']*'/g, '')
  while (/\{[^{}]*\}/.test(bare)) bare = bare.replace(/\{[^{}]*\}/g, '')
  return bare
    .split(/[\s=/]+/)
    .filter((name) => /^[A-Za-z_:@][\w:.@-]*$/.test(name))
}

/**
 * Every script body Astro passes through unprocessed. Astro bundles a
 * `<script>` carrying no attribute or `src` alone, and inlines any other,
 * whether the attribute is `is:inline`, `type="module"`, or `define:vars`,
 * which implies `is:inline`.
 */
export function astroInlineScripts(source: string): AstroInlineScript[] {
  const start = templateStart(source)
  const template = source.slice(start)
  const scripts: AstroInlineScript[] = []
  for (const match of template.matchAll(SCRIPT_OPEN)) {
    const attributes = match[1] ?? ''
    if (attributes.trimEnd().endsWith('/')) continue
    if (ANY_TYPE.test(attributes) && !SCRIPT_TYPE.test(attributes)) continue
    if (attributeNames(attributes).every((name) => name === 'src')) continue

    const from = match.index + match[0].length
    const close = SCRIPT_CLOSE.exec(template.slice(from))
    scripts.push({
      line: lineAt(source, start + match.index),
      body: template.slice(from, close ? from + close.index : undefined),
    })
  }
  return scripts
}
