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
    'claude/skills/git-pr/REQUIREMENT.md',
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

  it('should never gate an out-of-scope path, whatever the prefix', () => {
    expect(
      densityGates('canon/REQUIREMENTS.md', 'bullet-run', ['canon/']),
    ).toBe(false)
  })
})
