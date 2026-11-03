import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { embeddedBlocksIn, embeddedPrograms } from '@/gate/embedded'
import type { MeasureContext } from '@/gate/measures'
import { gitEnv } from '@/git/env'

const page = (rows: number): string =>
  [
    '<main>',
    ...Array.from({ length: rows - 2 }, (_, n) => `  <p>${n}</p>`),
    '</main>',
  ].join('\n')

const template = (body: string): string => `const html = \`${body}\`\n`

describe('embeddedBlocksIn', () => {
  describe('pages', () => {
    it('should report a six-line static page', () => {
      const source = template(page(6))

      expect(embeddedBlocksIn('a.ts', source)).toEqual([
        { file: 'a.ts', line: 1, kind: 'page', lines: 6, branches: false },
      ])
    })

    it('should pass a four-line static page', () => {
      expect(embeddedBlocksIn('a.ts', template(page(4)))).toEqual([])
    })

    it('should pass a five-line static page', () => {
      expect(embeddedBlocksIn('a.ts', template(page(5)))).toEqual([])
    })

    it('should report a long page carrying one interpolation', () => {
      const source = template(`${page(8)}\n<p>\${title}</p>`)

      expect(embeddedBlocksIn('a.ts', source)).toHaveLength(1)
    })

    it('should pass a template whose lines are built from data', () => {
      const body = [
        '<ul>',
        ...Array.from({ length: 8 }, (_, n) => `<li>\${row${n}}</li>`),
        '</ul>',
      ].join('\n')

      expect(embeddedBlocksIn('a.ts', template(body))).toEqual([])
    })

    it('should report a page written as one quoted string with escaped newlines', () => {
      const source = `const html = '${page(7).replaceAll('\n', '\\n')}'\n`

      expect(embeddedBlocksIn('a.ts', source)).toHaveLength(1)
    })

    it('should pass markup in a format that is not HTML', () => {
      const source = template(
        '<rule name="a">\n# A\n</rule>\n<rule name="b">\n# B\n</rule>\n<rule>\n</rule>',
      )

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })
  })

  describe('stylesheets', () => {
    it('should report a static stylesheet past the limit', () => {
      const source = template(
        // canon-allow-embedded: the stage's own input under test
        '.a {\n  color: red;\n  top: 0;\n}\n.b {\n  left: 0;\n}',
      )

      expect(embeddedBlocksIn('a.ts', source)).toEqual([
        {
          file: 'a.ts',
          line: 1,
          kind: 'stylesheet',
          lines: 7,
          branches: false,
        },
      ])
    })
  })

  describe('scripts', () => {
    it('should report a one-line script that branches', () => {
      const source = `const stub = 'if [ "$1" = api ]; then exit 1; fi'\n`

      expect(embeddedBlocksIn('a.ts', source)).toEqual([
        { file: 'a.ts', line: 1, kind: 'script', lines: 1, branches: true },
      ])
    })

    it('should report a straight-line script with a shebang past the limit', () => {
      // canon-allow-embedded: the stage's own input under test
      const body = ['#!/usr/bin/env bash', 'a', 'b', 'c', 'd', 'e'].join('\n')

      expect(embeddedBlocksIn('a.ts', template(body))).toEqual([
        { file: 'a.ts', line: 1, kind: 'script', lines: 6, branches: false },
      ])
    })

    it('should pass a short straight-line script with a shebang', () => {
      const source = template('#!/bin/sh\nexit 0')

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })

    it('should pass a doc comment saying if, then, and done', () => {
      const source = [
        '/**',
        ' * `if` the run is green `then` the stage is done, and the loop',
        ' * for each file ends at `fi` or `done`.',
        ' */',
        '// if x; then y; fi',
        'export const a = 1',
        '',
      ].join('\n')

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })

    it('should report a one-line branching script carrying an interpolation', () => {
      const source = 'const stub = `if [ "$a" = "${b}" ]; then exit 1; fi`\n'

      expect(embeddedBlocksIn('a.ts', source)).toEqual([
        expect.objectContaining({ kind: 'script', branches: true }),
      ])
    })

    it.each([
      [
        'a closing word',
        '# Notes\n\nA run walks\nfor each file and stops when done\n',
      ],
      ['an if and a done', 'if you read this, you are done'],
      ['an if and a then', 'if it passes then the stage is done'],
    ])('should pass prose holding %s', (_, prose) => {
      const source = `const text = ${JSON.stringify(prose)}\n`

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })

    it.each([
      // canon-allow-embedded: the stage's own input under test
      ['an if', 'if [ -f x ]; then\n  exit 1\nfi'],
      // canon-allow-embedded: the stage's own input under test
      ['an indented if', '  if [ -f x ]; then\n    exit 1\n  fi'],
      // canon-allow-embedded: the stage's own input under test
      ['a for', 'for a in "$@"; do\n  echo "$a"\ndone'],
      [
        'a while reading a file',
        // canon-allow-embedded: the stage's own input under test
        'while read -r a; do\n  echo "$a"\ndone <list',
      ],
      // canon-allow-embedded: the stage's own input under test
      ['a case', 'case "$1" in\n  a) exit 0 ;;\nesac'],
    ])('should report %s', (_, script) => {
      expect(embeddedBlocksIn('a.ts', template(script))).toEqual([
        expect.objectContaining({ kind: 'script', branches: true }),
      ])
    })

    it('should read past a regular expression holding a backtick', () => {
      const source = [
        'const tick = /`/g',
        `const stub = 'if [ -f x ]; then exit 1; fi'`,
        '',
      ].join('\n')

      expect(embeddedBlocksIn('a.ts', source)).toEqual([
        { file: 'a.ts', line: 2, kind: 'script', lines: 1, branches: true },
      ])
    })
  })

  describe('an array of lines closed by a newline join', () => {
    const joined = (lines: readonly string[], separator = "'\\n'"): string =>
      `const stub = [\n${lines.map((line) => `  ${JSON.stringify(line)},`).join('\n')}\n].join(${separator})\n`

    it('should read a branching script split across literals as one block', () => {
      const source = joined(['case "$1" in', '  a) exit 0 ;;', 'esac'])

      expect(embeddedBlocksIn('a.ts', source)).toEqual([
        { file: 'a.ts', line: 1, kind: 'script', lines: 3, branches: true },
      ])
    })

    it('should report a page past the limit', () => {
      const source = joined(page(7).split('\n'))

      expect(embeddedBlocksIn('a.ts', source)).toEqual([
        expect.objectContaining({ line: 1, kind: 'page', lines: 7 }),
      ])
    })

    it('should report one block when several of its lines branch alone', () => {
      const source = joined([
        // canon-allow-embedded: the stage's own input under test
        'if [ -f a ]; then exit 1; fi',
        // canon-allow-embedded: the stage's own input under test
        'if [ -f b ]; then exit 2; fi',
      ])

      expect(embeddedBlocksIn('a.ts', source)).toHaveLength(1)
    })

    it('should read past a comment between its lines', () => {
      const source =
        "const stub = [\n  'case \"$1\" in',\n  // a comment\n  '  a) exit 0 ;;',\n  'esac',\n].join('\\n')\n"

      expect(embeddedBlocksIn('a.ts', source)).toHaveLength(1)
    })

    it.each([
      ['on its own line', '[\n  // the fake\n  \'case "$1" in\','],
      ['on the bracket line', '[ // the fake\n  \'case "$1" in\','],
      ['as a block', '[\n  /* the fake */\n  \'case "$1" in\','],
    ])('should read past a comment above its first line, %s', (_, opening) => {
      const source = `const stub = ${opening}\n  '  a) exit 0 ;;',\n  'esac',\n].join('\\n')\n`

      expect(embeddedBlocksIn('a.ts', source)).toEqual([
        { file: 'a.ts', line: 1, kind: 'script', lines: 3, branches: true },
      ])
    })

    it('should not read a comment holding a bracket as the array', () => {
      const source = `const a = 1 // [\nconst text = '<p>x</p>'\n`

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })

    it('should pass an array joined with another separator', () => {
      const source = joined(page(7).split('\n'), "' '")

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })

    it('should pass an array that is never joined', () => {
      const source = `const lines = ${JSON.stringify(page(7).split('\n'))}\n`

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })

    it('should honor a marker above the opening bracket', () => {
      const source = `// canon-allow-embedded: the input under test\n${joined(page(7).split('\n'))}`

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })
  })

  describe('the marker', () => {
    it('should pass a block whose opening line carries the marker with a reason', () => {
      const source = `// canon-allow-embedded: the scanner's input under test\n${template(page(8))}`

      expect(embeddedBlocksIn('a.ts', source)).toEqual([])
    })

    it('should report a block whose marker carries no reason', () => {
      const source = `// canon-allow-embedded:\n${template(page(8))}`

      expect(embeddedBlocksIn('a.ts', source)).toHaveLength(1)
    })
  })

  it('should report the line a block opens on', () => {
    const source = `const a = 1\nconst b = \`x \${a}\`\n${template(page(8))}`

    expect(embeddedBlocksIn('a.ts', source)).toEqual([
      expect.objectContaining({ line: 3, kind: 'page' }),
    ])
  })
})

describe('embeddedPrograms', () => {
  let root: string

  const refuse = () => {
    throw new Error('embeddedPrograms reads tracked files and runs nothing')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const git = (...args: string[]): string =>
    execaSync('git', ['-C', root, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout

  const commit = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
    git('add', '--all')
    git('commit', '-m', `add ${path}`)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-embedded-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('in a repository', () => {
    beforeEach(() => {
      git('init', '--initial-branch=main')
      git('config', 'user.email', 'test@example.com')
      git('config', 'user.name', 'Test')
    })

    it('should pass a tree whose sources embed nothing past the limit', async () => {
      commit('src/a.ts', template(page(4)))

      const report = await embeddedPrograms(context())

      expect(report.failure).toBeUndefined()
      expect(report.emissions[0]?.text).toContain('1 source file')
    })

    it('should fail naming the file and line of an embedded page', async () => {
      commit('src/a.ts', template(page(8)))

      const report = await embeddedPrograms(context())

      expect(report.failure).toBeDefined()
      expect(report.emissions[0]?.text).toContain('src/a.ts:1')
    })

    it('should not read a file that is not TypeScript', async () => {
      commit('src/page.js', template(page(8)))

      const report = await embeddedPrograms(context())

      expect(report.failure).toBeUndefined()
    })
  })

  it('should read a tree git cannot list as unmeasured', async () => {
    writeFileSync(join(root, 'a.ts'), template(page(8)))

    const report = await embeddedPrograms(context())

    expect(report.unmeasured).toBeDefined()
  })
})
