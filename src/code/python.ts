import type { FunctionSpan } from '@/code/length'

/**
 * Reads the `def` and `async def` spans of a Python source by indentation.
 *
 * The published CLI spawns no interpreter, since an interpreter older than
 * the project's syntax refuses files that parse under the project's own, so a
 * line lexer tracks strings, comments, brackets, and continuations, and a
 * function's body runs until the first statement indented at or below its
 * header. A file the walk cannot read is returned as unread with the reason,
 * never as an empty list.
 */

export type UnreadReason =
  | 'unclosed-string'
  | 'unclosed-bracket'
  | 'mixed-indent'

export type FunctionRead =
  | { readonly kind: 'read'; readonly spans: FunctionSpan[] }
  | {
      readonly kind: 'unread'
      readonly line: number
      readonly reason: UnreadReason
    }

/** Stands in for each character of a string, so a line holding one reads as code. */
const LITERAL = '\u0001'

const DEF_HEADER = /^(?:async\s+)?def\s+([\p{L}_][\p{L}\p{N}_]*)/u
const STRING_PREFIX = /^(?:[rRbBuUfFtT]|[rR][bBfFtT]|[bBfFtT][rR])$/
const IDENTIFIER = /[\p{L}\p{N}_]/u

interface CodeFrame {
  readonly kind: 'code'
  /** The frame is a replacement field inside a formatted string. */
  readonly field: boolean
  /** The line each open bracket sits on, outermost first. */
  readonly opens: number[]
}

interface StringFrame {
  readonly kind: 'string'
  readonly quote: string
  readonly triple: boolean
  readonly formatted: boolean
  readonly line: number
}

type Frame = CodeFrame | StringFrame

interface Lexed {
  /** Each line with comments blanked and string characters as `LITERAL`. */
  readonly code: string[]
  /** Whether each line opens a new logical line. */
  readonly fresh: boolean[]
}

type LexResult =
  | { readonly kind: 'read'; readonly lexed: Lexed }
  | {
      readonly kind: 'unread'
      readonly line: number
      readonly reason: UnreadReason
    }

/** The string prefix written right before the quote at `quote`, or '' for none. */
function prefixBefore(source: string, quote: number): string {
  let start = quote
  while (start > 0 && IDENTIFIER.test(source[start - 1] ?? '')) start--
  const word = source.slice(start, quote)
  return STRING_PREFIX.test(word) ? word : ''
}

function lexPython(source: string): LexResult {
  const lines = source.split('\n')
  const code: string[] = []
  const fresh: boolean[] = [true]
  const base: CodeFrame = { kind: 'code', field: false, opens: [] }
  const stack: Frame[] = [base]
  let line = 1
  let current = ''
  let continued = false

  const endLine = (): void => {
    code.push(current)
    current = ''
    fresh.push(stack.length === 1 && base.opens.length === 0 && !continued)
    continued = false
    line++
  }

  for (let i = 0; i < source.length; i++) {
    const char = source[i] ?? ''
    const frame = stack[stack.length - 1] ?? base

    if (frame.kind === 'string') {
      if (char === '\n') {
        if (!frame.triple) {
          return { kind: 'unread', line: frame.line, reason: 'unclosed-string' }
        }
        endLine()
        continue
      }
      if (char === '\\') {
        current += LITERAL
        if (source[i + 1] === '\r' && source[i + 2] === '\n') i++
        if (source[i + 1] === '\n') {
          endLine()
        } else if (i + 1 < source.length) {
          current += LITERAL
        }
        i++
        continue
      }
      if (frame.formatted && (char === '{' || char === '}')) {
        if (source[i + 1] === char) {
          current += LITERAL + LITERAL
          i++
          continue
        }
        if (char === '{') {
          current += LITERAL
          stack.push({ kind: 'code', field: true, opens: [] })
          continue
        }
      }
      if (char === frame.quote) {
        if (!frame.triple) {
          current += LITERAL
          stack.pop()
          continue
        }
        if (source[i + 1] === char && source[i + 2] === char) {
          current += LITERAL.repeat(3)
          i += 2
          stack.pop()
          continue
        }
      }
      current += char === '\r' ? '' : LITERAL
      continue
    }

    if (char === '\n') {
      endLine()
      continue
    }
    if (char === '\r') continue
    if (frame.field) {
      current += char === ' ' || char === '\t' ? char : LITERAL
      if (char === '}' && frame.opens.length === 0) {
        stack.pop()
        continue
      }
    } else if (char === '#') {
      while (i + 1 < source.length && source[i + 1] !== '\n') i++
      continue
    } else if (
      char === '\\' &&
      (source[i + 1] === '\n' || source[i + 1] === '\r')
    ) {
      continued = true
      if (source[i + 1] === '\r') i++
      continue
    } else {
      current += char
    }

    if (char === '"' || char === "'") {
      const prefix = prefixBefore(source, i)
      const triple = source[i + 1] === char && source[i + 2] === char
      if (frame.field) current += triple ? LITERAL.repeat(2) : ''
      else current = current.slice(0, -1) + LITERAL.repeat(triple ? 3 : 1)
      if (triple) i += 2
      stack.push({
        kind: 'string',
        quote: char,
        triple,
        formatted: /[fFtT]/.test(prefix),
        line,
      })
    } else if ('([{'.includes(char)) {
      frame.opens.push(line)
    } else if (')]}'.includes(char)) {
      frame.opens.pop()
    }
  }

  const unclosed = stack.find(
    (frame): frame is StringFrame => frame.kind === 'string',
  )
  if (unclosed !== undefined) {
    return { kind: 'unread', line: unclosed.line, reason: 'unclosed-string' }
  }
  const bracket = base.opens[0]
  if (bracket !== undefined) {
    return { kind: 'unread', line: bracket, reason: 'unclosed-bracket' }
  }
  code.push(current)
  return { kind: 'read', lexed: { code, fresh: fresh.slice(0, lines.length) } }
}

interface LogicalLine {
  readonly start: number
  readonly end: number
  readonly indent: string
  readonly text: string
}

/** The logical lines holding code, each with its 1-based first and last line. */
function logicalLines(source: string, lexed: Lexed): LogicalLine[] {
  const raw = source.split('\n')
  const result: LogicalLine[] = []
  let k = 0
  while (k < lexed.code.length) {
    let end = k
    while (end + 1 < lexed.code.length && lexed.fresh[end + 1] === false) end++
    const text = lexed.code.slice(k, end + 1).join('\n')
    if (/\S/.test(text)) {
      const indent = /^[ \t\f]*/.exec(raw[k] ?? '')?.[0] ?? ''
      result.push({
        start: k + 1,
        end: end + 1,
        indent,
        text: text.trimStart(),
      })
    }
    k = end + 1
  }
  return result
}

/** The column an indent reaches with tabs stopping every `size` columns. */
function column(indent: string, size: number): number {
  let col = 0
  for (const char of indent) {
    if (char === '\t') col = (Math.floor(col / size) + 1) * size
    else if (char === ' ') col++
  }
  return col
}

/**
 * Compares two indents the way Python's tokenizer does, at tab sizes 8 and 1,
 * and returns undefined when the two readings disagree, where Python refuses
 * the file rather than guessing.
 */
function compareIndent(a: string, b: string): number | undefined {
  const wide = Math.sign(column(a, 8) - column(b, 8))
  const narrow = Math.sign(column(a, 1) - column(b, 1))
  return wide === narrow ? wide : undefined
}

/** Whether a `def` header's logical line carries its body after the colon. */
function bodyOnHeader(text: string): boolean {
  let depth = 0
  const params = text.indexOf('(')
  for (let i = params === -1 ? 0 : params; i < text.length; i++) {
    const char = text[i] ?? ''
    if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char)) depth--
    else if (char === ':' && depth === 0) return /\S/.test(text.slice(i + 1))
  }
  return false
}

interface OpenDef {
  readonly line: number
  readonly indent: string
  readonly name: string
  readonly depth: number
  end: number
}

export interface PythonOptions {
  /**
   * Skip a `test_` function, read in a `test_*.py` or `*_test.py` file, and
   * give the functions written inside it no depth for it.
   */
  readonly skipTests?: boolean
}

export function pythonFunctionSpans(
  source: string,
  options: PythonOptions = {},
): FunctionRead {
  const lexResult = lexPython(source)
  if (lexResult.kind === 'unread') return lexResult

  const spans: FunctionSpan[] = []
  const open: (OpenDef & { counted: boolean })[] = []
  const close = (def: OpenDef & { counted: boolean }): void => {
    if (!def.counted) return
    spans.push({
      line: def.line,
      lines: def.end - def.line + 1,
      name: def.name,
      depth: def.depth,
    })
  }
  const depthNow = (): number => open.filter((def) => def.counted).length

  let previous = ''
  for (const logical of logicalLines(source, lexResult.lexed)) {
    if (
      (logical.indent.includes('\t') && logical.indent.includes(' ')) ||
      compareIndent(logical.indent, previous) === undefined
    ) {
      return { kind: 'unread', line: logical.start, reason: 'mixed-indent' }
    }
    previous = logical.indent
    for (;;) {
      const top = open[open.length - 1]
      if (top === undefined) break
      const order = compareIndent(logical.indent, top.indent)
      if (order === undefined) {
        return { kind: 'unread', line: logical.start, reason: 'mixed-indent' }
      }
      if (order > 0) break
      close(top)
      open.pop()
    }
    for (const def of open) def.end = logical.end

    const header = DEF_HEADER.exec(logical.text)
    if (header === null) continue
    const name = header[1] ?? ''
    const def = {
      line: logical.start,
      indent: logical.indent,
      name,
      depth: depthNow(),
      end: logical.end,
      counted: !(options.skipTests === true && name.startsWith('test_')),
    }
    if (bodyOnHeader(logical.text)) close(def)
    else open.push(def)
  }
  while (open.length > 0) {
    const def = open.pop()
    if (def !== undefined) close(def)
  }
  return { kind: 'read', spans }
}

/** Whether pytest collects `test_` functions from a file at this path. */
export function isPythonTestFile(file: string): boolean {
  const base = file.slice(file.lastIndexOf('/') + 1)
  return /^test_.*\.py$/.test(base) || base.endsWith('_test.py')
}
