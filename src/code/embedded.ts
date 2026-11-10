import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { plural } from '@/cli/ui'
import {
  astroBindings,
  astroFrontmatter,
  astroInlineScripts,
} from '@/code/astro'
import type { Emission, Measure } from '@/gate/measures'
import { listRepositoryFiles } from '@/git/files'
import { escapeForPattern, isMarked } from '@/sweep/exempt-marker'

export const EMBEDDED_MARKER = 'canon-allow-embedded'

/**
 * Static lines a page, stylesheet, or script may hold inline. Matches the
 * limit `governance/rules/tooling/ci-workflow.md` sets on a `run:` step, so a
 * sixth line is where a block leaves for its own file.
 */
export const EMBEDDED_LINE_LIMIT = 5

export type EmbeddedKind = 'page' | 'stylesheet' | 'script'

export interface EmbeddedBlock {
  readonly file: string
  readonly line: number
  readonly kind: EmbeddedKind
  readonly lines: number
  /** A script that branches counts at any length, so the finding says which. */
  readonly branches: boolean
}

interface Literal {
  readonly line: number
  /** Offsets of the opening quote and just past the closing one. */
  readonly start: number
  readonly end: number
  /**
   * The literal's text with `\n` decoded and each `${}` expression replaced by
   * `INTERPOLATION`, so a line carrying one can be told from a static line.
   */
  readonly text: string
}

const INTERPOLATION = '\u0000'

/** Characters after which a `/` opens a regular expression rather than divides. */
const REGEX_PRECEDERS = new Set('(,=:[!&|?{};+-*%<>~^'.split(''))
const REGEX_KEYWORDS =
  /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/

/**
 * Finds every string and template literal in a TypeScript source.
 *
 * A pattern over backticks reads a doc comment saying `then` as a script, so
 * the stage needs literal bounds. A syntax tree would give them too, but
 * `typescript` is a development dependency and this module ships inside the
 * published CLI, so a lexer tracking comment, string, regex, and template
 * state stands in for it.
 */
function lex(source: string): {
  readonly literals: Literal[]
  /** Each comment's start, keyed by the end of its text. */
  readonly comments: ReadonlyMap<number, number>
} {
  const literals: Literal[] = []
  const comments = new Map<number, number>()
  // One entry per open template expression, holding its brace depth.
  const expressions: number[] = []
  // One entry per open template, holding its start line and static text.
  const templates: { line: number; start: number; text: string }[] = []
  let line = 1
  let i = 0
  let lastSignificant = ''

  const readQuoted = (quote: string): void => {
    const opening = line
    const start = i
    let text = ''
    i++
    while (i < source.length && source[i] !== quote && source[i] !== '\n') {
      if (source[i] === '\\') {
        text += source[i + 1] === 'n' ? '\n' : (source[i + 1] ?? '')
        if (source[i + 1] === '\n') line++
        i += 2
        continue
      }
      text += source[i]
      i++
    }
    i++
    literals.push({ line: opening, start, end: i, text })
  }

  // Reads template text until the closing backtick or the next `${`.
  const readTemplate = (): void => {
    const current = templates[templates.length - 1]
    if (current === undefined) return
    while (i < source.length) {
      const char = source[i]
      if (char === '\\') {
        current.text += source[i + 1] === 'n' ? '\n' : (source[i + 1] ?? '')
        if (source[i + 1] === '\n') line++
        i += 2
        continue
      }
      if (char === '`') {
        i++
        templates.pop()
        literals.push({
          line: current.line,
          start: current.start,
          end: i,
          text: current.text,
        })
        lastSignificant = '`'
        return
      }
      if (char === '$' && source[i + 1] === '{') {
        current.text += INTERPOLATION
        i += 2
        expressions.push(0)
        lastSignificant = '{'
        return
      }
      if (char === '\n') line++
      current.text += char
      i++
    }
  }

  const readRegex = (): void => {
    let inClass = false
    i++
    while (i < source.length && source[i] !== '\n') {
      const char = source[i]
      if (char === '\\') {
        i += 2
        continue
      }
      if (char === '[') inClass = true
      else if (char === ']') inClass = false
      else if (char === '/' && !inClass) break
      i++
    }
    i++
    while (i < source.length && /[a-z]/.test(source[i] ?? '')) i++
    lastSignificant = 'a'
  }

  while (i < source.length) {
    const char = source[i] ?? ''
    const next = source[i + 1]

    if (char === '\n') {
      line++
      i++
      continue
    }
    if (char === '/' && next === '/') {
      const start = i
      while (i < source.length && source[i] !== '\n') i++
      comments.set(start + source.slice(start, i).trimEnd().length, start)
      continue
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      for (let k = i; k < stop; k++) if (source[k] === '\n') line++
      comments.set(stop, i)
      i = stop
      continue
    }
    if (char === "'" || char === '"') {
      readQuoted(char)
      lastSignificant = char
      continue
    }
    if (char === '`') {
      templates.push({ line, start: i, text: '' })
      i++
      readTemplate()
      continue
    }
    if (char === '/') {
      const before = source.slice(Math.max(0, i - 12), i).trimEnd()
      if (
        lastSignificant === '' ||
        REGEX_PRECEDERS.has(lastSignificant) ||
        REGEX_KEYWORDS.test(before)
      ) {
        readRegex()
        continue
      }
    }
    if (expressions.length > 0) {
      const depth = expressions.length - 1
      if (char === '{') expressions[depth] = (expressions[depth] ?? 0) + 1
      if (char === '}') {
        if (expressions[depth] === 0) {
          expressions.pop()
          i++
          readTemplate()
          continue
        }
        expressions[depth] = (expressions[depth] ?? 0) - 1
      }
    }
    if (!/\s/.test(char)) lastSignificant = /[\w$)\]]/.test(char) ? 'a' : char
    i++
  }

  return { literals, comments }
}

const PAGE_OPENER = /^\s*<(?:!doctype|html|head|body)\b/i
// An HTML element name, so markup in a format of the project's own, such as a
// `<rule>` payload, is not read as a page.
const MARKUP_LINE =
  /^\s*<\/?(?:a|article|button|canvas|code|details|dialog|div|figure|footer|form|h[1-6]|header|iframe|img|input|label|li|link|main|meta|nav|ol|option|p|pre|script|section|select|span|style|summary|svg|table|td|template|textarea|th|title|tr|ul)[\s>/]/i
const CLOSING_TAG = /<\/[a-z][\w-]*>/i
const SELECTOR_LINE = /^\s*[^\s{}'"`/][^{}'"`;]*\{\s*$/
const DECLARATION_LINE = /^\s*-{0,2}[a-z][a-z-]*\s*:\s*[^;{}]+;\s*$/
const SHEBANG = /^\s*#!\//
// Each opener needs its own keyword and closer, so prose that opens a line on
// `for` and ends another on `done` is not read as a script.
const SHELL_BRANCHES: readonly RegExp[] = [
  /(?:^\s*|[;&|]\s*)(?:if|elif)\s[\s\S]*?\bthen\b[\s\S]*?(?:^|[;\s])fi\s*(?:$|[;)|&<>])/m,
  /(?:^\s*|[;&|]\s*)(?:for|while|until)\s[\s\S]*?\bdo\b[\s\S]*?(?:^|[;\s])done\s*(?:$|[;)|&<>])/m,
  /(?:^\s*|[;&|]\s*)case\s[\s\S]*?\bin\b[\s\S]*?(?:^|[;\s])esac\s*(?:$|[;)|&<>])/m,
]
const NEWLINE_JOIN = /^\]\s*\.join\(\s*(['"`])\\n\1\s*\)/

/**
 * Lines carrying content and no interpolation. A leading newline counts for
 * nothing, and a line built from data is code generating output, so only the
 * static part of a template is weighed against the limit.
 */
function staticLines(text: string): number {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.includes(INTERPOLATION))
    .length
}

/** The language a literal's static text is written in, or none of the three. */
function kindOf(
  text: string,
): { kind: EmbeddedKind; branches: boolean } | undefined {
  const branches = SHELL_BRANCHES.some((branch) => branch.test(text))
  if (SHEBANG.test(text) || branches) return { kind: 'script', branches }
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  if (
    PAGE_OPENER.test(text) ||
    (CLOSING_TAG.test(text) && MARKUP_LINE.test(lines[0] ?? ''))
  ) {
    return { kind: 'page', branches: false }
  }
  if (
    lines.some((line) => SELECTOR_LINE.test(line)) &&
    lines.some((line) => DECLARATION_LINE.test(line))
  ) {
    return { kind: 'stylesheet', branches: false }
  }
  return undefined
}

/** The offset of the next token, past whitespace and comments. */
function skipTrivia(source: string, from: number): number {
  let i = from
  while (i < source.length) {
    if (/\s/.test(source[i] ?? '')) {
      i++
    } else if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i)
      i = end === -1 ? source.length : end + 1
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 2
    } else {
      return i
    }
  }
  return i
}

/**
 * Merges each array of literals closed by a newline join into one block opening
 * on the array's bracket, since a script written line by line is one program and
 * each of its literals alone reads as nothing. An array holding anything but
 * literals stays as its separate literals.
 */
function blocksOf(
  source: string,
  literals: readonly Literal[],
  comments: ReadonlyMap<number, number>,
): Literal[] {
  // The offset of the last token before `from`, past whitespace and comments.
  const tokenBefore = (from: number): number => {
    let at = from
    for (;;) {
      while (at > 0 && /\s/.test(source[at - 1] ?? '')) at--
      const start = comments.get(at)
      if (start === undefined) return at - 1
      at = start
    }
  }

  const byStart = new Map(literals.map((literal) => [literal.start, literal]))
  const merged = new Set<Literal>()
  const blocks: Literal[] = []

  for (const first of literals) {
    if (merged.has(first)) continue
    const bracket = tokenBefore(first.start)
    if (source[bracket] !== '[') continue

    const run: Literal[] = []
    let next: Literal | undefined = first
    let cursor = first.start
    while (next !== undefined) {
      run.push(next)
      cursor = skipTrivia(source, next.end)
      if (source[cursor] === ',') cursor = skipTrivia(source, cursor + 1)
      next = byStart.get(cursor)
    }
    if (!NEWLINE_JOIN.test(source.slice(cursor, cursor + 40))) continue

    for (const literal of run) merged.add(literal)
    blocks.push({
      line: source.slice(0, bracket).split('\n').length,
      start: bracket,
      end: cursor,
      text: run.map((literal) => literal.text).join('\n'),
    })
  }

  return [
    ...blocks,
    ...literals.filter((literal) => !merged.has(literal)),
  ].sort((a, b) => a.start - b.start)
}

/**
 * The pages, stylesheets, and scripts a source embeds past the limit, or a
 * script that branches at any length.
 *
 * Only a template's static lines count, so a long page with one interpolation
 * still counts and a block built line by line from data does not. A literal whose
 * opening line, or the line above it, carries the marker with a reason is
 * exempt, and a bare marker exempts nothing.
 */
export function embeddedBlocksIn(
  file: string,
  source: string,
): EmbeddedBlock[] {
  const sourceLines = source.split('\n')
  const blocks: EmbeddedBlock[] = []
  const { literals, comments } = lex(source)
  for (const literal of blocksOf(source, literals, comments)) {
    const found = kindOf(literal.text.replaceAll(INTERPOLATION, ''))
    if (found === undefined) continue
    const lines = staticLines(literal.text)
    if (lines <= EMBEDDED_LINE_LIMIT && !found.branches) continue
    if (isMarked(sourceLines, literal.line - 1, EMBEDDED_MARKER)) continue
    blocks.push({ file, line: literal.line, lines, ...found })
  }
  return blocks
}

/** The literal a frontmatter declaration of `name` assigns, if it assigns one. */
function boundLiteral(
  source: string,
  candidates: readonly Literal[],
  name: string,
): Literal | undefined {
  const declaration = new RegExp(
    `(?:^|[^\\w$.])(?:const|let|var)\\s+${escapeForPattern(name)}\\s*(?::[^=]+)?=`,
    'm',
  )
  const match = declaration.exec(source)
  if (match === null) return undefined
  const value = skipTrivia(source, match.index + match[0].length)
  return candidates.find((candidate) => candidate.start === value)
}

/**
 * The blocks an `.astro` file embeds past the limit: every frontmatter string
 * the TypeScript reading finds, a frontmatter string a `<script>` or `<style>`
 * takes through `set:html`, which names the language the text alone cannot,
 * and an `is:inline` script body. An inline block is exempt when its opening
 * tag, or the line above it, carries the marker with a reason.
 */
export function embeddedBlocksInAstro(
  file: string,
  source: string,
): EmbeddedBlock[] {
  const sourceLines = source.split('\n')
  const frontmatter = astroFrontmatter(source)
  const blocks = frontmatter ? embeddedBlocksIn(file, frontmatter.source) : []
  const reported = new Set(blocks.map((block) => block.line))

  const report = (line: number, kind: EmbeddedKind, lines: number): void => {
    if (lines <= EMBEDDED_LINE_LIMIT || reported.has(line)) return
    if (isMarked(sourceLines, line - 1, EMBEDDED_MARKER)) return
    reported.add(line)
    blocks.push({ file, line, kind, lines, branches: false })
  }

  if (frontmatter) {
    const { literals, comments } = lex(frontmatter.source)
    const candidates = blocksOf(frontmatter.source, literals, comments)
    for (const binding of astroBindings(source)) {
      const literal = boundLiteral(frontmatter.source, candidates, binding.name)
      if (literal === undefined) continue
      report(
        literal.line,
        binding.tag === 'style' ? 'stylesheet' : 'script',
        staticLines(literal.text),
      )
    }
  }

  for (const script of astroInlineScripts(source)) {
    report(script.line, 'script', staticLines(script.body))
  }

  return blocks.sort((a, b) => a.line - b.line)
}

/** Reads a file by its extension, as an `.astro` component or as TypeScript. */
export function embeddedBlocksInFile(
  file: string,
  source: string,
): EmbeddedBlock[] {
  return file.endsWith('.astro')
    ? embeddedBlocksInAstro(file, source)
    : embeddedBlocksIn(file, source)
}

export const EMBEDDED_SOURCE = /\.(?:ts|tsx|mts|cts|astro)$/

export const embeddedPrograms: Measure = async (ctx) => {
  const files = await listRepositoryFiles(ctx.root)
  if (files === undefined) {
    return {
      emissions: [],
      unmeasured:
        'The tracked file list could not be read, so no source was scanned for embedded blocks.',
    }
  }

  const sources = files.filter((path) => EMBEDDED_SOURCE.test(path))
  const blocks = sources.flatMap((path) =>
    embeddedBlocksInFile(path, readFileSync(join(ctx.root, path), 'utf8')),
  )

  if (blocks.length === 0) {
    const emissions: Emission[] = [
      {
        kind: 'info',
        text: `No page, stylesheet, or script embedded past ${EMBEDDED_LINE_LIMIT} lines across ${plural(sources.length, 'source file')}`,
      },
    ]
    return { emissions }
  }

  return {
    emissions: blocks.map((block) => ({
      kind: 'warn',
      text: `${block.file}:${block.line} embeds ${block.branches ? 'a branching script' : `a ${block.kind} of ${plural(block.lines, 'line')}`}`,
    })),
    failure: `${plural(blocks.length, 'embedded block')} past the limit. Move each into its own file with its language's extension, read from disk, or mark the opening line with "${EMBEDDED_MARKER}: <reason>" where it must stay inline.`,
  }
}
