import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  FILE_LINE_LIMIT,
  FUNCTION_LINE_CHECKPOINT,
  functionSpans,
  functionSpansInFile,
  lineCount,
  longCode,
} from '@/code/length'

/**
 * The spans the compiler gives for every function with a block body, the
 * reference the brace reading is held to. Depth counts block-bodied ancestors
 * alone, since an arrow with an expression body is skipped by design.
 */
function compilerSpans(
  source: string,
): { line: number; lines: number; depth: number }[] {
  const file = ts.createSourceFile('f.ts', source, ts.ScriptTarget.Latest, true)
  const spans: { line: number; lines: number; depth: number; end: number }[] =
    []
  const visit = (node: ts.Node, depth: number): void => {
    let next = depth
    if (
      ts.isFunctionLike(node) &&
      'body' in node &&
      node.body !== undefined &&
      ts.isBlock(node.body as ts.Node)
    ) {
      const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const end = file.getLineAndCharacterOfPosition(node.getEnd()).line + 1
      spans.push({ line, lines: end - line + 1, depth, end: node.getEnd() })
      next = depth + 1
    }
    ts.forEachChild(node, (child) => visit(child, next))
  }
  visit(file, 0)
  return spans
    .sort((a, b) => a.end - b.end)
    .map(({ line, lines, depth }) => ({ line, lines, depth }))
}

function braceSpans(
  source: string,
): { line: number; lines: number; depth: number }[] {
  return functionSpans(source).map(({ line, lines, depth }) => ({
    line,
    lines,
    depth,
  }))
}

describe('functionSpans', () => {
  it.each([
    ['a declaration', 'export function a(x: number) {\n  return x\n}\n'],
    ['an async declaration', 'async function a() {\n  await b()\n}\n'],
    ['a generator', 'function* a() {\n  yield 1\n}\n'],
    ['a generic', 'function a<T>(x: T): T {\n  return x\n}\n'],
    [
      'a return type with braces',
      'function a(): { b: number } {\n  return { b: 1 }\n}\n',
    ],
    [
      'a function return type',
      'function a(): (x: number) => void {\n  return () => {}\n}\n',
    ],
    ['an arrow', 'const a = (x: number) => {\n  return x\n}\n'],
    ['an arrow with one bare parameter', 'const a = x => {\n  return x\n}\n'],
    ['an async arrow', 'const a = async (): Promise<void> => {\n  b()\n}\n'],
    ['a function expression', 'const a = function () {\n  b()\n}\n'],
    [
      'class members',
      'class A extends B {\n  constructor() {\n    super()\n  }\n  get b(): number {\n    return 1\n  }\n  c<T>(x: T) {}\n}\n',
    ],
    ['an object method', 'const o = {\n  a() {\n    return 1\n  },\n}\n'],
    ['a computed method', 'const o = {\n  [k]() {\n    return 1\n  },\n}\n'],
    [
      'control flow inside a function',
      'function a(x: number) {\n  if (x) {\n    for (const y of z) {}\n  } else {\n    while (x) {}\n  }\n  try {\n  } catch (e) {\n  }\n}\n',
    ],
    ['a for await', 'async function a() {\n  for await (const x of y) {}\n}\n'],
    [
      'a switch with case blocks',
      "function a(x: string) {\n  switch (x) {\n    case 'a': {\n      break\n    }\n  }\n}\n",
    ],
    [
      'a ternary before an object',
      'function a() {\n  const x = c ? d() : { e: 1 }\n  return x\n}\n',
    ],
    [
      'a nested callback',
      'function a() {\n  items.map((x) => {\n    return x\n  })\n}\n',
    ],
    [
      'an interface and a type literal',
      'interface A {\n  b(): void\n}\ntype C = { d: number }\nfunction e() {\n}\n',
    ],
    [
      'a return type spanning lines',
      'function a():\n  | { b: number }\n  | undefined {\n  return undefined\n}\n',
    ],
    [
      'a literal union return type',
      "function a(): 'b' | 'c' {\n  return 'b'\n}\n",
    ],
    [
      'a readonly object return type',
      'function a(): readonly { b: number }[] {\n  return []\n}\n',
    ],
    [
      'a comparison before a bare catch',
      'function a() {\n  try {\n    if (b > 1) return {}\n  } catch {\n  }\n}\n',
    ],
    [
      'an export list after a function',
      'function a(): string {\n  return b\n}\nexport { a }\n',
    ],
    [
      'an arrow with an expression body',
      'function a() {\n  return items.map((x) => ({\n    x,\n  }))\n}\n',
    ],
  ])('should match the compiler on %s', (_shape, source) => {
    expect(braceSpans(source)).toEqual(compilerSpans(source))
  })

  it.each([
    ['a string', "function a() {\n  const s = '{ ('\n}\n"],
    ['a template', 'function a() {\n  const s = `}\n{ {`\n}\n'],
    ['a template expression', 'function a() {\n  const s = `${b}{`\n}\n'],
    ['a regular expression', 'function a() {\n  return /[{]\\{/.test(b)\n}\n'],
    ['a line comment', 'function a() {\n  // }\n  return 1\n}\n'],
    ['a block comment', 'function a() {\n  /* } function b() { */\n}\n'],
  ])('should open nothing on a brace inside %s', (_place, source) => {
    expect(braceSpans(source)).toEqual(compilerSpans(source))
  })

  it.each([
    ['a declaration', 'function load() {}', 'load'],
    ['a method', 'class A {\n  load() {}\n}', 'load'],
    ['an arrow binding', 'const load = async () => {}', 'load'],
    ['a typed binding', 'const load: Loader = () => {}', 'load'],
    ['an expression binding', 'const load = function () {}', 'load'],
    ['a callback', 'items.map((x) => {})', null],
  ])('should name %s', (_shape, source, name) => {
    expect(functionSpans(source)[0]?.name).toBe(name)
  })
})

describe('functionSpansInFile', () => {
  it('should read only the frontmatter of an astro file', () => {
    const source = '---\nfunction a() {\n  return 1\n}\n---\n<div>{b}</div>\n'

    expect(functionSpansInFile('page.astro', source)).toEqual([
      { line: 2, lines: 3, name: 'a', depth: 0 },
    ])
  })

  it('should read no function in a language it cannot parse', () => {
    expect(functionSpansInFile('a.py', 'def a():\n  return {}\n')).toEqual([])
  })
})

describe('lineCount', () => {
  it.each([
    ['', 0],
    ['a', 1],
    ['a\n', 1],
    ['a\nb', 2],
  ])('should count %j as %i lines', (source, lines) => {
    expect(lineCount(source)).toBe(lines)
  })
})

describe('longCode', () => {
  const body = (lines: number): string => '  x()\n'.repeat(lines)

  it('should name a file past the limit and leave one at it', () => {
    const result = longCode([
      { file: 'b.py', source: 'x\n'.repeat(FILE_LINE_LIMIT + 1) },
      { file: 'a.ts', source: 'x\n'.repeat(FILE_LINE_LIMIT) },
    ])

    expect(result.longFiles).toEqual([{ file: 'b.py', lines: 2001 }])
  })

  it('should name a top-level function past the checkpoint', () => {
    const source = `function a() {\n${body(FUNCTION_LINE_CHECKPOINT - 1)}}\n`

    expect(longCode([{ file: 'a.ts', source }]).longFunctions).toEqual([
      { file: 'a.ts', line: 1, lines: 101, name: 'a' },
    ])
  })

  it('should count a test file toward the file limit and not its functions', () => {
    const suite = `describe('a', () => {\n${body(FILE_LINE_LIMIT)}})\n`

    const result = longCode([{ file: 'a.test.ts', source: suite }])

    expect(result).toEqual({
      longFiles: [{ file: 'a.test.ts', lines: 2002 }],
      longFunctions: [],
    })
  })

  it('should leave a function at the checkpoint', () => {
    const source = `function a() {\n${body(FUNCTION_LINE_CHECKPOINT - 2)}}\n`

    expect(longCode([{ file: 'a.ts', source }]).longFunctions).toEqual([])
  })

  it('should leave a long function nested inside another out', () => {
    const inner = `  const b = () => {\n${body(110)}  }\n`
    const source = `function a() {\n${inner}}\n`

    expect(longCode([{ file: 'a.ts', source }]).longFunctions).toEqual([
      { file: 'a.ts', line: 1, lines: 114, name: 'a' },
    ])
  })

  it('should sort functions by path then line', () => {
    const fn = (name: string): string => `function ${name}() {\n${body(120)}}\n`

    const result = longCode([
      { file: 'b.ts', source: fn('c') },
      { file: 'a.ts', source: fn('a') + fn('b') },
    ])

    expect(
      result.longFunctions.map(({ file, line }) => `${file}:${line}`),
    ).toEqual(['a.ts:1', 'a.ts:123', 'b.ts:1'])
  })
})
