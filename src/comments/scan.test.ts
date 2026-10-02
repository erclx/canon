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
const HEREDOC_SCENARIO = `#!/usr/bin/env bash
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
  it('should map TypeScript and bash extensions to their language', () => {
    expect(languageFor('src/cli.ts')).toBe('ts')
    expect(languageFor('src/app.tsx')).toBe('ts')
    expect(languageFor('scripts/run.sh')).toBe('sh')
  })

  it('should return undefined for an extension the scan does not cover', () => {
    expect(languageFor('README.md')).toBeUndefined()
    expect(languageFor('main.py')).toBeUndefined()
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
