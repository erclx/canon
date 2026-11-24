import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fileLength } from '@/gate/file-length'
import {
  commentBodyBlocks,
  commentFileShare,
  commentHeadBlocks,
  commentHistory,
  shippedCommentCaps,
} from '@/gate/comment-caps'
import { clientCommandCitations, designProse } from '@/gate/measures'
import {
  contextAuditArgv,
  STAGES,
  type StageScope,
  stagesFor,
} from '@/gate/stages'
import { gitEnv } from '@/git/env'

function scopeOf(id: string): StageScope {
  const stage = STAGES.find((candidate) => candidate.id === id)
  if (stage?.scope === undefined) throw new Error(`no scope on stage ${id}`)
  return stage.scope
}

describe('the format stage', () => {
  it('should leave no stage that runs the formatter in write mode', () => {
    const writers = STAGES.filter((stage) =>
      stage.checks.some(
        (check) =>
          check.kind === 'command' && check.argv.join(' ') === 'bun run format',
      ),
    )

    expect(writers).toEqual([])
  })

  it('should tell a failed format check to run the formatter', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'format-check')

    const check = stage?.checks[0]

    expect(check?.kind === 'command' ? check.failure : '').toContain(
      'bun run format',
    )
  })
})

describe('the lint stage', () => {
  it('should run the read-only lint script', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'lint')

    const check = stage?.checks[0]

    expect(check?.kind === 'command' ? check.argv : []).toEqual([
      'bun',
      'run',
      'check:lint',
    ])
  })

  it('should carry no scope, so no changed-file set can skip it', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'lint')

    expect(stage).toBeDefined()
    expect(stage?.scope).toBeUndefined()
  })
})

describe('the shell stage scope', () => {
  it('should fire on a husky hook, which carries no extension to match', () => {
    const scope = scopeOf('shell')

    expect(scope.test('.husky/post-merge')).toBe(true)
    expect(scope.test('.husky/pre-push')).toBe(true)
  })

  it('should still fire on a script named .sh and on the manifest', () => {
    const scope = scopeOf('shell')

    expect(scope.test('scripts/core/check-skill-paths.sh')).toBe(true)
    expect(scope.test('package.json')).toBe(true)
  })

  it('should not fire on a path that only mentions husky', () => {
    const scope = scopeOf('shell')

    expect(scope.test('docs/agents/husky.md')).toBe(false)
    expect(scope.test('src/husky/run.ts')).toBe(false)
  })
})

describe('the consumer replay stage scope', () => {
  it('should fire on what a sync ships or reads and on a snapshot', () => {
    const scope = scopeOf('consumer-replay')

    expect(scope.test('src/sync/run.ts')).toBe(true)
    expect(scope.test('governance/rules/canon/git.md')).toBe(true)
    expect(scope.test('tooling/base/configs/.oxfmtrc.json')).toBe(true)
    expect(scope.test('governance/renames.toml')).toBe(true)
    expect(scope.test('governance/stacks/node.toml')).toBe(true)
    expect(
      scope.test('sandbox/fixtures/replay/tidecount/CLAUDE.md.fixture'),
    ).toBe(true)
  })

  it('should skip a docs-only change and another scenario fixture', () => {
    const scope = scopeOf('consumer-replay')

    expect(scope.test('docs/agents/commands.md')).toBe(false)
    expect(scope.test('governance/ledger/skills/code-craft/SKILL.md')).toBe(
      false,
    )
    expect(scope.test('canon/context/development/sandbox.md')).toBe(false)
    expect(
      scope.test('sandbox/fixtures/git/commit/small/create/a.ts.fixture'),
    ).toBe(false)
  })
})

describe('the tests stage scope', () => {
  it('should fire on the root commitlint config and its test', () => {
    const scope = scopeOf('tests')

    expect(scope.test('commitlint.config.js')).toBe(true)
    expect(scope.test('commitlint.config.test.ts')).toBe(true)
  })

  it('should fire on a TypeScript file inside or outside src', () => {
    const scope = scopeOf('tests')

    expect(scope.test('src/gate/stages.ts')).toBe(true)
    expect(scope.test('web/src/components/hero.tsx')).toBe(true)
  })

  it('should fire on a config every test reads without importing it', () => {
    const scope = scopeOf('tests')

    expect(scope.test('vitest.config.ts')).toBe(true)
    expect(scope.test('vitest.e2e.config.ts')).toBe(true)
    expect(scope.test('tsconfig.json')).toBe(true)
    expect(scope.test('package.json')).toBe(true)
  })

  it('should fire on a Markdown-only change to a corpus a test reads', () => {
    const scope = scopeOf('tests')

    expect(
      scope.test('claude/skills/app-drive/references/drive-record.md'),
    ).toBe(true)
    expect(scope.test('governance/rules/core/005-behavior.md')).toBe(true)
  })

  it('should not fire on a docs change no test reads', () => {
    const scope = scopeOf('tests')

    expect(scope.test('docs/workflow/ai-workflow.md')).toBe(false)
  })
})

describe('the tests stage command', () => {
  function testsCheck() {
    const check = STAGES.find((candidate) => candidate.id === 'tests')
      ?.checks[0]
    if (check?.kind !== 'command') throw new Error('no tests command')
    return check
  }

  it('should run the full suite when scoping is off', () => {
    expect(testsCheck().argv).toEqual(['bun', 'run', 'test'])
  })

  it('should run only the tests related to the changed code files', () => {
    const argv = testsCheck().changedArgv?.([
      'docs/workflow/ai-workflow.md',
      'src/gate/stages.ts',
      'web/src/components/hero.tsx',
    ])

    expect(argv).toEqual([
      'bun',
      '--bun',
      'vitest',
      'related',
      '--run',
      '--passWithNoTests',
      '--exclude',
      '**/*.e2e.test.ts',
      'src/gate/stages.ts',
      'web/src/components/hero.tsx',
    ])
  })

  it('should append the tests that read a changed corpus file', () => {
    const argv = testsCheck().changedArgv?.([
      'claude/skills/app-drive/references/drive-record.md',
    ])

    expect(argv).toContain('src/intake/drive-check.test.ts')
  })

  it('should list a changed test once when it also reads a changed corpus', () => {
    const argv =
      testsCheck().changedArgv?.([
        'src/intake/drive-check.test.ts',
        'claude/skills/app-drive/references/drive-record.md',
      ]) ?? []

    expect(
      argv.filter((arg) => arg === 'src/intake/drive-check.test.ts'),
    ).toHaveLength(1)
  })

  it('should keep the exclude glob directly after its flag on a mixed diff', () => {
    const argv =
      testsCheck().changedArgv?.([
        'claude/skills/app-drive/references/drive-record.md',
        'src/gate/stages.ts',
      ]) ?? []

    expect(argv[argv.indexOf('--exclude') + 1]).toBe('**/*.e2e.test.ts')
  })

  it('should select the readers of a deleted corpus file without throwing', () => {
    const argv = testsCheck().changedArgv?.([
      'claude/skills/app-drive/references/removed.md',
    ])

    expect(argv).toContain('src/intake/drive-check.test.ts')
  })

  it('should exclude every end-to-end suite ahead of the changed files', () => {
    const argv = testsCheck().changedArgv?.(['src/take/film.ts']) ?? []

    expect(argv.slice(-3)).toEqual([
      '--exclude',
      '**/*.e2e.test.ts',
      'src/take/film.ts',
    ])
  })

  it('should still hand a changed end-to-end file to the related run', () => {
    const argv = testsCheck().changedArgv?.(['src/take/film.e2e.test.ts'])

    expect(argv?.at(-1)).toBe('src/take/film.e2e.test.ts')
  })

  it('should pass the root commitlint config to the related run', () => {
    const argv = testsCheck().changedArgv?.(['commitlint.config.js'])

    expect(argv?.at(-1)).toBe('commitlint.config.js')
  })

  it.each([
    'vitest.config.ts',
    'vitest.e2e.config.ts',
    'vitest.setup.ts',
    'vitest.global-setup.ts',
    'tsconfig.json',
    'package.json',
  ])('should run the full suite when %s changes', (file) => {
    const argv = testsCheck().changedArgv?.(['src/gate/stages.ts', file])

    expect(argv).toEqual(['bun', 'run', 'test'])
  })

  it('should point a scoped run at the by-hand end-to-end script', () => {
    expect(testsCheck().scopedNote).toContain('bun run test:e2e')
  })

  it('should exclude no end-to-end suite from the full run', () => {
    const argv = testsCheck().changedArgv?.([
      'src/take/film.ts',
      'package.json',
    ])

    expect(argv).not.toContain('--exclude')
  })
})

describe('the shipped-references stage scope', () => {
  it('should fire on every corpus a target reader reaches', () => {
    const scope = scopeOf('shipped-references')

    expect(scope.test('claude/skills/role-orchestrator/SKILL.md')).toBe(true)
    expect(scope.test('docs/agents/key-changes.md')).toBe(true)
    expect(scope.test('tooling/claude/reference.md')).toBe(true)
    expect(scope.test('governance/rules/core/005-behavior.md')).toBe(true)
  })

  it('should not fire on a corpus whose reader already holds this repository', () => {
    const scope = scopeOf('shipped-references')

    expect(scope.test('src/gate/measures.ts')).toBe(false)
    expect(scope.test('canon/context/development/gates.md')).toBe(false)
    expect(scope.test('internal/rules/claude/authoring-layout.md')).toBe(false)
    expect(scope.test('wiki/claude/worktrees.md')).toBe(false)
  })

  it('should anchor each corpus, so a longer name sharing its prefix does not fire', () => {
    const scope = scopeOf('shipped-references')

    expect(scope.test('docs-site/index.md')).toBe(false)
    expect(scope.test('src/docs/read.ts')).toBe(false)
  })
})

describe('the raw-field-file-reference stage scope', () => {
  it('should fire on a shipped corpus path', () => {
    const scope = scopeOf('raw-field-file-reference')

    expect(scope.test('claude/skills/git-pr/SKILL.md')).toBe(true)
    expect(scope.test('docs/agents/pr.md')).toBe(true)
  })

  it('should not fire on a path outside the shipped corpora', () => {
    const scope = scopeOf('raw-field-file-reference')

    expect(scope.test('src/gate/measures.ts')).toBe(false)
    expect(scope.test('canon/context/development/gates.md')).toBe(false)
  })
})

describe('the readme-citations stage scope', () => {
  it('should fire on either file a citation can drift between', () => {
    const scope = scopeOf('readme-citations')

    expect(scope.test('web/src/content/copy.ts')).toBe(true)
    expect(scope.test('README.md')).toBe(true)
  })

  it('should not fire on an unrelated web/ path', () => {
    const scope = scopeOf('readme-citations')

    expect(scope.test('web/src/components/hero.astro')).toBe(false)
    expect(scope.test('docs/agents/readme.md')).toBe(false)
  })
})

describe('the visual-path-globs stage scope', () => {
  it('should fire on either file the glob copy can drift between', () => {
    const scope = scopeOf('visual-path-globs')

    expect(scope.test('.github/workflows/deploy-site.yml')).toBe(true)
    expect(scope.test('.github/workflows/pr-visual-checks.yml')).toBe(true)
  })

  it('should not fire on an unrelated workflow', () => {
    const scope = scopeOf('visual-path-globs')

    expect(scope.test('.github/workflows/verify.yml')).toBe(false)
  })
})

describe('the client-command-citations stage', () => {
  it('should register the measure unscoped, so no changed-file pattern skips it', () => {
    const stage = STAGES.find(
      (candidate) => candidate.id === 'client-command-citations',
    )

    expect(stage?.scope).toBeUndefined()
    expect(stage?.checks).toEqual([
      { kind: 'measure', measure: clientCommandCitations },
    ])
  })
})

describe('the design stage', () => {
  it('should assert drift on every file the favicon regen writes', () => {
    const checks =
      STAGES.find((candidate) => candidate.id === 'design')?.checks ?? []
    const regen = checks.findIndex(
      (check) =>
        check.kind === 'command' &&
        check.argv.join(' ') === 'bun run web:favicon',
    )
    const drifted = checks
      .slice(regen + 1)
      .flatMap((check) => (check.kind === 'drift' ? [check.pathspec] : []))

    expect(regen).toBeGreaterThan(-1)
    expect(drifted).toEqual(
      expect.arrayContaining([
        'web/public/favicon.svg',
        'assets/brand/mark-color*.svg',
      ]),
    )
  })

  it('should assert drift on the token preview after its regen', () => {
    const checks =
      STAGES.find((candidate) => candidate.id === 'design')?.checks ?? []
    const regen = checks.findIndex(
      (check) =>
        check.kind === 'command' &&
        check.argv.join(' ') === 'bun run web:previews',
    )
    const drifted = checks
      .slice(regen + 1)
      .flatMap((check) => (check.kind === 'drift' ? [check.pathspec] : []))

    expect(regen).toBeGreaterThan(-1)
    expect(drifted).toContain('web/public/previews/design-tokens')
  })

  it('should leave the prose budget to its own stage, so a target can run it', () => {
    const checks =
      STAGES.find((candidate) => candidate.id === 'design')?.checks ?? []

    expect(checks).not.toContainEqual({ kind: 'measure', measure: designProse })
  })
})

describe('the design prose stage', () => {
  it('should count the record right after the design regen writes it', () => {
    const ids = STAGES.map((stage) => stage.id)
    const stage = STAGES.find((candidate) => candidate.id === 'design-prose')

    expect(ids.indexOf('design-prose')).toBe(ids.indexOf('design') + 1)
    expect(stage?.checks).toEqual([{ kind: 'measure', measure: designProse }])
  })
})

describe('the markdown stage', () => {
  it('should replace the retired length stages with one audit reading', () => {
    const ids = STAGES.map((stage) => stage.id)

    expect(ids).toContain('markdown')
    expect(ids).not.toContain('markdown-bans')
    expect(ids).not.toContain('bullet-stacks')
    expect(ids).not.toContain('paragraph-growth')
  })
})

describe('the context-citations stage', () => {
  let root: string

  const write = (rel: string, body: string): void => {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), body)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-context-stage-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("should run the widened audit in canon's own checkout", () => {
    write('package.json', JSON.stringify({ name: '@erclx/canon' }))

    expect(contextAuditArgv(root)).toEqual(['context', 'audit', '--gate'])
  })

  it('should run the plain audit in a target that declared no gate key', () => {
    write('package.json', JSON.stringify({ name: 'target' }))

    expect(contextAuditArgv(root)).toEqual(['context', 'audit'])
  })

  it('should run the widened audit in a target whose config opts in', () => {
    write('package.json', JSON.stringify({ name: 'target' }))
    write('canon/config/context.toml', 'gate-length = true\n')

    expect(contextAuditArgv(root)).toEqual(['context', 'audit', '--gate'])
  })

  it('should skip a project carrying no context folder', () => {
    const stage = STAGES.find((stage) => stage.id === 'context-citations')

    expect(stage?.absent?.(root)).toContain('no entry to audit')
  })

  it('should run in a project carrying a context folder', () => {
    mkdirSync(join(root, 'canon', 'context'), { recursive: true })
    const stage = STAGES.find((stage) => stage.id === 'context-citations')

    expect(stage?.absent?.(root)).toBeUndefined()
  })
})

describe('the file length stage', () => {
  it('should run the file length measure with no scope', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'file-length')

    expect(stage?.scope).toBeUndefined()
    expect(stage?.checks).toEqual([{ kind: 'measure', measure: fileLength }])
  })

  it('should sit right after the embedded programs stage', () => {
    const ids = STAGES.map((stage) => stage.id)

    expect(ids.indexOf('file-length')).toBe(
      ids.indexOf('embedded-programs') + 1,
    )
  })
})

describe('the comment cap stages', () => {
  it.each([
    ['comment-head-blocks', commentHeadBlocks],
    ['comment-body-blocks', commentBodyBlocks],
    ['comment-history', commentHistory],
    ['comment-file-share', commentFileShare],
    ['shipped-comment-caps', shippedCommentCaps],
  ])('should run %s with no scope', (id, measure) => {
    const stage = STAGES.find((candidate) => candidate.id === id)

    expect(stage?.scope).toBeUndefined()
    expect(stage?.checks).toEqual([{ kind: 'measure', measure }])
  })

  it('should sit right after the file length stage', () => {
    const ids = STAGES.map((stage) => stage.id)
    const after = ids.indexOf('file-length')

    expect(ids.slice(after + 1, after + 6)).toEqual([
      'comment-head-blocks',
      'comment-body-blocks',
      'comment-history',
      'comment-file-share',
      'shipped-comment-caps',
    ])
  })

  it('should keep the shipped comment caps out of a target', () => {
    const stage = STAGES.find(
      (candidate) => candidate.id === 'shipped-comment-caps',
    )

    expect(stage?.shared).toBeUndefined()
  })
})

describe('the shared stage set', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-stage-set-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should tag the twelve stages that fit any project as shared', () => {
    const shared = STAGES.filter((stage) => stage.shared).map((s) => s.id)

    expect(shared).toEqual([
      'design-prose',
      'device-classes',
      'context-citations',
      'canonical-records',
      'document-ceiling',
      'embedded-programs',
      'file-length',
      'comment-head-blocks',
      'comment-body-blocks',
      'comment-history',
      'comment-file-share',
      'markdown',
    ])
  })

  it("should run every stage in canon's own checkout", () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: '@erclx/canon' }),
    )

    expect(stagesFor(root).map((stage) => stage.id)).toEqual(
      STAGES.map((stage) => stage.id),
    )
  })

  it('should scope the tests stage from the tests of the checked root', () => {
    const git = (...args: string[]): void => {
      execaSync('git', ['-C', root, ...args], {
        env: gitEnv(),
        extendEnv: false,
      })
    }
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: '@erclx/canon' }),
    )
    // Built, so this file never reads as a corpus reader of what it names.
    const marker = ['PROJECT', 'ROOT'].join('_')
    const corpus = 'only-in-temp-root'
    mkdirSync(join(root, 'src'))
    writeFileSync(
      join(root, 'src/guide.test.ts'),
      `readFileSync(join(${marker}, '${corpus}/guide/page.md'))`,
    )
    git('init', '--initial-branch=main')
    git('add', '--all')

    const scope = stagesFor(root).find((stage) => stage.id === 'tests')?.scope

    expect(scope?.test(`${corpus}/guide/page.md`)).toBe(true)
    expect(scope?.test(`${corpus}/other/page.md`)).toBe(false)
  })

  it('should run the shared stages alone in a project with another name', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'app' }))

    expect(stagesFor(root).map((stage) => stage.id)).toContain('markdown')
    expect(stagesFor(root).every((stage) => stage.shared)).toBe(true)
  })

  it('should run the shared stages alone in a project with no manifest', () => {
    expect(stagesFor(root).every((stage) => stage.shared)).toBe(true)
  })
})
