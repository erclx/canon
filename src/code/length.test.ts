import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  FILE_LINE_LIMIT,
  FUNCTION_EXTENSIONS,
  FUNCTION_LINE_CHECKPOINT,
  LENGTH_EXTENSIONS,
  LENGTH_SOURCE,
  functionSpans,
  functionSpansInFile,
  lineCount,
  longCode,
} from '@/code/length'

/**
 * The spans the compiler gives for every function with a block body, the
 * reference the brace reading is held to. Depth counts block-bodied ancestors
 * alone, since an arrow with an expression body is skipped by design. The
 * compiler parses JSX only in a file named `.tsx`.
 */
function compilerSpans(
  source: string,
  name = 'f.ts',
): { line: number; lines: number; depth: number }[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true)
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
  options: { jsx?: boolean } = {},
): { line: number; lines: number; depth: number }[] {
  return functionSpans(source, options).map(({ line, lines, depth }) => ({
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
    ['describe', "describe('a', () => {\n})\n"],
    ['it', "it('a', async () => {\n})\n"],
    ['test with a function expression', "test('a', function () {\n})\n"],
    ['a chained modifier', "it.skip('a', () => {\n})\n"],
    ['an each table', "it.each([1, 2])('a %i', (n) => {\n})\n"],
    ['a tagged each table', "describe.each`\n  a\n`('b', () => {\n})\n"],
    ['a guard holding a call', "describe.skipIf(!a())('b', () => {\n})\n"],
    [
      'an each table past a line of text',
      `it.each([\n${"  ['a long row of cases', 1],\n".repeat(8)}])('c', (n) => {\n})\n`,
    ],
    [
      'a guard nesting calls deeply',
      "describe.skipIf(!a(b(c(d()))))('e', () => {\n})\n",
    ],
  ])('should read no function in a callback passed to %s', (_call, source) => {
    expect(functionSpans(source)).toEqual([])
  })

  it('should still read a callback passed to a method named test', () => {
    const source = 'pattern.test(a, () => {\n  b()\n})\n'

    expect(functionSpans(source)).toHaveLength(1)
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

describe('functionSpans in JSX mode', () => {
  it.each([
    [
      'an apostrophe in text',
      "function A() {\n  return <p>Can't save</p>\n}\nfunction B() {\n  return 1\n}\n",
    ],
    [
      'a closing tag before a brace',
      'function A() {\n  if (a) { return <span>x</span>}\n  return <Foo />}\n',
    ],
    [
      'quotes, a backtick, and slashes in text',
      'function A() {\n  return <p>"a" `b` // /path</p>\n}\n',
    ],
    [
      'attribute strings ending at their own quote',
      'function A() {\n  return <img title="C:\\" alt="it\'s" />\n}\n',
    ],
    [
      'a container holding a block arrow',
      'function A() {\n  return (\n    <ul>\n      {items.map((x) => {\n        return <li key={x}>{`${x}`}</li>\n      })}\n      {/* } */}\n    </ul>\n  )\n}\n',
    ],
    [
      'a handler in an attribute',
      'function A() {\n  return <button onClick={() => {\n    go()\n  }}>Go</button>\n}\n',
    ],
    [
      'an object in a container after a ternary call',
      'function A() {\n  return c ? f() : <div style={{ a: 1 }}>x</div>\n}\n',
    ],
    [
      'a fragment as an arrow expression body',
      'const A = () => <>\n  <B />\n</>\nfunction C() {\n  return 1\n}\n',
    ],
    [
      'a generic arrow with a comma',
      'const f = <T,>(x: T) => {\n  return x\n}\n',
    ],
    [
      'generic signatures before a function',
      'const f: <T>(x: T) => T = g\ntype F = <T>(x: T) => T\ninterface A {\n  map: <U>(f: U) => U[]\n}\nconst h = <const T,>(x: T) => x\nconst k = <T = unknown,>(x: T) => x\nfunction B() {\n  return <b>x</b>\n}\n',
    ],
    [
      'a type argument before a call',
      'function A() {\n  const r = useRef<HTMLDivElement>(null)\n  return <div ref={r} />\n}\n',
    ],
    [
      'a type argument on a tag name',
      'function A() {\n  return <Select<T> onPick={(v) => {\n    go(v)\n  }} />\n}\n',
    ],
  ])('should match the compiler on %s', (_shape, source) => {
    expect(braceSpans(source, { jsx: true })).toEqual(
      compilerSpans(source, 'f.tsx'),
    )
  })
})

describe('functionSpansInFile', () => {
  it('should read only the frontmatter of an astro file', () => {
    const source = '---\nfunction a() {\n  return 1\n}\n---\n<div>{b}</div>\n'

    expect(functionSpansInFile('page.astro', source)).toEqual({
      kind: 'read',
      spans: [{ line: 2, lines: 3, name: 'a', depth: 0 }],
    })
  })

  it.each([
    ['a.tsx', "function A() {\n  return <span>Can't save</span>\n}\n"],
    ['a.jsx', 'function A() {\n  return <a href="/x">{b}</a>\n}\n'],
  ])('should read a function in %s', (file, source) => {
    expect(functionSpansInFile(file, source)).toEqual({
      kind: 'read',
      spans: [{ line: 1, lines: 3, name: 'A', depth: 0 }],
    })
  })

  it('should read no function in a language it cannot parse', () => {
    expect(functionSpansInFile('a.go', 'func a() {\n  return\n}\n')).toEqual({
      kind: 'read',
      spans: [],
    })
  })

  it('should read a python file by indentation', () => {
    expect(functionSpansInFile('a.py', 'def a():\n  return {}\n')).toEqual({
      kind: 'read',
      spans: [{ line: 1, lines: 2, name: 'a', depth: 0 }],
    })
  })

  it.each([
    ['tests/test_a.py', []],
    ['src/a.py', [{ line: 1, lines: 2, name: 'test_a', depth: 0 }]],
  ])(
    'should skip a test_ function only in a pytest file: %s',
    (file, spans) => {
      const source = 'def test_a():\n  pass\n'

      expect(functionSpansInFile(file, source)).toEqual({ kind: 'read', spans })
    },
  )
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

  it('should count a test file toward the file limit and not its suite callback', () => {
    const suite = `describe('a', () => {\n${body(FILE_LINE_LIMIT)}})\n`

    const result = longCode([{ file: 'a.test.ts', source: suite }])

    expect(result).toEqual({
      longFiles: [{ file: 'a.test.ts', lines: 2002 }],
      longFunctions: [],
      unreadFiles: [],
    })
  })

  it('should count a long helper declared inside a suite as top-level', () => {
    const helper = `  function build() {\n${body(110)}  }\n`
    const source = `describe('a', () => {\n${helper}})\n`

    expect(longCode([{ file: 'a.test.ts', source }]).longFunctions).toEqual([
      { file: 'a.test.ts', line: 2, lines: 112, name: 'build' },
    ])
  })

  it('should name a top-level python function past the checkpoint', () => {
    const source = `def build():\n${body(FUNCTION_LINE_CHECKPOINT)}`

    expect(longCode([{ file: 'a.py', source }]).longFunctions).toEqual([
      { file: 'a.py', line: 1, lines: 101, name: 'build' },
    ])
  })

  it('should list each python file it cannot read by path and read the rest', () => {
    const result = longCode([
      { file: 'b.py', source: 'x = """\nnever closed\n' },
      { file: 'a.py', source: 'def a():\n\t    return 1\n' },
      { file: 'c.py', source: `def a():\n${body(FUNCTION_LINE_CHECKPOINT)}` },
    ])

    expect(result).toMatchObject({
      unreadFiles: [
        { file: 'a.py', line: 2, reason: 'mixed-indent' },
        { file: 'b.py', line: 1, reason: 'unclosed-string' },
      ],
      longFunctions: [{ file: 'c.py', line: 1, lines: 101, name: 'a' }],
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

describe('published extensions', () => {
  it.each(LENGTH_EXTENSIONS)('should count a .%s file toward length', (ext) => {
    expect(LENGTH_SOURCE.test(`src/a.${ext}`)).toBe(true)
  })

  it.each(['md', 'json', 'd', 'tsx.map', 'ts.bak'])(
    'should not count a .%s file toward length',
    (ext) => {
      expect(LENGTH_SOURCE.test(`src/a.${ext}`)).toBe(false)
    },
  )

  it('should not count a dotless name that ends in an extension', () => {
    expect(LENGTH_SOURCE.test('src/ts')).toBe(false)
  })

  it('should read functions only in files the length counts', () => {
    expect(
      FUNCTION_EXTENSIONS.filter((ext) => !LENGTH_EXTENSIONS.includes(ext)),
    ).toEqual([])
  })

  it.each(FUNCTION_EXTENSIONS)('should read functions in a .%s file', (ext) => {
    const source = ext === 'py' ? 'def f():\n    pass\n' : 'function f() {\n}\n'
    const read = functionSpansInFile(`src/a.${ext}`, source)
    expect(read.kind).toBe('read')
  })

  it('should leave a css file out of the function read', () => {
    expect(functionSpansInFile('src/a.css', 'a { b: c }\n')).toEqual({
      kind: 'read',
      spans: [],
    })
  })
})
