import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import {
  auditCitations,
  citationPattern,
  collectCitations,
  IGNORE_MARKER,
  isFixture,
} from '@/context/citations'

const PATTERN = citationPattern(['context', 'diagrams'])

function paths(text: string, rel = 'docs/agents.md'): string[] {
  return collectCitations(rel, text, PATTERN).map((citation) => citation.path)
}

describe('citationPattern', () => {
  it('should match a path in an audited folder', () => {
    expect(paths('See `canon/context/cli.md` for the layout.')).toEqual([
      'canon/context/cli.md',
    ])
  })

  it('should match a path nested under a split domain', () => {
    expect(paths('Read `canon/context/claude-plugin/skills.md`.')).toEqual([
      'canon/context/claude-plugin/skills.md',
    ])
  })

  it('should not match a folder outside the audited set', () => {
    expect(paths('Read `.claude/standards/prose.md` first.')).toEqual([])
  })

  it('should match a path at the new record root', () => {
    expect(paths('See `.canon/diagrams/deploy.md` for the flow.')).toEqual([
      '.canon/diagrams/deploy.md',
    ])
  })

  it('should not match a folder outside the audited set at the new root', () => {
    expect(paths('Read `.canon/standards/prose.md` first.')).toEqual([])
  })

  it('should read a path at the record root rather than as a canon/ citation', () => {
    expect(paths('See `.canon/diagrams/a.md` for the flow.')).toEqual([
      '.canon/diagrams/a.md',
    ])
  })

  it('should match a path at the new surface root', () => {
    expect(paths('See `canon/context/cli.md` for the layout.')).toEqual([
      'canon/context/cli.md',
    ])
  })

  it('should not match a path under a vendored canon/ dependency', () => {
    expect(
      paths('See `node_modules/canon/context/cli.md` for the vendored copy.'),
    ).toEqual([])
  })

  it('should match a relative link whose root sits right after the slash', () => {
    expect(paths('See `../canon/context/x.md` for the entry.')).toEqual([
      'canon/context/x.md',
    ])
  })

  it('should match a relative link into the record root', () => {
    expect(paths('See `../.canon/diagrams/x.md` for the entry.')).toEqual([
      '.canon/diagrams/x.md',
    ])
  })

  it('should not match a bare-root path prefixed by a name character', () => {
    expect(paths('See `9canon/context/x.md` for the entry.')).toEqual([])
  })

  it('should match a backticked bare-root citation with no preceding path segment', () => {
    expect(paths('See `canon/context/x.md` for the entry.')).toEqual([
      'canon/context/x.md',
    ])
  })

  it('should match a relative link into the dotted surface root', () => {
    // canon-keep-surface-root
    expect(paths('See `../.claude/context/x.md` for the entry.')).toEqual([
      // canon-keep-surface-root
      '.claude/context/x.md',
    ])
  })

  it('should not match a bare root nested under another folder', () => {
    expect(
      paths('See `tooling/base/seeds/canon/context/x.md` for the seed.'),
    ).toEqual([])
  })
})

describe('collectCitations', () => {
  it('should report the line the citation sits on', () => {
    const found = collectCitations(
      'docs/agents.md',
      'First.\nSecond.\nSee `canon/context/cli.md`.\n',
      PATTERN,
    )

    expect(found).toEqual([
      { file: 'docs/agents.md', line: 3, path: 'canon/context/cli.md' },
    ])
  })

  it('should collect every citation on one line', () => {
    expect(
      paths('Both `canon/context/cli.md` and `.claude/diagrams/index.md`.'),
    ).toEqual(['canon/context/cli.md', '.claude/diagrams/index.md'])
  })

  it('should skip a fenced block in markdown', () => {
    const text = [
      'Good: See `canon/context/cli.md`.',
      '',
      '```markdown',
      'Bad: See `canon/context/retrieval.md` for the flow.',
      '```',
      '',
      'Also `.claude/diagrams/index.md`.',
    ].join('\n')

    expect(paths(text)).toEqual([
      'canon/context/cli.md',
      '.claude/diagrams/index.md',
    ])
  })

  it('should keep scanning a shell file whose text contains a fence', () => {
    const text = ['echo "```"', 'echo "see canon/context/cli.md"'].join('\n')

    expect(paths(text, 'scripts/core/thing.sh')).toEqual([
      'canon/context/cli.md',
    ])
  })

  it('should skip a line carrying the bare ignore marker', () => {
    const text = `One \`canon/context/web.md\` per domain. <!-- ${IGNORE_MARKER} -->`

    expect(paths(text)).toEqual([])
  })

  it('should skip only the path a named ignore marker lists', () => {
    const text = `Placeholder \`canon/context/X.md\` beside real \`canon/context/cli.md\`. <!-- ${IGNORE_MARKER}: canon/context/X.md -->`

    expect(paths(text)).toEqual(['canon/context/cli.md'])
  })

  it('should skip every path a named ignore marker lists', () => {
    const text = `Both \`canon/context/web.md\` and \`canon/context/api.md\` are placeholders. <!-- ${IGNORE_MARKER}: canon/context/web.md, canon/context/api.md -->`

    expect(paths(text)).toEqual([])
  })
})

describe('auditCitations', () => {
  it('should report unavailable rather than clean outside a git repository', async () => {
    const root = mkdtempSync(join(tmpdir(), 'canon-citations-'))

    try {
      expect(await auditCitations(root, ['context'])).toEqual({
        kind: 'unavailable',
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('auditCitations against a real tree', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-citations-tree-'))
    // A git hook exports GIT_DIR into every process it runs, and it takes
    // precedence over `cwd`, so an inherited environment initializes the
    // repository somewhere other than the fixture and every case reads empty.
    execSync('git init --quiet', { cwd: root, env: gitEnv() })
    mkdirSync(join(root, 'canon', 'context'), { recursive: true })
    writeFileSync(join(root, 'canon', 'context', 'cli.md'), '# CLI\n')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should report a citation naming a path that does not exist', async () => {
    writeFileSync(
      join(root, 'README.md'),
      'See `canon/context/missing.md` for the layout.\n',
    )

    const report = await auditCitations(root, ['context'])

    expect(report).toMatchObject({
      kind: 'scanned',
      unresolved: [
        {
          file: 'README.md',
          path: 'canon/context/missing.md',
        },
      ],
    })
  })

  it('should leave a citation naming a path that exists unresolved-free', async () => {
    writeFileSync(
      join(root, 'README.md'),
      'See `canon/context/cli.md` for the layout.\n',
    )

    const report = await auditCitations(root, ['context'])

    expect(report).toMatchObject({ kind: 'scanned', unresolved: [] })
  })

  it('should skip a broken path carrying the ignore marker', async () => {
    writeFileSync(
      join(root, 'README.md'),
      `Cite it as \`canon/context/X.md\`. <!-- ${IGNORE_MARKER} -->\n`,
    )

    const report = await auditCitations(root, ['context'])

    expect(report).toMatchObject({ kind: 'scanned', unresolved: [] })
  })

  it('should still report a real broken path beside a named placeholder', async () => {
    writeFileSync(
      join(root, 'README.md'),
      `Placeholder \`canon/context/X.md\` beside broken \`canon/context/missing.md\`. <!-- ${IGNORE_MARKER}: canon/context/X.md -->\n`,
    )

    const report = await auditCitations(root, ['context'])

    expect(report).toMatchObject({
      kind: 'scanned',
      unresolved: [{ file: 'README.md', path: 'canon/context/missing.md' }],
    })
  })
})

describe('isFixture', () => {
  it.each([
    'scripts/sandbox/claude/docs.sh',
    'scripts/eval/result-context.md',
    'src/docs/read.test.ts',
    'src/gov/fixtures/rule.md',
    'src/gov/__fixtures__/rule.md',
  ])('should treat %s as a fixture', (rel) => {
    expect(isFixture(rel)).toBe(true)
  })

  it.each(['docs/agents.md', 'canon/context/cli.md', 'src/context/audit.ts'])(
    'should treat %s as a real reference',
    (rel) => {
      expect(isFixture(rel)).toBe(false)
    },
  )
})
