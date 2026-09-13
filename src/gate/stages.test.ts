import { describe, expect, it } from 'vitest'
import { clientCommandCitations } from '@/gate/measures'
import { STAGES } from '@/gate/stages'

function scopeOf(id: string): RegExp {
  const stage = STAGES.find((candidate) => candidate.id === id)
  if (stage?.scope === undefined) throw new Error(`no scope on stage ${id}`)
  return stage.scope
}

describe('the shell stage scope', () => {
  it('should fire on a husky hook, which carries no extension to match', () => {
    const scope = scopeOf('shell')

    expect(scope.test('.husky/post-merge')).toBe(true)
    expect(scope.test('.husky/pre-push')).toBe(true)
  })

  it('should still fire on a script named .sh and on the manifest', () => {
    const scope = scopeOf('shell')

    expect(scope.test('scripts/core/regen-claude-copies.sh')).toBe(true)
    expect(scope.test('package.json')).toBe(true)
  })

  it('should not fire on a path that only mentions husky', () => {
    const scope = scopeOf('shell')

    expect(scope.test('docs/agents/husky.md')).toBe(false)
    expect(scope.test('src/husky/run.ts')).toBe(false)
  })
})

describe('the shipped-references stage scope', () => {
  it('should fire on every corpus a target reader reaches', () => {
    const scope = scopeOf('shipped-references')

    expect(scope.test('claude/skills/role-orchestrator/SKILL.md')).toBe(true)
    expect(scope.test('docs/agents/key-changes.md')).toBe(true)
    expect(scope.test('standards/publish.md')).toBe(true)
    expect(scope.test('governance/rules/core/005-behavior.md')).toBe(true)
  })

  it('should not fire on a corpus whose reader already holds this repository', () => {
    const scope = scopeOf('shipped-references')

    expect(scope.test('src/gate/measures.ts')).toBe(false)
    expect(scope.test('canon/context/development/gates.md')).toBe(false)
    expect(scope.test('internal/rules/claude/598-authoring-layout.md')).toBe(
      false,
    )
    expect(scope.test('wiki/claude/claude-worktrees.md')).toBe(false)
  })

  it('should anchor each corpus, so a longer name sharing its prefix does not fire', () => {
    const scope = scopeOf('shipped-references')

    expect(scope.test('docs-site/index.md')).toBe(false)
    expect(scope.test('src/docs/read.ts')).toBe(false)
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
