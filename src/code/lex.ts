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

/** A `<` opening an element or a fragment, unless it opens type parameters. */
const TAG_START = /^<(?:>|[A-Za-z_$])/

/**
 * Type parameters a tag cannot start with, being `<T,>`, `<T extends U>`,
 * `<T = U>`, and `<const T>`, which a `.tsx` generic arrow is written with.
 */
const TYPE_PARAMETERS = /^<(?:const\s+[\w$]|[\w$]+\s*(?:,|extends\s|=))/

/**
 * A lone `<T>` before a parameter list, which opens a generic signature in a
 * type, such as `: <T>(x: T) => T`, when `=>` or `:` follows the list. An
 * element whose text opens on `(` is followed by more text or a tag instead.
 */
const SIGNATURE_START = /^<[\w$]+>\(/
const SIGNATURE_END = /^\s*(?:=>|:)/

/** Whether the `<` at `at` opens type parameters rather than an element. */
function opensTypeParameters(source: string, at: number): boolean {
  if (TYPE_PARAMETERS.test(source.slice(at, at + 80))) return true
  const head = SIGNATURE_START.exec(source.slice(at, at + 80))
  if (head === null) return false
  let depth = 0
  for (let k = at + head[0].length - 1; k < source.length; k++) {
    if (source[k] === '(') depth++
    else if (source[k] === ')' && --depth === 0) {
      return SIGNATURE_END.test(source.slice(k + 1, k + 8))
    }
  }
  return false
}

/** Offsets of a span, from its first character to just past its last. */
export interface Range {
  readonly start: number
  readonly end: number
}

/** Where JSX mode stands inside one element tree. */
interface Tree {
  /** Elements opened and not yet closed. */
  open: number
  /** Inside an opening tag, its children, or a closing tag. */
  mode: 'tag' | 'children' | 'close'
  /** Type argument brackets open on a tag name, as in `<Select<T>>`. */
  angles: number
}

/**
 * Finds every string and template literal in a TypeScript source.
 *
 * A pattern over backticks reads a doc comment saying `then` as a script, so
 * the stage needs literal bounds. A syntax tree would give them too, but
 * `typescript` is a development dependency and this module ships inside the
 * published CLI, so a lexer tracking comment, string, regex, and template
 * state stands in for it.
 */
export function lex(
  source: string,
  options: {
    /**
     * Reads `<` where an expression starts as JSX, for a `.tsx` or `.jsx`
     * file. Off, `lex` reads such a `<` as code, as a `.ts` file needs.
     */
    readonly jsx?: boolean
  } = {},
): {
  readonly literals: Literal[]
  /** Each comment's start, keyed by the end of its text. */
  readonly comments: ReadonlyMap<number, number>
  /** Each regular expression literal, as its start and the offset past its flags. */
  readonly regexes: readonly Range[]
  /**
   * JSX markup in source order, being tags, attribute strings, text, and the
   * braces of each `{}` container, with the code inside a container left out.
   * Always empty with `jsx` off.
   */
  readonly jsx: readonly Range[]
} {
  const literals: Literal[] = []
  const comments = new Map<number, number>()
  const regexes: Range[] = []
  const jsx: Range[] = []
  // One entry per open template expression or JSX container, holding its
  // brace depth and what resumes once its closing brace is read.
  const expressions: { depth: number; resume: () => void }[] = []
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
        expressions.push({ depth: 0, resume: readTemplate })
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

  // Reads a comment written between a tag's attributes.
  const readTagComment = (): void => {
    const start = i
    const block = source[i + 1] === '*'
    const close = source.indexOf(block ? '*/' : '\n', i + 2)
    let end = close === -1 ? source.length : close
    if (block && close !== -1) end += 2
    for (let k = i; k < end; k++) if (source[k] === '\n') line++
    comments.set(start + source.slice(start, end).trimEnd().length, start)
    i = end
  }

  // Reads one element tree's markup from `start` until the tree closes or a
  // `{` opens a container, whose closing brace resumes the read.
  const readMarkup = (tree: Tree, start: number): void => {
    while (i < source.length) {
      const char = source[i]
      const next = source[i + 1]
      if (char === '\n') line++
      if (tree.mode !== 'close' && char === '{') {
        i++
        jsx.push({ start, end: i })
        expressions.push({
          depth: 0,
          resume: () => readMarkup(tree, i - 1),
        })
        lastSignificant = '{'
        return
      }
      if (tree.mode === 'children') {
        if (char === '<') {
          tree.mode = next === '/' ? 'close' : 'tag'
          if (tree.mode === 'tag') tree.open++
        }
        i++
        continue
      }
      if (tree.mode === 'close') {
        i++
        if (char === '>' && --tree.open === 0) break
        if (char === '>') tree.mode = 'children'
        continue
      }
      if (char === '"' || char === "'") {
        const close = source.indexOf(char, i + 1)
        const end = close === -1 ? source.length : close + 1
        for (let k = i + 1; k < end; k++) if (source[k] === '\n') line++
        i = end
        continue
      }
      if (char === '/' && (next === '/' || next === '*')) {
        readTagComment()
        continue
      }
      if (char === '<') tree.angles++
      if (char === '>' && tree.angles > 0) {
        tree.angles--
        i++
        continue
      }
      if (char === '/' && next === '>') {
        i += 2
        if (--tree.open === 0) break
        tree.mode = 'children'
        continue
      }
      if (char === '>') tree.mode = 'children'
      i++
    }
    jsx.push({ start, end: i })
    lastSignificant = 'a'
  }

  // Whether the code before `i` leaves an expression to start, where `/`
  // opens a regular expression and, in JSX mode, `<` opens an element.
  const expressionStarts = (): boolean => {
    const before = source.slice(Math.max(0, i - 12), i).trimEnd()
    return (
      lastSignificant === '' ||
      REGEX_PRECEDERS.has(lastSignificant) ||
      REGEX_KEYWORDS.test(before)
    )
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
    if (char === '/' && expressionStarts()) {
      readRegex()
      continue
    }
    if (
      options.jsx === true &&
      char === '<' &&
      expressionStarts() &&
      TAG_START.test(source.slice(i, i + 2)) &&
      !opensTypeParameters(source, i)
    ) {
      const start = i
      i++
      readMarkup({ open: 1, mode: 'tag', angles: 0 }, start)
      continue
    }
    const expression = expressions[expressions.length - 1]
    if (expression !== undefined) {
      if (char === '{') expression.depth++
      if (char === '}') {
        if (expression.depth === 0) {
          expressions.pop()
          i++
          expression.resume()
          continue
        }
        expression.depth--
      }
    }
    if (!/\s/.test(char)) lastSignificant = /[\w$)\]]/.test(char) ? 'a' : char
    i++
  }

  return { literals, comments, regexes, jsx }
}
