/**
 * A fence opens on a run of three or more backticks or tildes and closes on a
 * run of the same character at least as long. Length matters: a ```` block
 * displaying a ``` example closes on neither of the inner delimiters, and a
 * walker toggling on any run reads the second inner fence as an opening and
 * inverts the rest of the file.
 */
/** A fence delimiter on a trimmed line, with the run of backticks or tildes captured. */
export const FENCE = /^(`{3,}|~{3,})/

/** Anchored at position 0, so a `---` block inside a fenced template is body. */
const FRONTMATTER = /^---\n[\s\S]*?\n---\n?/

/**
 * Inline code, a link destination, and an autolink, the three spans holding
 * text a reader is shown rather than told.
 *
 * The bans this masking serves are stated with backticked examples, so a
 * standard quoting its own banned character would report itself without it. A
 * link destination is masked because a query string carries a semicolon that no
 * rewrite of the sentence can remove.
 */
const CODE_SPAN = /(`+)(?:(?!\1).)*\1/g

/**
 * A destination body, reaching one level of balanced parentheses so
 * `file(1).md` is not truncated at its first close paren. A plain `[^)]*`
 * ends the whole match there, which reads a legitimate destination as
 * unterminated and, in `src/markdown/links.ts`, reports it broken. CommonMark
 * permits an unescaped destination to carry matched parentheses, and one
 * level is what every destination measured in this corpus needs.
 */
const LINK_TARGET = String.raw`(?:[^()]|\([^()]*\))*`
const LINK_DESTINATION = new RegExp(String.raw`\]\(${LINK_TARGET}\)`, 'g')
const AUTOLINK = /<[^>\s]+>/g

/**
 * An HTML character reference by shape, whose closing semicolon is part of the
 * reference rather than prose.
 *
 * Only `scanBans` blanks it, so the colon and heading checks are unchanged. A
 * name takes two characters at least, so `R&D; then` keeps a prose semicolon.
 * No lookbehind refuses a letter before the ampersand, since `project&gt;` is
 * the case this exists for, which lets `Q&As; then` pass. A reference no
 * browser knows is blanked too, since a closed name list is a table to keep.
 */
const CHARACTER_REFERENCE =
  /&(?:[A-Za-z][A-Za-z0-9]{1,31}|#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6});/g

/**
 * A whole inline link, capturing the anchor text a reader is shown.
 *
 * `LINK_DESTINATION` covers the span both measures drop and this the brackets
 * only the weight measure drops. The narrower pattern still runs after, since a
 * link wrapped across lines never matches here. Exported so
 * `src/markdown/links.ts` shares it. Take it through `replace` or `matchAll`
 * alone, which clone it, since `test` or `exec` would mutate `lastIndex`.
 */
export const LINK = new RegExp(String.raw`\[([^\]]*)\]\(${LINK_TARGET}\)`, 'g')

export interface BodyLine {
  readonly number: number
  readonly text: string
  /** True on a fence delimiter and on every line between one pair. */
  readonly fenced: boolean
}

export type BanKind = 'character'

export interface BanFinding {
  readonly line: number
  readonly column: number
  readonly kind: BanKind
  /** The term as the standard states it, so a report names what to look up. */
  readonly term: string
}

export interface BanSets {
  readonly characters: readonly string[]
}

/**
 * Marks which lines sit inside a fence without dropping them.
 *
 * Each measure excludes a fence for its own reason and needs a different
 * response. The depth measure skips a fenced line so an example cannot break
 * the run around it, bullet folding treats one as a break so a bullet does not
 * absorb the block below it, and the ban scan ignores it outright. Returning
 * the mark rather than a filtered list is what lets one walk serve all three.
 */
function markFences(texts: readonly string[], offset: number): BodyLine[] {
  const lines: BodyLine[] = []
  let fence: string | undefined

  for (const [index, text] of texts.entries()) {
    const match = FENCE.exec(text.trim())
    let fenced = false

    if (fence) {
      fenced = true
      const closes =
        match && match[1][0] === fence[0] && match[1].length >= fence.length
      if (closes) fence = undefined
    } else if (match) {
      fenced = true
      fence = match[1]
    }

    lines.push({ number: offset + index + 1, text, fenced })
  }

  return lines
}

/**
 * Drops the frontmatter while keeping every surviving line's original number,
 * so a finding points at the line an editor opens rather than at an offset into
 * the body.
 */
export function bodyLines(source: string): BodyLine[] {
  const match = source.match(FRONTMATTER)
  const offset = match ? match[0].split('\n').length - 1 : 0

  return markFences(
    source
      .slice(match ? match[0].length : 0)
      .replace(/\n$/, '')
      .split('\n'),
    offset,
  )
}

/**
 * Counts whitespace-delimited tokens, the unit a record's word cap is stated
 * in. A code span counts as the tokens it holds, so a line citing a long path
 * pays for it the way a reader does. A caller gating on the count hands in
 * prose with fenced lines already dropped.
 */
export function wordCount(text: string): number {
  return text.match(/\S+/g)?.length ?? 0
}

/**
 * Drops every fenced block from raw text, frontmatter included as content.
 *
 * The record validators read whole files whose frontmatter is part of what they
 * check, so this walks the source as given rather than through `bodyLines`.
 */
export function linesOutsideFences(text: string): string[] {
  return markFences(text.split('\n'), 0)
    .filter((line) => !line.fenced)
    .map((line) => line.text)
}

/** Blanks a span while holding its width, so a column stays where it was. */
function blank(match: string): string {
  return ' '.repeat(match.length)
}

/**
 * Blanks an inline code span alone, holding its width.
 *
 * Split from `maskDisplayed` for a reader who wants the narrower exclusion.
 * A link destination often carries the one thing such a reader is after, such
 * as a version-shaped token inside a generated compare link, where a code
 * span is uniformly a quotation and never the claim itself.
 */
export function maskCodeSpans(text: string): string {
  return text.replace(CODE_SPAN, blank)
}

/**
 * Replaces displayed spans with spaces of equal width.
 *
 * Equal width is what keeps a reported column pointing at the character an
 * editor puts the cursor on, which a plain deletion would shift left by
 * everything masked ahead of it on the line.
 */
export function maskDisplayed(text: string): string {
  return maskCodeSpans(text)
    .replace(LINK_DESTINATION, blank)
    .replace(AUTOLINK, blank)
}

/**
 * Drops the spans a reader is never shown, returning the text they read.
 *
 * This is what a weight measure counts, and deliberately not `maskDisplayed`,
 * which holds each span's width for a ban column. The two also differ on the
 * span set, since a backticked path stays counted here while the ban scan
 * blanks it. Each is right for its measure, so they stay two helpers. A code
 * span is walked around rather than through, so a placeholder such as
 * `canon/context/<domain>.md` is not cut by the autolink pattern.
 */
export function visibleText(text: string): string {
  const drop = (segment: string): string =>
    segment
      .replace(LINK, '$1')
      .replace(LINK_DESTINATION, '')
      .replace(AUTOLINK, '')

  let visible = ''
  let read = 0

  for (const span of text.matchAll(CODE_SPAN)) {
    visible += drop(text.slice(read, span.index)) + span[0]
    read = span.index + span[0].length
  }

  return visible + drop(text.slice(read))
}

/**
 * Finds every banned character outside a fence, a code span, a link, and a
 * character reference.
 *
 * Characters are the whole set because a character is the one class a literal
 * match settles. A word carries honest uses no match separates, which is why
 * word choice is guidance a reader applies rather than a finding this reports.
 */
export function scanBans(
  lines: readonly BodyLine[],
  bans: BanSets,
): BanFinding[] {
  const found: BanFinding[] = []

  for (const line of lines) {
    if (line.fenced) continue
    const text = maskDisplayed(line.text).replace(CHARACTER_REFERENCE, blank)

    for (const term of bans.characters) {
      let column = text.indexOf(term)
      while (column !== -1) {
        found.push({ line: line.number, column, kind: 'character', term })
        column = text.indexOf(term, column + term.length)
      }
    }
  }

  return found.sort((a, b) => a.line - b.line || a.column - b.column)
}
