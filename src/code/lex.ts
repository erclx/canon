export interface Literal {
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

/** Stands in for each `${}` expression in a literal's text. */
export const INTERPOLATION = '\u0000'

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
export function lex(source: string): {
  readonly literals: Literal[]
  /** Each comment's start, keyed by the end of its text. */
  readonly comments: ReadonlyMap<number, number>
  /** Each regular expression literal, as its start and the offset past its flags. */
  readonly regexes: readonly { readonly start: number; readonly end: number }[]
} {
  const literals: Literal[] = []
  const comments = new Map<number, number>()
  const regexes: { start: number; end: number }[] = []
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
    const start = i
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
    regexes.push({ start, end: i })
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

  return { literals, comments, regexes }
}
