import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  countFile,
  countFiles,
  density,
  isPruned,
  languageFor,
  type SourceFile,
  scanTree,
} from '@/comments/scan'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-comments-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seed(relativePath: string, text: string): void {
  const path = join(ROOT, relativePath)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text)
}

function file(path: string, text: string): SourceFile {
  return { path, text }
}

/**
 * The regression the sandbox exclusion exists for. Every `#` below the `<<'EOF'`
 * is a markdown heading in fixture data, and counting them is what turned a
 * measured 112 comment lines into 427.
 */
const HEREDOC_SCENARIO =
  // canon-allow-embedded: the scanner's input under test
  `#!/usr/bin/env bash
set -e

# Provision the fixture tree
stage_setup() {
  cat <<'EOF' >README.md
# API Server

## Configuration

# Not a comment either
EOF

  echo done
}
`

const TYPESCRIPT_MIX = `/**
 * A doc block explaining why this exists.
 */
export function alpha(): void {}

// An inline comment recording a decision.
export const beta = 1

/* A plain block comment. */
export const gamma = 2

const url = 'https://example.com//path'
`

describe('languageFor', () => {
  it('should map TypeScript, bash, and Python extensions to their language', () => {
    expect(languageFor('src/cli.ts')).toBe('ts')
    expect(languageFor('src/app.tsx')).toBe('ts')
    expect(languageFor('scripts/run.sh')).toBe('sh')
    expect(languageFor('pkg/main.py')).toBe('py')
  })

  it('should return undefined for an extension the scan does not cover', () => {
    expect(languageFor('README.md')).toBeUndefined()
    expect(languageFor('main.rb')).toBeUndefined()
  })
})

describe('isPruned', () => {
  it('should prune fixture trees so harness content is never counted', () => {
    expect(isPruned('sandbox/fixtures/infra/wiki/expect.toml')).toBe(true)
    expect(isPruned('src/__fixtures__/sample.ts')).toBe(true)
  })

  it('should keep ordinary source paths', () => {
    expect(isPruned('src/comments/scan.ts')).toBe(false)
    expect(isPruned('sandbox/dev/comment.sh')).toBe(false)
  })
})

describe('countFile', () => {
  it('should skip heredoc bodies so fixture headings are not bash comments', () => {
    const count = countFile(file('scenario.sh', HEREDOC_SCENARIO), 'sh')

    expect(count.commentLines).toBe(1)
  })

  it('should drop heredoc body lines from the density denominator too', () => {
    const count = countFile(file('scenario.sh', HEREDOC_SCENARIO), 'sh')

    // 15 lines, of which the 5 body lines and their `EOF` terminator are data.
    expect(count.lines).toBe(9)
  })

  it('should exclude the shebang from the bash comment count', () => {
    const count = countFile(
      file('run.sh', '#!/usr/bin/env bash\necho hi\n'),
      'sh',
    )

    expect(count.commentLines).toBe(0)
    expect(count.lines).toBe(2)
  })

  it('should count an indented bash comment', () => {
    const count = countFile(
      file('run.sh', 'main() {\n  # why this branch exists\n  run\n}\n'),
      'sh',
    )

    expect(count.commentLines).toBe(1)
  })

  it('should split TypeScript comments into doc blocks and inline comments', () => {
    const count = countFile(file('mix.ts', TYPESCRIPT_MIX), 'ts')

    expect(count.docBlocks).toBe(1)
    expect(count.inlineComments).toBe(1)
    expect(count.commentLines).toBe(5)
  })

  it('should not read a URL in a string literal as an inline comment', () => {
    const count = countFile(file('url.ts', "const u = 'https://a//b'\n"), 'ts')

    expect(count.commentLines).toBe(0)
  })

  it('should count a single-line block comment without opening a block', () => {
    const count = countFile(
      file('one.ts', '/* just this */\nconst a = 1\nconst b = 2\n'),
      'ts',
    )

    expect(count.commentLines).toBe(1)
    expect(count.docBlocks).toBe(0)
  })

  it('should report a degradation term found in a comment', () => {
    const count = countFile(
      file('a.ts', '// TODO: come back to this\nconst a = 1\n'),
      'ts',
      ['TODO'],
    )

    expect(count.degradationHits).toEqual([
      { file: 'a.ts', line: 1, term: 'TODO' },
    ])
  })

  it('should not report a degradation term inside a string literal', () => {
    const count = countFile(
      file('a.ts', "const message = 'TODO: ship this'\n"),
      'ts',
      ['TODO'],
    )

    expect(count.degradationHits).toEqual([])
  })

  it('should match an uppercase marker case-sensitively', () => {
    const count = countFile(
      file('a.ts', '// the redirect this fixed is gone now\n'),
      'ts',
      ['FIXED'],
    )

    expect(count.degradationHits).toEqual([])
  })

  it('should match a lowercase phrase in either casing', () => {
    const count = countFile(
      file('a.sh', '# Previously this used a lock file\n'),
      'sh',
      ['previously'],
    )

    expect(count.degradationHits).toHaveLength(1)
  })

  it('should require a word boundary around an alphabetic term', () => {
    const count = countFile(
      file('a.ts', '// PREFIXED keys are read from the environment\n'),
      'ts',
      ['FIXED'],
    )

    expect(count.degradationHits).toEqual([])
  })
})

describe('history in a comment', () => {
  it.each([
    ['date', 'shipped on 2026-08-20'],
    ['commit hash', 'measured against 7165dc5eb'],
    ['issue reference', 'see #723 for the thread'],
  ])('should report a %s', (term, note) => {
    const text = `// ${note}\nconst a = 1\n`
    expect(countFile(file('a.ts', text), 'ts').degradationHits).toEqual([
      { file: 'a.ts', line: 1, term },
    ])
  })

  it('should report a date inside a code span', () => {
    const text = '// the `2026-08-20` run\nconst a = 1\n'
    expect(countFile(file('a.ts', text), 'ts').degradationHits).toEqual([
      { file: 'a.ts', line: 1, term: 'date' },
    ])
  })

  it('should report history in a bash comment', () => {
    const text = '#!/usr/bin/env bash\n# fixed in #723\necho hi\n'
    expect(countFile(file('a.sh', text), 'sh').degradationHits).toEqual([
      { file: 'a.sh', line: 2, term: 'issue reference' },
    ])
  })

  it.each([
    ['a date placeholder', 'dates read as <YYYY-MM-DD>'],
    ['a number with no letter', 'retries 1234567 times'],
    ['a word with no digit', 'a defaced value'],
    ['an entity reference', 'writes &#39; for a quote'],
    ['a hex color', 'paints #1e1e1e behind it'],
  ])('should pass %s', (_, note) => {
    const text = `// ${note}\nconst a = 1\n`
    expect(countFile(file('a.ts', text), 'ts').degradationHits).toEqual([])
  })

  it('should not report a date in a string literal', () => {
    const text = "const a = '2026-08-20'\n"
    expect(countFile(file('a.ts', text), 'ts').degradationHits).toEqual([])
  })
})

describe('countFiles', () => {
  it('should total each language separately', () => {
    const counts = countFiles([
      file('a.ts', '// one\nconst a = 1\n'),
      file('b.ts', '// two\nconst b = 2\n'),
      file('c.sh', '# three\necho hi\n'),
    ])

    const ts = counts.find((entry) => entry.language === 'ts')
    const sh = counts.find((entry) => entry.language === 'sh')

    expect(ts).toMatchObject({ files: 2, lines: 4, commentLines: 2 })
    expect(sh).toMatchObject({ files: 1, lines: 2, commentLines: 1 })
  })

  it('should report only the requested languages', () => {
    const counts = countFiles([file('a.ts', 'const a = 1\n')], {
      languages: ['ts'],
    })

    expect(counts).toHaveLength(1)
    expect(counts[0].language).toBe('ts')
  })
})

describe('density', () => {
  it('should return zero for an empty tree rather than dividing by zero', () => {
    const [count] = countFiles([], { languages: ['ts'] })

    expect(density(count)).toBe(0)
  })
})

describe('scanTree', () => {
  it('should count the files on disk under the given root', async () => {
    seed('src/a.ts', '// a decision\nexport const a = 1\n')
    seed('scripts/b.sh', '#!/usr/bin/env bash\n# why\necho hi\n')

    const counts = await scanTree(ROOT)
    const ts = counts.find((entry) => entry.language === 'ts')
    const sh = counts.find((entry) => entry.language === 'sh')

    expect(ts).toMatchObject({ files: 1, commentLines: 1 })
    expect(sh).toMatchObject({ files: 1, commentLines: 1 })
  })

  it('should skip a fixture tree entirely', async () => {
    seed('src/a.ts', '// counted\nexport const a = 1\n')
    seed('src/fixtures/b.ts', '// not counted\nexport const b = 2\n')

    const [ts] = await scanTree(ROOT, { languages: ['ts'] })

    expect(ts.files).toBe(1)
    expect(ts.commentLines).toBe(1)
  })

  it('should report a hit with a path relative to the scanned root', async () => {
    seed('src/a.ts', '// HACK: temporary\nexport const a = 1\n')

    const [ts] = await scanTree(ROOT, {
      languages: ['ts'],
      vocabulary: ['HACK'],
    })

    expect(ts.degradationHits).toEqual([
      { file: 'src/a.ts', line: 1, term: 'HACK' },
    ])
  })
})

function run(prefix: string, count: number): string {
  return Array.from({ length: count }, (_, i) => `${prefix} line ${i}`).join(
    '\n',
  )
}

describe('long comment blocks', () => {
  it('should not report a run of exactly the checkpoint', () => {
    const text = `${run('//', 8)}\nconst a = 1\n`
    expect(countFile(file('a.ts', text), 'ts').longBlocks).toEqual([])
  })

  it('should report a run one past the checkpoint with its first line', () => {
    const text = `const a = 1\n${run('//', 9)}\nconst b = 2\n`
    expect(countFile(file('a.ts', text), 'ts').longBlocks).toEqual([
      { file: 'a.ts', line: 2, lines: 9 },
    ])
  })

  it('should end a run at a blank line outside a block comment', () => {
    const text = `${run('//', 6)}\n\n${run('//', 6)}\n`
    expect(countFile(file('a.ts', text), 'ts').longBlocks).toEqual([])
  })

  it('should end a run at a line of code', () => {
    const text = `${run('//', 6)}\nconst a = 1\n${run('//', 6)}\n`
    expect(countFile(file('a.ts', text), 'ts').longBlocks).toEqual([])
  })

  it('should keep a blank line inside a block comment in the run', () => {
    const body = Array.from({ length: 22 }, () => '').join('\n')
    const text = `/**\n${body}\n */\nconst a = 1\n`
    expect(countFile(file('a.ts', text), 'ts').longBlocks).toEqual([
      { file: 'a.ts', line: 1, lines: 24 },
    ])
  })

  it('should join a one-line block comment and the // lines after it', () => {
    const text = `/** summary */\n${run('//', 20)}\n`
    expect(countFile(file('a.ts', text), 'ts').longBlocks).toEqual([
      { file: 'a.ts', line: 1, lines: 21 },
    ])
  })

  it('should list only the longest run of a file', () => {
    const text = `${run('//', 22)}\nconst a = 1\n${run('//', 25)}\n`
    expect(countFile(file('a.ts', text), 'ts').longBlocks).toEqual([
      { file: 'a.ts', line: 24, lines: 25 },
    ])
  })

  it('should measure a bash run and leave the shebang out of it', () => {
    const text = `#!/usr/bin/env bash\n${run('#', 21)}\necho hi\n`
    expect(countFile(file('a.sh', text), 'sh').longBlocks).toEqual([
      { file: 'a.sh', line: 2, lines: 21 },
    ])
  })

  it('should not read a heredoc body as a run', () => {
    const text = `cat <<'EOF'\n${run('#', 30)}\nEOF\necho hi\n`
    expect(countFile(file('a.sh', text), 'sh').longBlocks).toEqual([])
  })

  it('should gather the long runs of every file of a language', () => {
    const [ts] = countFiles(
      [file('a.ts', run('//', 21)), file('b.ts', run('//', 3))],
      { languages: ['ts'] },
    )
    expect(ts.longBlocks).toEqual([{ file: 'a.ts', line: 1, lines: 21 }])
  })
})

describe('every block and its placement', () => {
  it('should list every block past the checkpoint in one file', () => {
    const text = `${run('//', 22)}\nconst a = 1\n${run('//', 25)}\n`
    expect(countFile(file('a.ts', text), 'ts').blocks).toEqual([
      { file: 'a.ts', line: 1, lines: 22, placement: 'head' },
      { file: 'a.ts', line: 24, lines: 25, placement: 'head' },
    ])
  })

  it('should read a JSDoc above a function as head and a block inside it as body', () => {
    const text = [
      '/**',
      run(' *', 12),
      ' */',
      'function a() {',
      run('  //', 11),
      '  return 1',
      '}',
      '',
    ].join('\n')
    const count = countFile(file('a.ts', text), 'ts')

    expect(count.bodyBlocks).toEqual([{ file: 'a.ts', line: 16, lines: 11 }])
    expect(count.blocks.map((block) => block.placement)).toEqual([
      'head',
      'body',
    ])
  })

  it('should pass an in-body block at the cap', () => {
    const text = `function a() {\n${run('  //', 2)}\n  return 1\n}\n`
    expect(countFile(file('a.ts', text), 'ts').bodyBlocks).toEqual([])
  })

  it('should list an in-body block one past the cap', () => {
    const text = `function a() {\n${run('  //', 3)}\n  return 1\n}\n`
    expect(countFile(file('a.ts', text), 'ts').bodyBlocks).toEqual([
      { file: 'a.ts', line: 2, lines: 3 },
    ])
  })

  it('should pass a head block of 12 lines counting its delimiters', () => {
    const text = `/**\n${run(' *', 10)}\n */\nexport const a = 1\n`
    expect(countFile(file('a.ts', text), 'ts').headBlocks).toEqual([])
  })

  it('should list a head block of 13 lines counting its delimiters', () => {
    const text = `/**\n${run(' *', 11)}\n */\nexport const a = 1\n`
    expect(countFile(file('a.ts', text), 'ts').headBlocks).toEqual([
      { file: 'a.ts', line: 1, lines: 13 },
    ])
  })

  it('should leave a long in-body block out of the head blocks', () => {
    const text = `function a() {\n${run('  //', 13)}\n  return 1\n}\n`
    expect(countFile(file('a.ts', text), 'ts').headBlocks).toEqual([])
  })

  it('should hold an unplaced bash block to the head cap', () => {
    const text = `#!/usr/bin/env bash\n${run('#', 13)}\necho hi\n`
    expect(countFile(file('a.sh', text), 'sh').headBlocks).toEqual([
      { file: 'a.sh', line: 2, lines: 13 },
    ])
  })

  it('should leave a bash block unplaced', () => {
    const text = `#!/usr/bin/env bash\n${run('#', 21)}\necho hi\n`
    const count = countFile(file('a.sh', text), 'sh')

    expect(count.blocks).toEqual([
      { file: 'a.sh', line: 2, lines: 21, placement: null },
    ])
  })
})

describe('Python comments and their placement', () => {
  const indented = (prefix: string, count: number): string =>
    run(prefix, count)
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n')

  it('should read a # block inside a def as body', () => {
    const text = ['def a():', indented('#', 11), '    return 1', ''].join('\n')
    const count = countFile(file('a.py', text), 'py')

    expect(count.bodyBlocks).toEqual([{ file: 'a.py', line: 2, lines: 11 }])
  })

  it('should read a # block trailing the last statement of a def as body', () => {
    const text = [
      'def f():',
      '    x = 1',
      '',
      indented('#', 12),
      'y = 2',
      '',
    ].join('\n')
    const count = countFile(file('a.py', text), 'py')

    expect(count.bodyBlocks).toEqual([{ file: 'a.py', line: 4, lines: 12 }])
  })

  it('should read a # block after a def at its header indent as head', () => {
    const text = ['def f():', '    x = 1', run('#', 12), 'y = 2', ''].join('\n')
    const count = countFile(file('a.py', text), 'py')

    expect(count.bodyBlocks).toEqual([])
    expect(count.blocks).toEqual([
      { file: 'a.py', line: 3, lines: 12, placement: 'head' },
    ])
  })

  it('should read a # block above a def or between methods as head', () => {
    const text = [
      run('#', 10),
      'class A:',
      '    def b(self):',
      '        return 1',
      '',
      indented('#', 11),
      '    def c(self):',
      '        return 2',
      '',
    ].join('\n')
    const count = countFile(file('a.py', text), 'py')

    expect(count.bodyBlocks).toEqual([])
    expect(count.blocks.map((block) => block.placement)).toEqual([
      'head',
      'head',
    ])
  })

  it('should count module, class, and function docstrings as head doc blocks', () => {
    const doc = (indent: string, length: number): string =>
      [
        `${indent}"""Summary.`,
        ...run(indent, length - 2).split('\n'),
        `${indent}"""`,
      ].join('\n')
    const text = [
      doc('', 12),
      'class A:',
      doc('    ', 11),
      '    def b(self):',
      doc('        ', 11),
      '        def inner():',
      doc('            ', 11),
      '            return 1',
      '        return inner',
      '',
    ].join('\n')
    const count = countFile(file('a.py', text), 'py')

    expect(count.docBlocks).toBe(4)
    expect(count.commentLines).toBe(45)
    expect(count.inlineComments).toBe(0)
    expect(count.bodyBlocks).toEqual([])
    expect(count.blocks.map((block) => block.placement)).toEqual([
      'head',
      'head',
      'head',
      'head',
    ])
  })

  it('should keep a docstring and the # lines after it in separate runs', () => {
    const text = [
      'def a():',
      '    """Doc."""',
      indented('#', 11),
      '    return 1',
      '',
    ].join('\n')
    const count = countFile(file('a.py', text), 'py')

    expect(count.bodyBlocks).toEqual([{ file: 'a.py', line: 3, lines: 11 }])
  })

  it('should count neither a # inside a string nor a string past a body opening', () => {
    const text = [
      'def a():',
      '    x = 1',
      '    """Not a docstring.',
      '    # not a comment either',
      '    """',
      '    return x',
      '',
    ].join('\n')
    const count = countFile(file('a.py', text), 'py')

    expect([count.commentLines, count.docBlocks]).toEqual([0, 0])
  })

  it('should leave the shebang out and count the comment under it', () => {
    const text = '#!/usr/bin/env python3\n# Entry point.\nprint(1)\n'
    const count = countFile(file('a.py', text), 'py')

    expect([count.commentLines, count.inlineComments]).toEqual([1, 1])
  })

  it('should count the # lines of a file the reader refuses and name it unplaced', () => {
    const text = `${run('#', 21)}\nx = (\n`
    const count = countFile(file('a.py', text), 'py')

    expect(count.commentLines).toBe(21)
    expect(count.unreadFiles).toEqual([
      { file: 'a.py', line: 22, reason: 'unclosed-bracket' },
    ])
    expect(count.blocks).toEqual([
      { file: 'a.py', line: 1, lines: 21, placement: null },
    ])
  })

  it('should report no files for a Python scan of a tree with none', () => {
    const [py] = countFiles([file('a.ts', 'const a = 1\n')], {
      languages: ['py'],
    })

    expect(py).toMatchObject({ language: 'py', files: 0, unreadFiles: [] })
  })
})
