import { describe, expect, it } from 'vitest'
import { densityGates, inDensityScope } from '@/markdown/scope'

describe('inDensityScope', () => {
  it.each([
    'canon/context/cli/overview.md',
    'docs/agents/commands.md',
    'claude/skills/git-pr/SKILL.md',
    'claude/skills/git-pr/references/pr.md',
    '.claude/skills/internal-docs/SKILL.md',
    '.claude/skills/internal-docs/references/shape.md',
    'tooling/base/seeds/canon/context/ci.md',
    'tooling/base/reference.md',
    'wiki/claude/code.md',
    'claude/skills/git-pr/REQUIREMENT.md',
    '.claude/skills/internal-docs/REQUIREMENT.md',
    'README.md',
    'CONTRIBUTING.md',
  ])('should hold %s', (rel) => {
    expect(inDensityScope(rel)).toBe(true)
  })

  it.each([
    'governance/rules/canon/git.md',
    'internal/rules/core/cli-output.md',
    '.claude/rules/canon/code/routing.md',
    'CLAUDE.md',
    'canon/REQUIREMENTS.md',
    'canon/DESIGN.md',
    'CHANGELOG.md',
    'examples/teach/README.md',
    '.canon/plans/feature-density-check.md',
    '.canon/groundwork/154-markdown-density/06-decision.md',
    'claude/skills/git-pr/EVAL.md',
    'tooling/claude/seeds/CLAUDE.md',
    'tooling/claude/seeds/canon/REQUIREMENTS.md',
    'tooling/claude/seeds/canon/DESIGN.md',
    'claude/README.md',
  ])('should leave %s out', (rel) => {
    expect(inDensityScope(rel)).toBe(false)
  })
})

describe('densityGates', () => {
  it('should report without gating an in-scope path under no gated prefix', () => {
    expect(densityGates('docs/agents/gate.md', 'paragraph-length', [])).toBe(
      false,
    )
  })

  it('should gate an in-scope path under a gated prefix', () => {
    expect(
      densityGates('docs/agents/gate.md', 'paragraph-length', ['docs/']),
    ).toBe(true)
  })

  it('should gate a bullet run in scope before its folder is gated', () => {
    expect(densityGates('docs/agents/gate.md', 'bullet-run', [])).toBe(true)
  })

  it('should leave a bullet run on a surface the old stage never held to its batch', () => {
    expect(densityGates('tooling/web/reference.md', 'bullet-run', [])).toBe(
      false,
    )
  })

  it('should report without gating a requirement under a gated skill prefix', () => {
    expect(
      densityGates(
        '.claude/skills/internal-docs/REQUIREMENT.md',
        'paragraph-length',
        ['.claude/skills/internal-'],
      ),
    ).toBe(false)
  })

  it('should leave a bullet run in a requirement ungated', () => {
    expect(
      densityGates('claude/skills/git-pr/REQUIREMENT.md', 'bullet-run', []),
    ).toBe(false)
  })

  it('should gate a requirement listed by its own path', () => {
    expect(
      densityGates('claude/skills/git-pr/REQUIREMENT.md', 'paragraph-length', [
        'claude/skills/git-pr/REQUIREMENT.md',
      ]),
    ).toBe(true)
  })

  it('should never gate an out-of-scope path, whatever the prefix', () => {
    expect(
      densityGates('canon/REQUIREMENTS.md', 'bullet-run', ['canon/']),
    ).toBe(false)
  })
})
