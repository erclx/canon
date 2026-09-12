import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  collisions,
  destinationPath,
  ignoresDestination,
  isExcludedPath,
  isRecordArtifact,
  MOVED_ENTRIES,
  planFolderMoves,
  planRecordsMove,
  referencesExcluded,
  rewriteText,
  scanText,
  sourcePath,
} from '@/migrate/records'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-records-migrate-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('MOVED_ENTRIES', () => {
  it('should carry the twelve ignore entries the move collapsed', () => {
    expect(MOVED_ENTRIES).toHaveLength(12)
  })

  it('should leave the worktrees folder where the harness requires it', () => {
    expect(MOVED_ENTRIES).not.toContain('worktrees')
  })

  it('should leave every committed surface out', () => {
    for (const kept of ['context', 'rules', 'skills', 'hooks', 'canon']) {
      expect(MOVED_ENTRIES).not.toContain(kept)
    }
  })
})

describe('destinationPath', () => {
  it('should drop the scratch folder dot at the new root', () => {
    expect(destinationPath('.tmp')).toBe('.canon/tmp')
  })

  it('should keep the history directory dot, which marks a mechanism', () => {
    expect(destinationPath('.records.git')).toBe('.canon/.records.git')
  })

  it('should carry every other name through unchanged', () => {
    expect(destinationPath('memory')).toBe('.canon/memory')
  })
})

describe('rewriteText', () => {
  it('should rewrite a citation carrying a trailing path', () => {
    expect(rewriteText('see `.claude/plans/feature-x.md` for it')).toBe(
      'see `.canon/plans/feature-x.md` for it',
    )
  })

  it('should rewrite a bare folder citation with no trailing slash', () => {
    expect(rewriteText('the board lives at .claude/tasks')).toBe(
      'the board lives at .canon/tasks',
    )
  })

  it('should rename the scratch folder as it moves it', () => {
    expect(rewriteText('.claude/.tmp/gov/rules.md')).toBe(
      '.canon/tmp/gov/rules.md',
    )
  })

  it('should leave a committed folder alone', () => {
    const text = '.claude/context/index.md and .claude/rules/core/005.md'
    expect(rewriteText(text)).toBe(text)
  })

  it('should leave the worktrees carve-out alone', () => {
    expect(rewriteText('.claude/worktrees/<name>/')).toBe(
      '.claude/worktrees/<name>/',
    )
  })

  it('should leave a retired flat archive at the root it actually sat under', () => {
    const text = '.claude/plans-archive/ and .claude/task-archive/'
    expect(rewriteText(text)).toBe(text)
  })

  it('should leave a marked line alone', () => {
    const text = 'a fallback <!-- canon-keep-record-root --> .claude/memory/'
    expect(rewriteText(text)).toBe(text)
  })

  it('should leave the line below a marker alone', () => {
    const text = '<!-- canon-keep-record-root -->\n.claude/memory/x.md'
    expect(rewriteText(text)).toBe(text)
  })

  it('should resume rewriting two lines below a marker', () => {
    const text =
      '<!-- canon-keep-record-root -->\n.claude/memory/a.md\n.claude/memory/b.md'
    expect(rewriteText(text)).toBe(
      '<!-- canon-keep-record-root -->\n.claude/memory/a.md\n.canon/memory/b.md',
    )
  })

  it('should leave a paragraph separated from its marker by a blank line alone', () => {
    const text = '<!-- canon-keep-record-root -->\n\n.claude/memory/x.md'
    expect(rewriteText(text)).toBe(text)
  })

  it('should resume rewriting the line after a blank-separated protected paragraph', () => {
    const text =
      '<!-- canon-keep-record-root -->\n\n.claude/memory/a.md\n.claude/memory/b.md'
    expect(rewriteText(text)).toBe(
      '<!-- canon-keep-record-root -->\n\n.claude/memory/a.md\n.canon/memory/b.md',
    )
  })

  it('should be idempotent over an already-swept tree', () => {
    const once = rewriteText('.claude/plans/x.md and .claude/.tmp/y')
    expect(rewriteText(once)).toBe(once)
  })

  it('should leave an inline-scalar frontmatter paths: value alone', () => {
    const text = [
      '---',
      "paths: '.claude/tasks/**'",
      '---',
      '',
      'See .claude/tasks/ for the board.',
    ].join('\n')

    expect(rewriteText(text)).toBe(
      [
        '---',
        "paths: '.claude/tasks/**'",
        '---',
        '',
        'See .canon/tasks/ for the board.',
      ].join('\n'),
    )
  })

  it('should leave a rule frontmatter paths: glob alone while rewriting prose beside it', () => {
    const text = [
      '---',
      'description: covers the task board',
      'paths:',
      "  - '.claude/tasks/**'",
      '---',
      '',
      '# Tasks standards',
      '',
      'See .claude/tasks/ for the board.',
    ].join('\n')

    const rewritten = rewriteText(text)

    expect(rewritten).toBe(
      [
        '---',
        'description: covers the task board',
        'paths:',
        "  - '.claude/tasks/**'",
        '---',
        '',
        '# Tasks standards',
        '',
        'See .canon/tasks/ for the board.',
      ].join('\n'),
    )
  })

  it('should leave a citation prefixed by a domain-shaped path segment alone', () => {
    const text = 'clone at erclx.dev/.claude/tasks/x.md'
    expect(rewriteText(text)).toBe(text)
  })

  it('should leave a citation two path segments deep alone', () => {
    const text = 'see public/erclx.dev/.claude/tasks/x.md'
    expect(rewriteText(text)).toBe(text)
  })

  it('should rewrite a citation prefixed by a shell-glob segment', () => {
    const text = 'case */.claude/tasks/*) rm -rf "$1" ;;'
    expect(rewriteText(text)).toBe('case */.canon/tasks/*) rm -rf "$1" ;;')
  })

  it('should rewrite a citation prefixed by a variable-substitution segment', () => {
    const text = 'rm -rf $project/.claude/.tmp/x'
    expect(rewriteText(text)).toBe('rm -rf $project/.canon/tmp/x')
  })

  it('should leave a citation sharing a paragraph with a Measured at sentence alone', () => {
    const text = [
      'A `.claude/tasks/x.md` line explains the move.',
      'Measured at `abc123` on 2026-08-20.',
    ].join('\n')
    expect(rewriteText(text)).toBe(text)
  })

  it('should leave a citation sharing a paragraph with a plain journal date alone', () => {
    const text = [
      'A 2026-05-31 journal entry now points a reply draft at',
      '`.claude/memory/x.md`.',
    ].join('\n')
    expect(rewriteText(text)).toBe(text)
  })

  it('should rewrite a citation once a blank line separates it from the dated sentence', () => {
    const text = [
      'Measured at `abc123` on 2026-08-20.',
      '',
      'A `.claude/tasks/x.md` line explains the move.',
    ].join('\n')
    expect(rewriteText(text)).toBe(
      [
        'Measured at `abc123` on 2026-08-20.',
        '',
        'A `.canon/tasks/x.md` line explains the move.',
      ].join('\n'),
    )
  })
})

describe('scanText', () => {
  it('should count what it would rewrite', () => {
    expect(scanText('.claude/plans/a.md .claude/tasks/b.md').rewritten).toBe(2)
  })

  it('should count a marked citation as kept rather than rewritten', () => {
    const counts = scanText('.claude/memory/a.md canon-keep-record-root')
    expect(counts).toEqual({
      rewritten: 0,
      kept: 1,
      globs: 0,
      crossRepo: 0,
      dated: 0,
    })
  })

  it('should count a citation kept across a blank line as kept', () => {
    const counts = scanText(
      '<!-- canon-keep-record-root -->\n\n.claude/memory/x.md',
    )
    expect(counts).toEqual({
      rewritten: 0,
      kept: 1,
      globs: 0,
      crossRepo: 0,
      dated: 0,
    })
  })

  it('should count nothing in prose naming no moved entry', () => {
    expect(scanText('.claude/rules/core/005.md')).toEqual({
      rewritten: 0,
      kept: 0,
      globs: 0,
      crossRepo: 0,
      dated: 0,
    })
  })

  it('should count a frontmatter paths: glob citation as a glob rather than a rewrite', () => {
    const text = [
      '---',
      'paths:',
      "  - '.claude/tasks/**'",
      '---',
      '',
      'See .claude/tasks/ for the board.',
    ].join('\n')

    expect(scanText(text)).toEqual({
      rewritten: 1,
      kept: 0,
      globs: 1,
      crossRepo: 0,
      dated: 0,
    })
  })

  it('should count a cross-repo-shaped citation apart from a rewrite', () => {
    expect(scanText('clone at erclx.dev/.claude/tasks/x.md')).toEqual({
      rewritten: 0,
      kept: 0,
      globs: 0,
      crossRepo: 1,
      dated: 0,
    })
  })

  it('should count a dated-paragraph citation apart from a rewrite', () => {
    const text =
      'A `.claude/tasks/x.md` line.\nMeasured at `abc` on 2026-08-20.'
    expect(scanText(text)).toEqual({
      rewritten: 0,
      kept: 0,
      globs: 0,
      crossRepo: 0,
      dated: 1,
    })
  })
})

describe('isExcludedPath', () => {
  it('should exclude the changelog, which records what shipped', () => {
    expect(isExcludedPath('CHANGELOG.md')).toBe(true)
  })

  it('should exclude the module stating the roots', () => {
    expect(isExcludedPath('src/record-root.ts')).toBe(true)
  })

  it('should exclude the module stating the surface roots', () => {
    expect(isExcludedPath('src/surface-root.ts')).toBe(true)
  })

  it('should exclude its own source', () => {
    expect(isExcludedPath('src/migrate/records.ts')).toBe(true)
  })

  it('should exclude a test asserting the old root still resolves', () => {
    expect(isExcludedPath('src/tasks/archive.test.ts')).toBe(true)
  })

  it('should exclude an eval transcript', () => {
    expect(isExcludedPath('scripts/eval/result-2026-08-20.md')).toBe(true)
  })

  it('should sweep an ordinary shipped body', () => {
    expect(isExcludedPath('claude/skills/auto-ship/SKILL.md')).toBe(false)
  })
})

describe('referencesExcluded', () => {
  it('should read a literal excluded prefix inside the text', () => {
    expect(referencesExcluded('see .claude/hooks/standards-audit.sh')).toBe(
      true,
    )
  })

  it('should read a literal excluded path inside the text', () => {
    expect(referencesExcluded('shipped in CHANGELOG.md already')).toBe(true)
  })

  it('should not read a live citation alone as excluded', () => {
    expect(referencesExcluded('see .claude/tasks/x.md')).toBe(false)
  })

  it('should not read an excluded test suffix, which it does not check', () => {
    expect(referencesExcluded('see src/tasks/archive.test.ts')).toBe(false)
  })
})

describe('isRecordArtifact', () => {
  it('should read the whole new root as records', () => {
    expect(isRecordArtifact('.canon/memory/user-erclx.md')).toBe(true)
  })

  it('should read a new-root folder the entry list has never heard of', () => {
    expect(isRecordArtifact('.canon/unheard-of/a.md')).toBe(true)
  })

  it('should read the new root named bare', () => {
    expect(isRecordArtifact('.canon')).toBe(true)
  })

  it('should read the backup history under the new root', () => {
    expect(isRecordArtifact('.canon/.records.git/objects/ab/0123')).toBe(true)
  })

  it('should read an old-root record folder per entry', () => {
    expect(isRecordArtifact('.claude/plans/feature-x.md')).toBe(true)
  })

  it('should read the old-root scratch folder at its own spelling', () => {
    expect(isRecordArtifact('.claude/.tmp/gov/rules.md')).toBe(true)
  })

  it('should sweep a committed file under the old root', () => {
    expect(isRecordArtifact('.claude/rules/core/035-tasks.md')).toBe(false)
  })

  it('should sweep every other committed surface under the old root', () => {
    for (const path of [
      '.claude/context/index.md',
      '.claude/skills/internal-scripts/SKILL.md',
      '.claude/hooks/scratch-guard.sh',
      '.claude/ARCHITECTURE.md',
      '.claude/settings.json',
    ]) {
      expect(isRecordArtifact(path)).toBe(false)
    }
  })

  it('should sweep the worktrees carve-out the harness owns', () => {
    expect(isRecordArtifact('.claude/worktrees/a/src/x.ts')).toBe(false)
  })

  it('should sweep a retired flat archive, which sat outside the entries', () => {
    expect(isRecordArtifact('.claude/plans-archive/feature-x.md')).toBe(false)
  })

  it('should not take an entry name as a prefix of a longer folder', () => {
    expect(isRecordArtifact('.claude/tasks-board/a.md')).toBe(false)
  })

  it('should sweep an ordinary source file', () => {
    expect(isRecordArtifact('src/migrate/apply.ts')).toBe(false)
  })

  it('should sweep a fixture whose path merely contains a record folder', () => {
    expect(
      isRecordArtifact('scripts/sandbox/fixtures/create/.claude/tasks/a.md'),
    ).toBe(false)
  })
})

describe('planFolderMoves', () => {
  it('should name only the entries on disk', () => {
    mkdirSync(join(root, '.claude', 'plans'), { recursive: true })
    mkdirSync(join(root, '.claude', 'memory'), { recursive: true })

    expect(planFolderMoves(root)).toEqual([
      { from: '.claude/memory', to: '.canon/memory' },
      { from: '.claude/plans', to: '.canon/plans' },
    ])
  })

  it('should carry the scratch rename into the plan', () => {
    mkdirSync(join(root, '.claude', '.tmp'), { recursive: true })

    expect(planFolderMoves(root)).toEqual([
      { from: '.claude/.tmp', to: '.canon/tmp' },
    ])
  })

  it('should leave the worktrees folder out of the plan', () => {
    mkdirSync(join(root, '.claude', 'worktrees'), { recursive: true })

    expect(planFolderMoves(root)).toEqual([])
  })

  it('should plan nothing for a tree that has already moved', () => {
    mkdirSync(join(root, '.canon', 'plans'), { recursive: true })

    expect(planFolderMoves(root)).toEqual([])
  })
})

describe('collisions', () => {
  it('should name a destination the new root already carries', () => {
    mkdirSync(join(root, '.claude', 'memory'), { recursive: true })
    mkdirSync(join(root, '.canon', 'memory'), { recursive: true })

    expect(collisions(root, planFolderMoves(root))).toEqual(['.canon/memory'])
  })

  it('should name nothing when the new root is empty', () => {
    mkdirSync(join(root, '.claude', 'memory'), { recursive: true })

    expect(collisions(root, planFolderMoves(root))).toEqual([])
  })
})

describe('ignoresDestination', () => {
  it('should read the root entry with its trailing slash', () => {
    expect(ignoresDestination('node_modules/\n.canon/\n')).toBe(true)
  })

  it('should read it without one', () => {
    expect(ignoresDestination('.canon')).toBe(true)
  })

  it('should refuse a file that only ignores the old folders', () => {
    expect(ignoresDestination('.claude/plans/\n.claude/tasks/\n')).toBe(false)
  })

  it('should not accept a deeper entry as covering the root', () => {
    expect(ignoresDestination('.canon/memory/\n')).toBe(false)
  })
})

describe('sourcePath', () => {
  it('should spell the old root', () => {
    expect(sourcePath('tasks')).toBe('.claude/tasks')
  })

  it('should keep the scratch dot on the way out', () => {
    expect(sourcePath('.tmp')).toBe('.claude/.tmp')
  })

  it('should write into the tree the move reads', () => {
    mkdirSync(join(root, sourcePath('memory')), { recursive: true })
    writeFileSync(join(root, sourcePath('memory'), 'a.md'), 'x')

    expect(planFolderMoves(root)).toEqual([
      { from: '.claude/memory', to: '.canon/memory' },
    ])
  })
})

describe('planRecordsMove', () => {
  it('should carry a file whose citations move', () => {
    const plan = planRecordsMove(root, [
      { path: 'docs/a.md', text: 'see .claude/plans/x.md' },
    ])

    expect(plan.entries).toEqual([
      {
        path: 'docs/a.md',
        text: 'see .canon/plans/x.md',
        rewritten: 1,
        kept: 0,
      },
    ])
    expect(plan.rewritten).toBe(1)
  })

  it('should drop a file whose text does not change', () => {
    const plan = planRecordsMove(root, [
      { path: 'docs/a.md', text: 'see .claude/rules/core/005.md' },
    ])

    expect(plan.entries).toEqual([])
  })

  it('should report an excluded file only when it carries a citation', () => {
    const plan = planRecordsMove(root, [
      { path: 'CHANGELOG.md', text: 'shipped .claude/plans/x.md' },
      { path: 'src/a.test.ts', text: 'no record path here' },
    ])

    expect(plan.excluded).toEqual(['CHANGELOG.md'])
  })

  it('should count a marked citation without carrying the file', () => {
    const plan = planRecordsMove(root, [
      { path: 'docs/a.md', text: '.claude/memory/a.md canon-keep-record-root' },
    ])

    expect(plan.entries).toEqual([])
    expect(plan.kept).toBe(1)
  })

  it('should leave a record under the old root out of the plan entirely', () => {
    const plan = planRecordsMove(root, [
      { path: '.claude/memory/user-erclx.md', text: 'see .claude/plans/x.md' },
    ])

    expect(plan.entries).toEqual([])
    expect(plan.excluded).toEqual([])
    expect(plan.rewritten).toBe(0)
  })

  it('should leave a record under the new root out of the plan entirely', () => {
    const plan = planRecordsMove(root, [
      { path: '.canon/tasks/v1.0-a.md', text: 'the board was .claude/tasks' },
    ])

    expect(plan.entries).toEqual([])
    expect(plan.excluded).toEqual([])
    expect(plan.rewritten).toBe(0)
  })

  it('should not count a marked citation inside a record it never read', () => {
    const plan = planRecordsMove(root, [
      {
        path: '.canon/memory/a.md',
        text: '.claude/memory/a.md canon-keep-record-root',
      },
    ])

    expect(plan.kept).toBe(0)
  })

  it('should still sweep an installed rule beside the records it repoints', () => {
    const plan = planRecordsMove(root, [
      { path: '.claude/memory/a.md', text: 'see .claude/tasks/b.md' },
      { path: '.claude/rules/core/035-tasks.md', text: '.claude/tasks/ is it' },
    ])

    expect(plan.entries.map((entry) => entry.path)).toEqual([
      '.claude/rules/core/035-tasks.md',
    ])
    expect(plan.rewritten).toBe(1)
  })

  it('should report a rewritten file that also names an excluded path', () => {
    const plan = planRecordsMove(root, [
      {
        path: 'scripts/shell/test-hooks.sh',
        text: 'EXPECTED_EXEMPTIONS checks .claude/tasks/ and .claude/hooks/x.sh',
      },
    ])

    expect(plan.coupled).toEqual(['scripts/shell/test-hooks.sh'])
  })

  it('should not report a rewritten file carrying only a live citation', () => {
    const plan = planRecordsMove(root, [
      { path: 'docs/a.md', text: 'see .claude/tasks/x.md' },
    ])

    expect(plan.coupled).toEqual([])
  })

  it('should read the folder moves off disk beside the citations', () => {
    mkdirSync(join(root, '.claude', 'plans'), { recursive: true })

    const plan = planRecordsMove(root, [])

    expect(plan.moves).toEqual([{ from: '.claude/plans', to: '.canon/plans' }])
    expect(plan.collisions).toEqual([])
  })

  it('should report a frontmatter paths: glob while still rewriting the prose citation beside it', () => {
    const text = [
      '---',
      'paths:',
      "  - '.claude/tasks/**'",
      '---',
      '',
      'See .claude/tasks/ for the board.',
    ].join('\n')

    const plan = planRecordsMove(root, [
      { path: '.claude/rules/core/035-tasks.md', text },
    ])

    expect(plan.frontmatterGlobs).toEqual([
      {
        path: '.claude/rules/core/035-tasks.md',
        lines: [{ line: 3, text: "- '.claude/tasks/**'" }],
      },
    ])
    expect(plan.globs).toBe(1)
    expect(plan.entries).toEqual([
      {
        path: '.claude/rules/core/035-tasks.md',
        text: [
          '---',
          'paths:',
          "  - '.claude/tasks/**'",
          '---',
          '',
          'See .canon/tasks/ for the board.',
        ].join('\n'),
        rewritten: 1,
        kept: 0,
      },
    ])
  })

  it('should report a frontmatter glob even when it is the only citation in the file', () => {
    const text = ['---', 'paths:', "  - '.claude/tasks/**'", '---'].join('\n')

    const plan = planRecordsMove(root, [
      { path: '.claude/rules/core/035-tasks.md', text },
    ])

    expect(plan.frontmatterGlobs).toEqual([
      {
        path: '.claude/rules/core/035-tasks.md',
        lines: [{ line: 3, text: "- '.claude/tasks/**'" }],
      },
    ])
    expect(plan.entries).toEqual([])
  })

  it('should report a file whose only citation is cross-repo-shaped with no entries row', () => {
    const plan = planRecordsMove(root, [
      { path: 'docs/a.md', text: 'clone at erclx.dev/.claude/tasks/x.md' },
    ])

    expect(plan.crossRepoCitations).toEqual([
      {
        path: 'docs/a.md',
        lines: [{ line: 1, text: 'clone at erclx.dev/.claude/tasks/x.md' }],
      },
    ])
    expect(plan.crossRepo).toBe(1)
    expect(plan.entries).toEqual([])
  })

  it('should report a file whose only citation is dated with no entries row', () => {
    const text = [
      'A `.claude/tasks/x.md` line explains the move.',
      'Measured at `abc123` on 2026-08-20.',
    ].join('\n')

    const plan = planRecordsMove(root, [{ path: 'docs/a.md', text }])

    expect(plan.datedCitations).toEqual([
      {
        path: 'docs/a.md',
        lines: [
          { line: 1, text: 'A `.claude/tasks/x.md` line explains the move.' },
        ],
      },
    ])
    expect(plan.dated).toBe(1)
    expect(plan.entries).toEqual([])
  })

  it('should report a file mixing a live citation with a foreign one in both places', () => {
    const text = [
      'clone at erclx.dev/.claude/tasks/x.md',
      'see .claude/tasks/y.md as well',
    ].join('\n')

    const plan = planRecordsMove(root, [{ path: 'docs/a.md', text }])

    expect(plan.crossRepoCitations).toEqual([
      {
        path: 'docs/a.md',
        lines: [{ line: 1, text: 'clone at erclx.dev/.claude/tasks/x.md' }],
      },
    ])
    expect(plan.entries).toEqual([
      {
        path: 'docs/a.md',
        text: [
          'clone at erclx.dev/.claude/tasks/x.md',
          'see .canon/tasks/y.md as well',
        ].join('\n'),
        rewritten: 1,
        kept: 0,
      },
    ])
  })

  it('should report a file mixing a live citation with a dated one in both places', () => {
    const text = [
      'Measured at `abc123` on 2026-08-20 for `.claude/tasks/x.md`.',
      '',
      'See .claude/memory/y.md for details.',
    ].join('\n')

    const plan = planRecordsMove(root, [{ path: 'docs/a.md', text }])

    expect(plan.datedCitations).toEqual([
      {
        path: 'docs/a.md',
        lines: [
          {
            line: 1,
            text: 'Measured at `abc123` on 2026-08-20 for `.claude/tasks/x.md`.',
          },
        ],
      },
    ])
    expect(plan.entries).toEqual([
      {
        path: 'docs/a.md',
        text: [
          'Measured at `abc123` on 2026-08-20 for `.claude/tasks/x.md`.',
          '',
          'See .canon/memory/y.md for details.',
        ].join('\n'),
        rewritten: 1,
        kept: 0,
      },
    ])
  })
})
