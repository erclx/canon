import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import {
  type CitationReport,
  classifySpan,
  readCitations,
  type RuleCitation,
} from '@/gov/citations'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${body}\n`)
}

/**
 * Writes a rule under the shipped corpus with the frontmatter every rule
 * carries, so a fixture differs from a real rule only in the lines under test.
 */
function writeRule(name: string, body: string, paths: string = 'src/**'): void {
  write(
    join('governance', 'rules', name),
    ['---', 'description: Fixture', 'paths:', `  - '${paths}'`, '---', '', body]
      .join('\n')
      .trimEnd(),
  )
}

/**
 * Writes a rule under the internal corpus, which is the only one whose
 * frontmatter globs resolve against the tree.
 */
function writeInternalRule(
  name: string,
  body: string,
  paths: readonly string[],
): void {
  write(
    join('internal', 'rules', name),
    [
      '---',
      'description: Fixture',
      'paths:',
      ...paths.map((glob) => `  - '${glob}'`),
      '---',
      '',
      body,
    ]
      .join('\n')
      .trimEnd(),
  )
}

function unmatchedGlobs(
  report: Extract<CitationReport, { kind: 'measured' }>,
): string[] {
  return report.globs.filter((glob) => !glob.matched).map((glob) => glob.glob)
}

function measured(
  report: CitationReport,
): Extract<CitationReport, { kind: 'measured' }> {
  if (report.kind !== 'measured') {
    throw new Error(`Expected a measured report, got: ${report.reason}`)
  }
  return report
}

function withStatus(
  report: CitationReport,
  status: RuleCitation['status'],
): string[] {
  return measured(report)
    .citations.filter((citation) => citation.status === status)
    .map((citation) => citation.cited)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-gov-citations-'))
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('classifySpan', () => {
  // Every span below is a real line from `governance/rules/` or
  // `internal/rules/` at 2e912110, taken rather than invented, since the point
  // of each case is that the corpus already writes the shape.

  it('should read a backticked path carrying a directory segment as a citation', () => {
    expect(classifySpan('.cspell/project-terms.txt')).toBe('path')
    expect(classifySpan('scripts/core/check-plugin-boundary.sh')).toBe('path')
    expect(classifySpan('tooling/claude/seeds/CLAUDE.md')).toBe('path')
  })

  it('should read a bare rule filename as a sibling reference', () => {
    expect(classifySpan('555-tasks.md')).toBe('sibling')
  })

  it('should decline a bare filename naming a convention rather than a file', () => {
    for (const span of [
      'route.ts',
      'index.md',
      'reference.md',
      'manifest.toml',
      'components.json',
      'playwright.config.ts',
    ]) {
      expect(classifySpan(span)).toBeUndefined()
    }
  })

  it('should decline a path written with a placeholder segment', () => {
    for (const span of [
      'canon/context/<domain>.md',
      '.claude/diagrams/<kind>.md',
      'standards/<name>.md',
      '${CLAUDE_SKILL_DIR}/../../standards/<name>.md',
    ]) {
      expect(classifySpan(span)).toBeUndefined()
    }
  })

  it('should decline a path written as a glob', () => {
    expect(classifySpan('app/**/route.ts')).toBeUndefined()
  })

  it('should decline a folder, which names no document to resolve', () => {
    for (const span of ['.claude/plans/', 'src/pages/', 'wiki/concepts/']) {
      expect(classifySpan(span)).toBeUndefined()
    }
  })

  it('should decline a slash-carrying span that is not a repository path', () => {
    for (const span of [
      'next/font',
      'try/except',
      'react-hooks/set-state-in-effect',
      'oven-sh/setup-bun@v2',
      '@/lib/utils',
      '~/.claude/projects/',
      '/session-worktree',
      'file://',
    ]) {
      expect(classifySpan(span)).toBeUndefined()
    }
  })

  it('should decline a span carrying whitespace, which is a command rather than a path', () => {
    expect(
      classifySpan('bun run test:e2e -- e2e/<area>.spec.ts'),
    ).toBeUndefined()
  })
})

describe('readCitations', () => {
  it('should name a cited path that resolves to nothing', async () => {
    writeRule(
      'claude/561-teach.md',
      '- Read the glossary shape at `references/glossary.md` before promoting one.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual(['references/glossary.md'])
  })

  it('should resolve a cited path that exists', async () => {
    write('docs/agents/output-shape.md', '# Output shape')
    writeRule(
      'core/095-cli-output.md',
      '- Follow `docs/agents/output-shape.md` for the framed shapes.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual([])
    expect(withStatus(report, 'resolved')).toEqual([
      'docs/agents/output-shape.md',
    ])
  })

  it('should resolve a citation past a doubled-backtick span earlier on the line', async () => {
    write('docs/agents/output-shape.md', '# Output shape')
    writeRule(
      'core/095-cli-output.md',
      '- Reading ``canon markdown audit``, then follow `docs/agents/output-shape.md`.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual([])
    expect(withStatus(report, 'resolved')).toEqual([
      'docs/agents/output-shape.md',
    ])
  })

  it('should anchor on the whole span rather than a trailing standards pattern', async () => {
    // Cutting `standards/tooling-reference.md` out of this span and resolving
    // it against the standards root reports a file that exists as missing,
    // which is what a session measuring this corpus by hand actually did.
    write('internal/standards/tooling-reference.md', '# Tooling reference')
    writeRule(
      'claude/598-authoring-layout.md',
      '- A stack reference follows `internal/standards/tooling-reference.md`.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual([])
  })

  it('should resolve a standard the verb names against the authoring root', async () => {
    write('standards/teach.md', '# Teach')
    writeRule(
      'claude/561-teach.md',
      '- Read it with `canon standards teach`. It is the single source.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'resolved')).toEqual(['teach'])
  })

  it('should name a standard only the internal corpus carries, which the verb cannot reach', async () => {
    // `canon standards <name>` reads standards/ and then the package corpus, and
    // never internal/standards/, so a citation resolving only there refuses for
    // the session that opens it. Admitting that root here would pass it.
    write('internal/standards/tooling-reference.md', '# Tooling reference')
    writeRule(
      'claude/598-authoring-layout.md',
      '- Read it with `canon standards tooling-reference`.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual(['tooling-reference'])
  })

  it('should name a standard the verb cites that neither root carries', async () => {
    writeRule(
      'claude/561-teach.md',
      '- Read it with `canon standards glossary`.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual(['glossary'])
  })

  it('should decline the line teaching the verb form rather than calling it', async () => {
    writeRule(
      'claude/598-authoring-layout.md',
      '- Call `canon standards <name>` from a rule or a seed.',
    )
    git('add', '--all')

    const report = measured(await readCitations(ROOT))

    expect(report.citations).toEqual([])
  })

  it('should resolve a sibling rule named by filename alone', async () => {
    writeRule('claude/555-tasks.md', '- Task rules live here.')
    writeRule(
      'claude/562-session.md',
      '- Follow this rule rather than `555-tasks.md` for a `session-` file.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual([])
    expect(withStatus(report, 'resolved')).toContain('555-tasks.md')
  })

  it('should exempt a path the rule spells in its own frontmatter', async () => {
    // The retired artifact class. `560-diagrams.md` tells its reader to convert
    // a `.claude/DIAGRAMS.md` an older install left, so the file is correctly
    // absent here and correctly named there.
    writeRule(
      'claude/560-diagrams.md',
      '- Convert a `.claude/DIAGRAMS.md` left by an older install before editing it',
      '.claude/DIAGRAMS.md',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'governed')).toEqual(['.claude/DIAGRAMS.md'])
    expect(withStatus(report, 'dead')).toEqual([])
  })

  it('should still name a dead path sitting inside a glob the rule governs', async () => {
    // A glob declares a shape rather than an artifact, so a stale path under
    // one is the defect this check exists for.
    writeRule(
      'core/095-cli-output.md',
      '- Follow `docs/agents/renamed.md` for the framed shapes.',
      'docs/**',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual(['docs/agents/renamed.md'])
  })

  it('should exempt a cited path git ignores, which no clone is expected to hold', async () => {
    // Session scratch. `.claude/tasks/index.md` is real in a live project and
    // absent from a fresh clone, so resolving against the filesystem alone
    // would make the verdict depend on which tree the check ran in.
    write('.gitignore', '.claude/tasks/')
    writeRule(
      'claude/555-tasks.md',
      '- Never hand-edit `.claude/tasks/index.md`. A hook regenerates it.',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'ignored')).toEqual(['.claude/tasks/index.md'])
    expect(withStatus(report, 'dead')).toEqual([])
  })

  it('should exempt a line carrying the marker with a reason', async () => {
    writeRule(
      'claude/561-teach.md',
      '- Open `references/glossary.md` <!-- canon-allow-citation: the skill ships this, not the toolkit -->',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'exempt')).toEqual(['references/glossary.md'])
    expect(withStatus(report, 'dead')).toEqual([])
  })

  it('should ignore a bare marker carrying no reason', async () => {
    writeRule(
      'claude/561-teach.md',
      '- Open `references/glossary.md` <!-- canon-allow-citation -->',
    )
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(withStatus(report, 'dead')).toEqual(['references/glossary.md'])
  })

  it('should skip a fenced block, which displays a path rather than citing one', async () => {
    writeRule(
      'claude/561-teach.md',
      ['```bash', 'cat references/glossary.md', '```'].join('\n'),
    )
    git('add', '--all')

    const report = measured(await readCitations(ROOT))

    expect(report.citations).toEqual([])
  })

  it('should skip the frontmatter block, which declares a shape rather than a citation', async () => {
    writeRule('claude/560-diagrams.md', '- Nothing cited here.', 'src/pages/**')
    git('add', '--all')

    const report = measured(await readCitations(ROOT))

    expect(report.citations).toEqual([])
  })

  it('should read the internal corpus alongside the shipped one', async () => {
    write(
      join('internal', 'rules', 'claude', '598-authoring-layout.md'),
      [
        '---',
        'description: Fixture',
        '---',
        '',
        '- Open `references/gone.md`',
      ].join('\n'),
    )
    writeRule('claude/555-tasks.md', '- Nothing cited here.')
    git('add', '--all')

    const report = measured(await readCitations(ROOT))

    expect(report.rules).toBe(2)
    expect(withStatus(report, 'dead')).toEqual(['references/gone.md'])
  })

  it('should name an internal glob matching nothing in this tree', async () => {
    // The defect the fourth outcome names: a rule scoped at a directory that
    // moved stops firing and says nothing.
    writeInternalRule('claude/597-wiki.md', '- Wiki pages live here.', [
      'wikis/**/*.md',
    ])
    git('add', '--all')

    const report = measured(await readCitations(ROOT))

    expect(unmatchedGlobs(report)).toEqual(['wikis/**/*.md'])
  })

  it('should anchor an unmatched glob on the frontmatter line carrying it', async () => {
    writeInternalRule('claude/597-wiki.md', '- Wiki pages live here.', [
      'wiki/**/*.md',
      'wikis/**/*.md',
    ])
    write('wiki/index.md', '# Wiki')
    git('add', '--all')

    const report = measured(await readCitations(ROOT))
    const finding = report.globs.find((glob) => !glob.matched)

    expect(finding?.line).toBe(5)
  })

  it('should anchor a glob past a description line that names the same path', async () => {
    // `596-claude-md.md` names CLAUDE.md in its description and again as a
    // glob, and a substring scan finds the description first.
    write(
      join('internal', 'rules', 'claude', '596-claude-md.md'),
      [
        '---',
        'description: Enforce the shape of CLAUDE.md and its seed',
        'paths:',
        "  - 'CLAUDE.md'",
        '---',
        '',
        '- Seed rules live here.',
      ].join('\n'),
    )
    write('CLAUDE.md', '# Project')
    git('add', '--all')

    const report = measured(await readCitations(ROOT))

    expect(report.globs[0]?.line).toBe(4)
  })

  it('should accept an internal glob that matches a file', async () => {
    writeInternalRule('claude/597-wiki.md', '- Wiki pages live here.', [
      'wiki/**/*.md',
    ])
    write('wiki/concepts/rule-writing-vocabulary.md', '# Vocabulary')
    git('add', '--all')

    const report = measured(await readCitations(ROOT))

    expect(unmatchedGlobs(report)).toEqual([])
  })

  it('should read no glob from the shipped corpus, whose globs name a target', async () => {
    // `src/pages/**` in the Astro rule is indistinguishable by pattern from a
    // path here, and 32 of the 72 shipped globs match nothing in this tree
    // while every one of them is correct.
    writeRule('lang/200-astro.md', '- Astro pages live here.', 'src/pages/**')
    git('add', '--all')

    const report = measured(await readCitations(ROOT))

    expect(report.globs).toEqual([])
  })

  it('should refuse a tree holding neither rule corpus', async () => {
    write('docs/guide.md', 'No rules here.')
    git('add', '--all')

    const report = await readCitations(ROOT)

    expect(report.kind).toBe('unreadable')
  })
})
