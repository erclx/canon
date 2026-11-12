import { describe, expect, it } from 'vitest'
import { lex } from '@/code/lex'

/** The source text each JSX markup range covers, in order. */
function markup(source: string): string[] {
  return lex(source, { jsx: true }).jsx.map(({ start, end }) =>
    source.slice(start, end),
  )
}

describe('lex in JSX mode', () => {
  it('should read an apostrophe, quotes, a backtick, and slashes in text as markup', () => {
    const source = 'const a = <p>Can\'t "say" `x` // /path</p>\n'

    const result = lex(source, { jsx: true })

    expect(
      result.jsx.map(({ start, end }) => source.slice(start, end)),
    ).toEqual(['<p>Can\'t "say" `x` // /path</p>'])
    expect(result).toMatchObject({ literals: [], regexes: [] })
    expect(result.comments.size).toBe(0)
  })

  it('should end an attribute string at its own quote', () => {
    const source =
      'const a = <img title="C:\\" alt="it\'s" />\nconst b = \'c\'\n'

    const result = lex(source, { jsx: true })

    expect(markup(source)).toEqual(['<img title="C:\\" alt="it\'s" />'])
    expect(result.literals.map(({ text }) => text)).toEqual(['c'])
  })

  it('should open no regular expression at a closing or self-closing tag', () => {
    const source = 'f(() => <span>a</span>)\ng(<Foo />)\nconst r = /x/\n'

    const result = lex(source, { jsx: true })

    expect(markup(source)).toEqual(['<span>a</span>', '<Foo />'])
    expect(result.regexes).toHaveLength(1)
  })

  it('should read a fragment', () => {
    expect(markup('return <>a</>\n')).toEqual(['<>a</>'])
  })

  it('should leave the code inside a container out of the markup', () => {
    const source =
      'return (\n  <ul>\n    {items.map((x) => {\n      return <li key={x}>{`${x}`}</li>\n    })}\n    {/* note */}\n  </ul>\n)\n'

    const result = lex(source, { jsx: true })

    expect(markup(source)).toEqual([
      '<ul>\n    {',
      '<li key={',
      '}>{',
      '}</li>',
      '}\n    {',
      '}\n  </ul>',
    ])
    expect(result.literals.map(({ text }) => text)).toEqual(['\u0000'])
    expect(result.comments.size).toBe(1)
  })

  it('should read a nested element and a type argument on a tag name', () => {
    expect(markup('return <Select<T> a="1"><b>x</b></Select>\n')).toEqual([
      '<Select<T> a="1"><b>x</b></Select>',
    ])
  })

  it.each([
    ['a generic arrow with a comma', 'const f = <T,>(x: T) => x\n'],
    [
      'a generic arrow with a constraint',
      'const f = <T extends U>(x: T) => x\n',
    ],
    ['a type argument', 'const r = useRef<HTMLDivElement>(null)\n'],
    ['a comparison', 'if (a < b) c()\n'],
  ])('should read %s as code', (_shape, source) => {
    expect(markup(source)).toEqual([])
  })
})

describe('lex without JSX mode', () => {
  it('should report no markup and read a tag as code', () => {
    const source = "const a = <p>Can't</p>\n"

    const result = lex(source)

    expect(result.jsx).toEqual([])
    expect(result.literals.map(({ text }) => text)).toEqual(['t</p>'])
  })
})
