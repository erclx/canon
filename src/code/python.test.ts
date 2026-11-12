import { describe, expect, it } from 'vitest'
import {
  isPythonTestFile,
  pythonComments,
  pythonFunctionSpans,
} from '@/code/python'

function spans(source: string, skipTests = false): unknown {
  const read = pythonFunctionSpans(source, { skipTests })
  return read.kind === 'read' ? read.spans : read
}

describe('pythonFunctionSpans', () => {
  it('should open a decorated function on its def line', () => {
    const source = '@cache\n@route("/a")\ndef a():\n    return 1\n'

    expect(spans(source)).toEqual([{ line: 3, lines: 2, name: 'a', depth: 0 }])
  })

  it('should read a one-line def as one line', () => {
    expect(spans('def a(): ...\nx = 1\n')).toEqual([
      { line: 1, lines: 1, name: 'a', depth: 0 },
    ])
  })

  it('should read an async def', () => {
    expect(spans('async def a():\n    await b()\n')).toEqual([
      { line: 1, lines: 2, name: 'a', depth: 0 },
    ])
  })

  it('should read a signature spanning lines, with a colon in a default', () => {
    const source =
      'def a(\n    x: int,\n    y=lambda z: z,\n) -> dict[str, int]:\n    return {}\n'

    expect(spans(source)).toEqual([{ line: 1, lines: 5, name: 'a', depth: 0 }])
  })

  it('should give a method depth 0 and a nested def depth 1', () => {
    const source = [
      'class A:',
      '    def b(self):',
      '        def c():',
      '            return 1',
      '        return c',
      '',
    ].join('\n')

    expect(spans(source)).toEqual([
      { line: 3, lines: 2, name: 'c', depth: 1 },
      { line: 2, lines: 4, name: 'b', depth: 0 },
    ])
  })

  it('should continue a body past a string holding text at column 0', () => {
    const source = 'def a():\n    s = """\nnot code\n"""\n    return s\nx = 1\n'

    expect(spans(source)).toEqual([{ line: 1, lines: 5, name: 'a', depth: 0 }])
  })

  it('should end a body on its last code line past dedented comments and blanks', () => {
    const source = 'def a():\n    x = 1\n# note\n\n    return x\n\n# end\n'

    expect(spans(source)).toEqual([{ line: 1, lines: 5, name: 'a', depth: 0 }])
  })

  it('should continue a body past a line continuation', () => {
    const source = 'def a():\n    x = 1 + \\\n2\n    return x\ny = 1\n'

    expect(spans(source)).toEqual([{ line: 1, lines: 4, name: 'a', depth: 0 }])
  })

  it('should continue a body past a dedented line inside brackets', () => {
    const source = 'def a():\n    x = [\n1,\n]\n    return x\n'

    expect(spans(source)).toEqual([{ line: 1, lines: 5, name: 'a', depth: 0 }])
  })

  it('should read an unparenthesized except clause', () => {
    const source =
      'def a():\n    try:\n        b()\n    except ValueError, TypeError:\n        pass\n'

    expect(spans(source)).toEqual([{ line: 1, lines: 5, name: 'a', depth: 0 }])
  })

  it('should read a template string with a nested quote in its field', () => {
    const source = 'def a(d):\n    return t"{d["k"]} #{1}"\nb = 1\n'

    expect(spans(source)).toEqual([{ line: 1, lines: 2, name: 'a', depth: 0 }])
  })

  it('should read no def inside a string or a comment', () => {
    const source = '# def a():\ns = "def b(): pass"\n'

    expect(spans(source)).toEqual([])
  })

  it('should skip a test_ function and give a helper inside it no depth', () => {
    const source =
      'def test_a():\n    def helper():\n        return 1\n    assert helper()\ndef b():\n    pass\n'

    expect(spans(source, true)).toEqual([
      { line: 2, lines: 2, name: 'helper', depth: 0 },
      { line: 5, lines: 2, name: 'b', depth: 0 },
    ])
  })

  it.each([
    [
      'a triple-quoted string',
      'def a():\n    """doc\n    x = 1\n',
      2,
      'unclosed-string',
    ],
    [
      'a single-quoted string at a newline',
      "x = 'a\ny = 1\n",
      1,
      'unclosed-string',
    ],
    ['a bracket', 'x = 1\ny = (\n    [1,\n', 2, 'unclosed-bracket'],
    [
      'tabs and spaces in one indent',
      'def a():\n\t    return 1\n',
      2,
      'mixed-indent',
    ],
    [
      'indents whose order depends on the tab width',
      'def a():\n        x = 1\n\ty = 2\n',
      3,
      'mixed-indent',
    ],
  ])(
    'should report a file with %s as unread',
    (_case, source, line, reason) => {
      expect(spans(source)).toEqual({ kind: 'unread', line, reason })
    },
  )
})

describe('isPythonTestFile', () => {
  it.each([
    ['tests/test_a.py', true],
    ['a_test.py', true],
    ['src/a.py', false],
    ['src/test_a/b.py', false],
  ])('should read %s as a test file: %s', (file, expected) => {
    expect(isPythonTestFile(file)).toBe(expected)
  })
})

describe('pythonComments', () => {
  function layout(source: string): unknown {
    const read = pythonComments(source)
    return read.kind === 'read'
      ? { comments: read.comments, docstrings: read.docstrings }
      : read
  }

  it('should read a module, a class, and a method docstring', () => {
    const source = [
      '"""Module."""',
      'class A:',
      "    '''Class.",
      '',
      "    More.'''",
      '    def b(self):',
      '        r"""Method."""',
      '        return 1',
      '',
    ].join('\n')

    expect(layout(source)).toEqual({
      comments: [],
      docstrings: [
        { start: 1, end: 1 },
        { start: 3, end: 5 },
        { start: 7, end: 7 },
      ],
    })
  })

  it('should not read a string that is not first in a body as a docstring', () => {
    const source = 'def a():\n    x = 1\n    """Not a docstring."""\n'

    expect(layout(source)).toEqual({ comments: [], docstrings: [] })
  })

  it('should not read a bytes or formatted string as a docstring', () => {
    const source = 'def a():\n    f"""{x}"""\ndef b():\n    b"""x"""\n'

    expect(layout(source)).toEqual({ comments: [], docstrings: [] })
  })

  it('should read a decorated function docstring under its header', () => {
    const source = '@cache\ndef a():\n    """Doc."""\n'

    expect(layout(source)).toEqual({
      comments: [],
      docstrings: [{ start: 3, end: 3 }],
    })
  })

  it('should not read a # inside a string as a comment', () => {
    const source = 'x = """\n# not a comment\n"""\n# a comment\n'

    expect(layout(source)).toEqual({ comments: [4], docstrings: [] })
  })

  it('should return a file the lexer cannot close as unread', () => {
    expect(layout('x = """\n# open\n')).toEqual({
      kind: 'unread',
      line: 1,
      reason: 'unclosed-string',
    })
  })
})
