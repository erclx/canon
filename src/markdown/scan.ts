/**
 * A fence closes on a run of the same character at least as long as its opener,
 * so a walker toggling on any run would invert the rest of the file.
 */
/** A fence delimiter on a trimmed line, with the run of backticks or tildes captured. */
export const FENCE = /^(`{3,}|~{3,})/

/** Anchored at position 0, so a `---` block inside a fenced template is body. */
const FRONTMATTER = /^---\n[\s\S]*?\n---\n?/

/**
 * Inline code, a link destination, and an autolink, the three spans holding
 * text a reader is shown rather than told. A standard quoting its own banned
 * character would otherwise report itself, and a query string carries a semicolon.
 */
const CODE_SPAN = /(`+)(?:(?!\1).)*\1/g

/**
 * A destination body, reaching one level of balanced parentheses so `file(1).md`
 * is not truncated at its first close paren, which `src/markdown/links.ts` would
 * report broken. CommonMark permits matched parentheses, and one level suffices here.
 */
const LINK_TARGET = String.raw`(?:[^()]|\([^()]*\))*`
const LINK_DESTINATION = new RegExp(String.raw`\]\(${LINK_TARGET}\)`, 'g')
const AUTOLINK = /<[^>\s]+>/g

/**
 * An HTML character reference by shape, whose closing semicolon is part of the
 * reference rather than prose. Only `scanBans` blanks it, a name takes two
 * characters at least, and a reference no browser knows is blanked too.
 */
const CHARACTER_REFERENCE =
  /&(?:[A-Za-z][A-Za-z0-9]{1,31}|#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6});/g

/**
 * A whole inline link, capturing the anchor text a reader is shown. The narrower
 * pattern still runs after, since a link wrapped across lines never matches here.
 * Take it through `replace` or `matchAll`, which clone it, since `test` mutates `lastIndex`.
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
 * Marks which lines sit inside a fence without dropping them. The depth measure
 * skips a fenced line, bullet folding treats one as a break, and the ban scan
 * ignores it, so returning the mark lets one walk serve all three.
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
 * Counts whitespace-delimited tokens, the unit a record's word cap is stated in.
 * A code span counts as the tokens it holds, and a caller gating on the count
 * hands in prose with fenced lines dropped.
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
 * Blanks an inline code span alone, holding its width. Split from
 * `maskDisplayed` for a reader who wants the narrower exclusion, since a link
 * destination may carry the very token that reader is after.
 */
export function maskCodeSpans(text: string): string {
  return text.replace(CODE_SPAN, blank)
}

/**
 * Replaces displayed spans with spaces of equal width, so a reported column
 * points at the character an editor puts the cursor on, which a plain deletion
 * would shift left.
 */
export function maskDisplayed(text: string): string {
  return maskCodeSpans(text)
    .replace(LINK_DESTINATION, blank)
    .replace(AUTOLINK, blank)
}

/**
 * Drops the spans a reader is never shown, returning the text they read. A
 * weight measure counts this rather than `maskDisplayed`, since a backticked
 * path stays counted here, and a code span is walked around so a placeholder is not cut.
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
 * character reference. Characters are the whole set, since a word carries honest
 * uses no match separates and is guidance rather than a finding.
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
