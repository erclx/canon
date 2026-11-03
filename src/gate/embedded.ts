import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { plural } from '@/cli/ui'
import type { Emission, Measure } from '@/gate/measures'
import { listRepositoryFiles } from '@/git/files'
import { isMarked } from '@/sweep/exempt-marker'

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
export function literalsIn(source: string): Literal[] {
  const literals: Literal[] = []
  // One entry per open template expression, holding its brace depth.
  const expressions: number[] = []
  // One entry per open template, holding its start line and static text.
  const templates: { line: number; text: string }[] = []
  let line = 1
  let i = 0
  let lastSignificant = ''

  const readQuoted = (quote: string): void => {
    const start = line
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
    literals.push({ line: start, text })
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
        literals.push({ line: current.line, text: current.text })
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
      while (i < source.length && source[i] !== '\n') i++
      continue
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      for (let k = i; k < stop; k++) if (source[k] === '\n') line++
      i = stop
      continue
    }
    if (char === "'" || char === '"') {
      readQuoted(char)
      lastSignificant = char
      continue
    }
    if (char === '`') {
      templates.push({ line, text: '' })
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

  return literals
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
const SHELL_OPENER = /(?:^|[;&|]\s*)(?:if|elif|while|until|for|case)\s/m
const SHELL_CLOSER = /(?:^|[;\s])(?:fi|done|esac)\s*(?:$|[;)|&])/m

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
  if (
    SHEBANG.test(text) ||
    (SHELL_OPENER.test(text) && SHELL_CLOSER.test(text))
  ) {
    return {
      kind: 'script',
      branches: SHELL_OPENER.test(text) && SHELL_CLOSER.test(text),
    }
  }
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
  for (const literal of literalsIn(source)) {
    const found = kindOf(literal.text.replaceAll(INTERPOLATION, ''))
    if (found === undefined) continue
    const lines = staticLines(literal.text)
    if (lines === 0) continue
    if (lines <= EMBEDDED_LINE_LIMIT && !found.branches) continue
    if (isMarked(sourceLines, literal.line - 1, EMBEDDED_MARKER)) continue
    blocks.push({ file, line: literal.line, lines, ...found })
  }
  return blocks
}

const SOURCE_FILE = /\.(?:ts|tsx|mts|cts)$/

export const embeddedPrograms: Measure = async (ctx) => {
  const files = await listRepositoryFiles(ctx.root)
  if (files === undefined) {
    return {
      emissions: [],
      unmeasured:
        'The tracked file list could not be read, so no source was scanned for embedded blocks.',
    }
  }

  const sources = files.filter((path) => SOURCE_FILE.test(path))
  const blocks = sources.flatMap((path) =>
    embeddedBlocksIn(path, readFileSync(join(ctx.root, path), 'utf8')),
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
      text: `${block.file}:${block.line} embeds a ${block.branches ? 'branching ' : ''}${block.kind} of ${plural(block.lines, 'line')}`,
    })),
    failure: `${plural(blocks.length, 'embedded block')} past the limit. Move each into its own file with its language's extension, read from disk, or mark the opening line with "${EMBEDDED_MARKER}: <reason>" where it must stay inline.`,
  }
}
