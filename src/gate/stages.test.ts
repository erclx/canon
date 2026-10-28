import { describe, expect, it } from 'vitest'
import { clientCommandCitations } from '@/gate/measures'
import { STAGES } from '@/gate/stages'

function scopeOf(id: string): RegExp {
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
      scope.test('sandbox/fixtures/replay/jobtriage/CLAUDE.md.fixture'),
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
    expect(scope.test('tsconfig.json')).toBe(true)
    expect(scope.test('package.json')).toBe(true)
  })

  it('should not fire on a Markdown-only change to a corpus a test reads', () => {
    const scope = scopeOf('tests')

    expect(scope.test('claude/skills/git-pr/SKILL.md')).toBe(false)
    expect(scope.test('governance/rules/core/005-behavior.md')).toBe(false)
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
      'claude/skills/git-pr/SKILL.md',
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
      'src/gate/stages.ts',
      'web/src/components/hero.tsx',
    ])
  })

  it('should pass the root commitlint config to the related run', () => {
    const argv = testsCheck().changedArgv?.(['commitlint.config.js'])

    expect(argv?.at(-1)).toBe('commitlint.config.js')
  })

  it.each([
    'vitest.config.ts',
    'vitest.setup.ts',
    'vitest.global-setup.ts',
    'tsconfig.json',
    'package.json',
  ])('should run the full suite when %s changes', (file) => {
    const argv = testsCheck().changedArgv?.(['src/gate/stages.ts', file])

    expect(argv).toEqual(['bun', 'run', 'test'])
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
})

describe('the hero stage', () => {
  const heroChecks = () =>
    STAGES.find((candidate) => candidate.id === 'hero')?.checks ?? []

  it('should not assert the frames against the trunk, so a branch commits none', () => {
    expect(heroChecks().some((check) => check.kind === 'drift')).toBe(false)
  })

  it('should run the regen health check rather than a writing regen', () => {
    const commands = heroChecks().flatMap((check) =>
      check.kind === 'command' ? [check.argv] : [],
    )

    expect(commands).toEqual([['bun', 'scripts/core/regen-hero.ts', '--check']])
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
  it('should run the widened audit, so a section and an index finding gate', () => {
    const stage = STAGES.find((stage) => stage.id === 'context-citations')
    const argv = stage?.checks.flatMap((check) =>
      check.kind === 'cli' ? [check.argv] : [],
    )

    expect(argv).toEqual([['context', 'audit', '--gate']])
  })
})
