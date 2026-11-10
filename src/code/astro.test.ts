import { describe, expect, it } from 'vitest'
import {
  astroBindings,
  astroFrontmatter,
  astroInlineScripts,
} from '@/code/astro'
import { embeddedBlocksInAstro } from '@/code/embedded'

const body = (rows: number): string[] =>
  Array.from({ length: rows }, (_, n) => `  console.log(${n})`)

const css = [
  'main {',
  '  color: red;',
  '  margin: 0;',
  '  padding: 0;',
  '  display: grid;',
  '}',
]

describe('astroFrontmatter', () => {
  it('should read nothing from a file with no fence', () => {
    expect(astroFrontmatter('<main>---</main>\n')).toBeUndefined()
  })

  it('should take only the fence at the top of the file', () => {
    const source = [
      '---',
      "const rule = 'a --- b'",
      '---',
      '<p>',
      '---',
      '</p>',
    ].join('\n')

    expect(astroFrontmatter(source)?.source.split('\n')).toEqual([
      '',
      "const rule = 'a --- b'",
      '',
      '',
      '',
      '',
    ])
  })
})

describe('astroBindings', () => {
  it('should read an identifier bound to a script or a style', () => {
    const source = [
      '---',
      "const a = ''",
      '---',
      '<script set:html={a}></script>',
      '<style is:inline set:html={ b }></style>',
    ].join('\n')

    expect(astroBindings(source)).toEqual([
      { tag: 'script', name: 'a', line: 4 },
      { tag: 'style', name: 'b', line: 5 },
    ])
  })

  it('should pass a binding built from an expression', () => {
    const source = '<script set:html={JSON.stringify(data)}></script>\n'

    expect(astroBindings(source)).toEqual([])
  })
})

describe('astroInlineScripts', () => {
  it('should read an is:inline body and pass a bundled script', () => {
    const source = [
      '<script>import "./a"</script>',
      '<script is:inline>',
      'go()',
      '</script>',
    ].join('\n')

    expect(astroInlineScripts(source)).toEqual([{ line: 2, body: '\ngo()\n' }])
  })

  it('should read a script any attribute but src leaves unprocessed', () => {
    const source = [
      '<script type="module">a()</script>',
      '<script define:vars={{ id }}>b()</script>',
      '<script src="/c.js"></script>',
    ].join('\n')

    expect(astroInlineScripts(source)).toEqual([
      { line: 1, body: 'a()' },
      { line: 2, body: 'b()' },
    ])
  })

  it('should pass a self-closing data block and read no further', () => {
    const source = [
      '<script type="application/json" set:html={JSON.stringify(x)} />',
      '<script>',
      'bundled()',
      '</script>',
      '<script type="application/ld+json">{"a": 1}</script>',
    ].join('\n')

    expect(astroInlineScripts(source)).toEqual([])
  })
})

describe('embeddedBlocksInAstro', () => {
  it('should report a frontmatter page at its line in the file', () => {
    const source = [
      '---',
      'const page = `<main>',
      ...Array.from({ length: 6 }, (_, n) => `  <p>${n}</p>`),
      '</main>`',
      '---',
      '<div />',
    ].join('\n')

    expect(embeddedBlocksInAstro('a.astro', source)).toEqual([
      { file: 'a.astro', line: 2, kind: 'page', lines: 8, branches: false },
    ])
  })

  it('should report a frontmatter string a script takes through set:html', () => {
    const source = [
      '---',
      'const code = `',
      ...body(6),
      '`',
      '---',
      '<script set:html={code}></script>',
    ].join('\n')

    expect(embeddedBlocksInAstro('a.astro', source)).toEqual([
      { file: 'a.astro', line: 2, kind: 'script', lines: 6, branches: false },
    ])
  })

  it('should report a frontmatter string a style takes through set:html', () => {
    const source = [
      '---',
      `const look = [${css.map((line) => `'${line}'`).join(', ')}].join('\\n')`,
      '---',
      '<style is:inline set:html={look}></style>',
    ].join('\n')

    expect(embeddedBlocksInAstro('a.astro', source)).toEqual([
      {
        file: 'a.astro',
        line: 2,
        kind: 'stylesheet',
        lines: 6,
        branches: false,
      },
    ])
  })

  it('should report an is:inline script body at its opening tag', () => {
    const source = ['<div />', '<script is:inline>', ...body(6), '</script>']

    expect(embeddedBlocksInAstro('a.astro', source.join('\n'))).toEqual([
      { file: 'a.astro', line: 2, kind: 'script', lines: 6, branches: false },
    ])
  })

  it('should pass an is:inline script marked with a reason', () => {
    const source = [
      '<!-- canon-allow-embedded: runs before first paint -->',
      '<script is:inline>',
      ...body(6),
      '</script>',
    ]

    expect(embeddedBlocksInAstro('a.astro', source.join('\n'))).toEqual([])
  })

  it('should pass a bound frontmatter string marked with a reason', () => {
    const source = [
      '---',
      '// canon-allow-embedded: generated per request',
      'const code = `',
      ...body(6),
      '`',
      '---',
      '<script set:html={code}></script>',
    ].join('\n')

    expect(embeddedBlocksInAstro('a.astro', source)).toEqual([])
  })

  it('should pass a short is:inline script and a short bound string', () => {
    const source = [
      '---',
      'const code = `go()`',
      '---',
      '<script set:html={code}></script>',
      '<script is:inline>',
      ...body(5),
      '</script>',
    ].join('\n')

    expect(embeddedBlocksInAstro('a.astro', source)).toEqual([])
  })

  it('should pass a long string no script or style takes', () => {
    const source = [
      '---',
      'const words = `',
      ...body(6),
      '`',
      '---',
      '<p set:html={words} />',
    ].join('\n')

    expect(embeddedBlocksInAstro('a.astro', source)).toEqual([])
  })
})
