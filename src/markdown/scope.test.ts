import { describe, expect, it } from 'vitest'
import { bodyLines } from '@/markdown/scan'
import {
  densityGates,
  GATED_SCOPE_ROOTS,
  inDensityScope,
  scopedDensityFindings,
} from '@/markdown/scope'

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

  it('should leave a bullet run ungated outside a target list', () => {
    expect(
      densityGates('docs/agents/gate.md', 'bullet-run', ['wiki/'], false),
    ).toBe(false)
  })

  it('should gate a bullet run under a target list prefix', () => {
    expect(
      densityGates('docs/agents/gate.md', 'bullet-run', ['docs/'], false),
    ).toBe(true)
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

describe('GATED_SCOPE_ROOTS', () => {
  it.each(GATED_SCOPE_ROOTS)(
    'should name a root its own listing gates: %s',
    (root) => {
      const sample = root.endsWith('/') ? `${root}a/SKILL.md` : root
      expect(densityGates(sample, 'bullet-run', [root], false)).toBe(true)
    },
  )
})

describe('scopedDensityFindings', () => {
  const kinds = (rel: string, source: string) =>
    scopedDensityFindings(rel, bodyLines(source)).map((finding) => [
      finding.kind,
      finding.line,
    ])

  const bullets = (count: number) =>
    Array.from({ length: count }, (_, index) => `- \`p${index}/\`: path`).join(
      '\n',
    )

  it('should gate a Key paths run past five in CLAUDE.md', () => {
    const source = `# Project\n\n## Key paths\n\n${bullets(6)}\n`
    expect(kinds('CLAUDE.md', source)).toEqual([['bullet-run', 5]])
    expect(densityGates('CLAUDE.md', 'bullet-run', ['CLAUDE.md'])).toBe(true)
  })

  it('should leave a long run in another CLAUDE.md section out', () => {
    const source = `# Project\n\n## Behavior\n\n${bullets(6)}\n\n## Key paths\n\n${bullets(2)}\n`
    expect(kinds('CLAUDE.md', source)).toEqual([])
  })

  it('should pass a Key paths grouped under lead-sentence H3s', () => {
    const source = `## Key paths\n\n### Code\n\nThe code.\n\n${bullets(5)}\n\n### Content\n\nThe content.\n\n${bullets(5)}\n`
    expect(kinds('CLAUDE.md', source)).toEqual([])
  })

  it('should report an H3 under Key paths opening on a bullet', () => {
    const source = `## Key paths\n\n### Code\n\n${bullets(2)}\n`
    expect(kinds('CLAUDE.md', source)).toEqual([['h3-opening', 3]])
  })

  it('should stop measuring at the next H2', () => {
    const source = `## Key paths\n\n${bullets(3)}\n\n## Commands\n\n${bullets(3)}\n`
    expect(kinds('CLAUDE.md', source)).toEqual([])
  })

  it('should keep only the run limit and the H3 opening inside Key paths', () => {
    const source = `## Key paths\n\n${'x'.repeat(400)}\n\n- \`a/\`: ${'y'.repeat(250)}\n`
    expect(kinds('CLAUDE.md', source)).toEqual([])
  })

  it('should hold the seed to the same scope, in whole-file lines', () => {
    const source = `# Project\n\nAbout.\n\n## Key paths\n\n${bullets(6)}\n`
    expect(kinds('tooling/claude/seeds/CLAUDE.md', source)).toEqual([
      ['bullet-run', 7],
    ])
  })

  it('should leave a nested CLAUDE.md out', () => {
    const source = `## Key paths\n\n${bullets(6)}\n`
    expect(kinds('src/CLAUDE.md', source)).toEqual([])
  })

  it('should measure a whole density-scope file as before', () => {
    const source = `# Doc\n\n${bullets(6)}\n`
    expect(kinds('docs/a.md', source)).toEqual([['bullet-run', 3]])
  })

  describe('table findings', () => {
    const longCell = `| A | B |\n| - | - |\n| ${'a'.repeat(130)} | b |\n`

    it('should append a cell finding on a density-scope path', () => {
      expect(kinds('docs/a.md', longCell)).toEqual([['table-cell', 3]])
    })

    it('should append a trailing-list finding on a density-scope path', () => {
      const source = '| A | B |\n| - | - |\n| a | b |\n- item\n'
      expect(kinds('docs/a.md', source)).toEqual([['table-then-list', 4]])
    })

    it('should gate a cell finding under a gated prefix and report it elsewhere', () => {
      expect(densityGates('docs/a.md', 'table-cell', ['docs/'])).toBe(true)
      expect(densityGates('docs/a.md', 'table-cell', ['wiki/'])).toBe(false)
    })

    it('should never gate a cell finding for a bare always-gated list', () => {
      expect(densityGates('docs/a.md', 'table-cell', [])).toBe(false)
    })

    it('should leave a long cell in CLAUDE.md out, Key paths included', () => {
      const source = `## Key paths\n\n${longCell}`
      expect(kinds('CLAUDE.md', source)).toEqual([])
    })

    it('should leave a path outside the scope out', () => {
      expect(kinds('src/notes.md', longCell)).toEqual([])
    })
  })
})
