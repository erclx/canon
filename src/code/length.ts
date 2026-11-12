import { astroFrontmatter } from '@/code/astro'
import { lex } from '@/code/lex'

/**
 * Lines a file may run before the report names it. One default Read returns
 * 25,000 tokens, not a line count, and 2,000 lines of this codebase's
 * TypeScript is about 18,500 tokens, so a file under the limit fits one read
 * with room to spare.
 */
export const FILE_LINE_LIMIT = 2000

/** Lines a function may run before the report names it. */
export const FUNCTION_LINE_CHECKPOINT = 100

/**
 * Code files counted toward the file length, tests included. Markdown is out,
 * since `canon markdown audit` holds its own document ceiling.
 */
export const LENGTH_SOURCE =
  /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro|vue|svelte|py|go|php|sh|bash|rs|css)$/

/**
 * Files whose functions the brace reading can find, an `.astro` file by its
 * frontmatter.
 */
const FUNCTION_SOURCE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/

/**
 * Files `lex` reads in JSX mode. A `.js` file holding JSX stays out, since the
 * mode changes how every `<` where an expression starts is read.
 */
const JSX_SOURCE = /\.(?:tsx|jsx)$/

export interface FunctionSpan {
  /** The line the header opens on. */
  readonly line: number
  /** Lines from the header through the closing brace. */
  readonly lines: number
  /** The declared name, the binding an expression is assigned to, or null. */
  readonly name: string | null
  /** Functions with a block body enclosing this one, 0 at the top level. */
  readonly depth: number
}

/** Lines a file holds, counting a last line with no newline. */
export function lineCount(source: string): number {
  if (source === '') return 0
  const lines = source.split('\n').length
  return source.endsWith('\n') ? lines - 1 : lines
}

/**
 * Stands in for each character of a string or template, so a literal type
 * such as `'a' | 'b'` still ends a return type annotation.
 */
const LITERAL = '\u0001'

/**
 * Stands in for each character of JSX markup. Unlike `LITERAL` it ends no
 * return type, so a `{` inside `c ? f() : <div style={{` opens no body for `f`.
 */
const MARKUP = '\u0002'

/**
 * Blanks every literal, comment, regular expression, and stretch of JSX
 * markup, keeping newlines, so a brace or a keyword inside one reads as
 * nothing. A function written inside a template's `${}` is blanked with the
 * template and goes unmeasured, while one inside a JSX `{}` container is read.
 */
function codeOnly(source: string, options: { jsx?: boolean }): string {
  const { literals, comments, regexes, jsx } = lex(source, options)
  const chars = source.split('')
  const blank = (start: number, end: number, fill: string): void => {
    for (let k = start; k < end && k < chars.length; k++) {
      if (chars[k] !== '\n') chars[k] = fill
    }
  }
  for (const literal of literals) blank(literal.start, literal.end, LITERAL)
  for (const [end, start] of comments) blank(start, end, ' ')
  for (const regex of regexes) blank(regex.start, regex.end, ' ')
  for (const markup of jsx) blank(markup.start, markup.end, MARKUP)
  return chars.join('')
}

const IDENTIFIER = /[\w$]/

/** Keywords whose parenthesized head opens a block that is no function. */
const CONTROL = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'export',
  'import',
  'with',
  'await',
])

/** Keywords that open a declaration no return type annotation reaches past. */
const DECLARATIONS = new Set([
  'class',
  'interface',
  'enum',
  'namespace',
  'module',
  'type',
  'const',
  'let',
  'var',
  'return',
])

/**
 * Words that end no return type before a `{`: a statement keyword opening a
 * plain block, or a type operator opening an object type.
 */
const NO_BODY_AFTER = new Set([
  ...DECLARATIONS,
  'else',
  'try',
  'catch',
  'export',
  'import',
  'do',
  'finally',
  'default',
  'readonly',
  'keyof',
  'typeof',
  'infer',
  'extends',
  'implements',
  'is',
])

function previousToken(code: string, from: number): number {
  let i = from
  while (i >= 0 && /\s/.test(code[i] ?? '')) i--
  return i
}

/** The opener matching the closer at `close`, read backward, or -1. */
function matchBack(code: string, close: number, open: string): number {
  const closer = code[close]
  let depth = 0
  for (let i = close; i >= 0; i--) {
    if (code[i] === closer) depth++
    else if (code[i] === open && --depth === 0) return i
  }
  return -1
}

function wordStart(code: string, end: number): number {
  let i = end
  while (i > 0 && IDENTIFIER.test(code[i - 1] ?? '')) i--
  return i
}

/** The whole word starting at `start`, or '' when no word starts there. */
function wordAt(code: string, start: number): string {
  if (IDENTIFIER.test(code[start - 1] ?? '')) return ''
  let end = start
  while (IDENTIFIER.test(code[end] ?? '')) end++
  return code.slice(start, end)
}

/**
 * The `)` closing a parameter list that a return type annotation follows,
 * read backward from the annotation's last character, or -1.
 *
 * An annotation may span lines, so the read runs until `:` and stops at `;`,
 * `,`, `=`, `?`, or a declaration keyword outside brackets, which keeps a class
 * heritage clause, a ternary, or an assignment from reading as an annotation.
 * An annotation needs at least one character, so `case f(): {` opens no body.
 */
function annotatedParams(code: string, from: number): number {
  let depth = 0
  for (let k = from; k >= 0; k--) {
    const char = code[k] ?? ''
    if (char === '>' && code[k - 1] === '=') {
      k--
      continue
    }
    if (')]}>'.includes(char)) {
      depth++
    } else if ('([{<'.includes(char)) {
      if (depth === 0) return -1
      depth--
    } else if (depth === 0) {
      if (char === ':') {
        if (k === from) return -1
        const before = previousToken(code, k - 1)
        return code[before] === ')' ? before : -1
      }
      if (';,=?'.includes(char)) return -1
      if (DECLARATIONS.has(wordAt(code, k))) return -1
    }
  }
  return -1
}

/** The binding an expression is assigned to, read from the code before it. */
function bindingBefore(code: string, start: number): string | null {
  const before = code.slice(Math.max(0, start - 200), start)
  const match = /([\w$]+)\s*(?::[^=;{}]*)?(?<![=!<>])=\s*(?:async\s*)?$/.exec(
    before,
  )
  return match?.[1] ?? null
}

interface Header {
  readonly start: number
  readonly name: string | null
}

/** The header a parameter list closing at `close` belongs to, if a function's. */
function paramsHeader(code: string, close: number): Header | undefined {
  const open = matchBack(code, close, '(')
  if (open === -1) return undefined
  let before = previousToken(code, open - 1)
  if (code[before] === '>' && code[before - 1] !== '=') {
    before = previousToken(code, matchBack(code, before, '<') - 1)
  }
  if (code[before] === ']') {
    return { start: matchBack(code, before, '['), name: null }
  }
  if (!IDENTIFIER.test(code[before] ?? '')) return undefined

  const start = wordStart(code, before)
  const word = code.slice(start, before + 1)
  if (CONTROL.has(word)) return undefined
  if (word === 'function') return { start, name: bindingBefore(code, start) }
  return { start, name: word }
}

/** The header of an arrow whose `=>` sits at `arrow`. */
function arrowHeader(code: string, arrow: number): Header | undefined {
  const last = previousToken(code, arrow - 1)
  const close = code[last] === ')' ? last : annotatedParams(code, last)
  let start: number
  if (close !== -1) {
    start = matchBack(code, close, '(')
    if (start === -1) return undefined
  } else if (IDENTIFIER.test(code[last] ?? '')) {
    start = wordStart(code, last)
  } else {
    return undefined
  }
  const asyncWord = /async\s*$/.exec(code.slice(Math.max(0, start - 12), start))
  if (asyncWord !== null) start -= asyncWord[0].length
  return { start, name: bindingBefore(code, start) }
}

const TEST_RUNNERS = new Set(['describe', 'it', 'test'])

/**
 * Whether the call whose arguments open at `paren` is a test runner's
 * `describe`, `it`, or `test`, read backward over any chained modifier such
 * as `.each(table)`, a tagged table, or `.skip`, to the name the chain starts
 * from. A method such as `pattern.test` starts from `pattern` and is no runner.
 */
function callsTestRunner(code: string, paren: number): boolean {
  let i = previousToken(code, paren - 1)
  while (i >= 0) {
    const char = code[i] ?? ''
    if (char === ')') {
      const open = matchBack(code, i, '(')
      if (open === -1) return false
      i = previousToken(code, open - 1)
    } else if (char === LITERAL) {
      while (i >= 0 && (code[i] === LITERAL || code[i] === '\n')) i--
      i = previousToken(code, i)
    } else if (IDENTIFIER.test(char)) {
      const start = wordStart(code, i)
      const before = previousToken(code, start - 1)
      if (code[before] !== '.') {
        return TEST_RUNNERS.has(code.slice(start, i + 1))
      }
      i = previousToken(code, before - 1)
    } else {
      return false
    }
  }
  return false
}

/**
 * Whether the function opening at `start` is an argument to a test runner's
 * `describe`, `it`, or `test`. Such a callback holds a suite or a case rather
 * than a function a review reads, so it is no function here and adds no depth
 * to the functions written inside it.
 */
function isTestCallback(code: string, start: number): boolean {
  const before = previousToken(code, start - 1)
  if (code[before] !== '(' && code[before] !== ',') return false
  let depth = 0
  for (let k = before; k >= 0; k--) {
    const char = code[k] ?? ''
    if (k !== before && ')]}'.includes(char)) {
      depth++
    } else if ('([{'.includes(char)) {
      if (depth > 0) {
        depth--
        continue
      }
      if (char !== '(') return false
      return callsTestRunner(code, k)
    } else if (depth === 0 && char === ';') {
      return false
    }
  }
  return false
}

/** The function header a `{` at `brace` opens the body of, if it opens one. */
function headerAt(code: string, brace: number): Header | undefined {
  const last = previousToken(code, brace - 1)
  if (last < 0) return undefined
  if (code[last] === '>' && code[last - 1] === '=') {
    return arrowHeader(code, last - 1)
  }
  if (code[last] === ')') return paramsHeader(code, last)
  // Only a word, a literal, `>`, `]`, or `}` can end a return type annotation.
  if (IDENTIFIER.test(code[last] ?? '')) {
    if (NO_BODY_AFTER.has(code.slice(wordStart(code, last), last + 1))) {
      return undefined
    }
  } else if (!`>]}${LITERAL}`.includes(code[last] ?? '')) {
    return undefined
  }
  const close = annotatedParams(code, last)
  return close === -1 ? undefined : paramsHeader(code, close)
}

/**
 * Every function with a block body in a TypeScript or JavaScript source, in
 * the order each closes. Pass `jsx` for a `.tsx` or `.jsx` source.
 *
 * `typescript` is a development dependency and this module ships inside the
 * published CLI, so braces are matched over the code `lex` leaves outside
 * literals, comments, and regular expressions, and each `{` is read as a body
 * when the tokens before it are a parameter list, a return type, or `=>`. An
 * arrow with an expression body has no braces and is skipped, and so is a
 * callback passed to `describe`, `it`, or `test`.
 */
export function functionSpans(
  source: string,
  options: { readonly jsx?: boolean } = {},
): FunctionSpan[] {
  const code = codeOnly(source, options)
  const newlines: number[] = []
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') newlines.push(i)
  const lineOf = (offset: number): number => {
    let low = 0
    let high = newlines.length
    while (low < high) {
      const mid = (low + high) >> 1
      if ((newlines[mid] ?? 0) < offset) low = mid + 1
      else high = mid
    }
    return low + 1
  }

  const open: { header: Header | undefined }[] = []
  let depth = 0
  const spans: FunctionSpan[] = []
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') {
      const found = headerAt(code, i)
      const header =
        found !== undefined && isTestCallback(code, found.start)
          ? undefined
          : found
      open.push({ header })
      if (header !== undefined) depth++
    } else if (code[i] === '}') {
      const header = open.pop()?.header
      if (header === undefined) continue
      depth--
      const line = lineOf(header.start)
      spans.push({
        line,
        lines: lineOf(i) - line + 1,
        name: header.name,
        depth,
      })
    }
  }
  return spans
}

/**
 * The functions a file holds, or none for a file the brace reading cannot
 * parse. An `.astro` file is read by its frontmatter alone, whose lines keep
 * their numbers in the file.
 */
export function functionSpansInFile(
  file: string,
  source: string,
): FunctionSpan[] {
  if (!FUNCTION_SOURCE.test(file)) return []
  if (!file.endsWith('.astro')) {
    return functionSpans(source, { jsx: JSX_SOURCE.test(file) })
  }
  const frontmatter = astroFrontmatter(source)
  return frontmatter === undefined ? [] : functionSpans(frontmatter.source)
}

export interface LongFile {
  readonly file: string
  readonly lines: number
}

export interface LongFunction {
  readonly file: string
  readonly line: number
  readonly lines: number
  readonly name: string | null
}

/**
 * The files past the line limit and the top-level functions past the
 * checkpoint, each sorted by path then line. A nested function is left out,
 * since the function around it already carries its lines.
 */
export function longCode(
  sources: readonly { readonly file: string; readonly source: string }[],
): { longFiles: LongFile[]; longFunctions: LongFunction[] } {
  const longFiles: LongFile[] = []
  const longFunctions: LongFunction[] = []
  for (const { file, source } of sources) {
    const lines = lineCount(source)
    if (lines > FILE_LINE_LIMIT) longFiles.push({ file, lines })
    for (const span of functionSpansInFile(file, source)) {
      if (span.depth > 0 || span.lines <= FUNCTION_LINE_CHECKPOINT) continue
      longFunctions.push({
        file,
        line: span.line,
        lines: span.lines,
        name: span.name,
      })
    }
  }
  const byPlace = (
    a: { file: string; line?: number },
    b: { file: string; line?: number },
  ): number => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0)
  return {
    longFiles: longFiles.sort(byPlace),
    longFunctions: longFunctions.sort(byPlace),
  }
}
