import { describe, expect, it } from 'vitest'
import {
  fanInBranch,
  fanInFindings,
  readFanInIntegrators,
  readFanInMembers,
} from '@/tasks/fan-in'

function plan(stem: string, constraints: readonly string[]) {
  const text = [
    `# Feature: ${stem}`,
    '',
    '**Constraints:**',
    '',
    ...constraints,
    '',
    '**Files to touch:**',
    '',
    '- `src/a.ts`: the change.',
    '',
  ].join('\n')

  return { stem, text }
}

describe('readFanInMembers', () => {
  it('should read a backticked list joined by commas and a final and', () => {
    const { text } = plan('feature-whole', [
      '- Fans in `feature-a`, `feature-b`, and `feature-c`, which build in parallel.',
    ])

    expect(readFanInMembers(text)).toEqual([
      'feature-a',
      'feature-b',
      'feature-c',
    ])
  })

  it('should add the prefix to a backticked slug written without it', () => {
    const { text } = plan('feature-whole', ['- Fans in `a` and `b`.'])

    expect(readFanInMembers(text)).toEqual(['feature-a', 'feature-b'])
  })

  it('should read a list wrapped onto a second line', () => {
    const { text } = plan('feature-whole', [
      '- Fans in `feature-a`,',
      '  `feature-b`.',
    ])

    expect(readFanInMembers(text)).toEqual(['feature-a', 'feature-b'])
  })

  it('should read bare prefixed slugs and stop at the prose after them', () => {
    const { text } = plan('feature-whole', [
      '- FANS IN feature-a and feature-b which share edge files.',
    ])

    expect(readFanInMembers(text)).toEqual(['feature-a', 'feature-b'])
  })

  it('should read nothing from a plan carrying no fan-in bullet', () => {
    const { text } = plan('feature-whole', [
      '- Stacks on `feature-parent`, which builds first.',
    ])

    expect(readFanInMembers(text)).toEqual([])
  })
})

describe('readFanInIntegrators', () => {
  it('should read the integrator in any case of the phrase', () => {
    const { text } = plan('feature-a', [
      '- Fan-In member of `whole`, which merges every batch.',
    ])

    expect(readFanInIntegrators(text)).toEqual(['feature-whole'])
  })

  it('should read a member bullet wrapped after the phrase', () => {
    const { text } = plan('feature-a', [
      '- Fan-in member of',
      '  `feature-whole`.',
    ])

    expect(readFanInIntegrators(text)).toEqual(['feature-whole'])
  })
})

describe('fanInBranch', () => {
  it('should derive the branch plan-branch derives from the same stem', () => {
    expect(fanInBranch('feature-density-references-a-g')).toBe(
      'feat/density-references-a-g',
    )
  })
})

describe('fanInFindings', () => {
  const MEMBER = '- Fan-in member of `feature-whole`.'

  it('should report nothing for a member and an integrator naming each other', () => {
    const plans = [
      plan('feature-a', [MEMBER]),
      plan('feature-whole', ['- Fans in `feature-a`.']),
    ]

    expect(fanInFindings(plans)).toEqual([])
  })

  it('should report a member whose integrator is not a live plan', () => {
    const findings = fanInFindings([plan('feature-a', [MEMBER])])

    expect(findings.map((f) => [f.kind, f.record, f.subject])).toEqual([
      ['fan-in-unmatched', 'feature-a.md', 'feature-whole'],
    ])
  })

  it('should report a member its integrator does not list', () => {
    const plans = [
      plan('feature-a', [MEMBER]),
      plan('feature-whole', ['- Fans in `feature-b`.']),
      plan('feature-b', [MEMBER]),
    ]

    expect(fanInFindings(plans).map((f) => [f.record, f.subject])).toEqual([
      ['feature-a.md', 'feature-whole'],
    ])
  })

  it('should report an integrator listing a member that is not a live plan', () => {
    const findings = fanInFindings([
      plan('feature-whole', ['- Fans in `feature-archived`.']),
    ])

    expect(findings.map((f) => [f.record, f.subject])).toEqual([
      ['feature-whole.md', 'feature-archived'],
    ])
  })

  it('should report an integrator listing a plan that names no integrator', () => {
    const findings = fanInFindings([
      plan('feature-a', []),
      plan('feature-whole', ['- Fans in `feature-a`.']),
    ])

    expect(findings.map((f) => [f.record, f.subject])).toEqual([
      ['feature-whole.md', 'feature-a'],
    ])
  })

  it('should report a member listed by two integrators on both of them', () => {
    const plans = [
      plan('feature-a', [MEMBER]),
      plan('feature-other', ['- Fans in `feature-a`.']),
      plan('feature-whole', ['- Fans in `feature-a`.']),
    ]

    expect(fanInFindings(plans).map((f) => [f.record, f.subject])).toEqual([
      ['feature-other.md', 'feature-a'],
      ['feature-whole.md', 'feature-a'],
    ])
  })

  it('should report a member naming two integrators', () => {
    const plans = [
      plan('feature-a', [MEMBER, '- Fan-in member of `feature-other`.']),
      plan('feature-other', ['- Fans in `feature-a`.']),
      plan('feature-whole', ['- Fans in `feature-a`.']),
    ]

    expect(
      fanInFindings(plans)
        .filter((f) => f.record === 'feature-a.md')
        .map((f) => f.subject),
    ).toEqual(['feature-whole', 'feature-other'])
  })

  it('should leave a plan with no fan-in bullet clear', () => {
    const findings = fanInFindings([
      plan('feature-parent', []),
      plan('feature-child', ['- Stacks on `feature-parent`.']),
    ])

    expect(findings).toEqual([])
  })
})

describe('the density-references split as a fan-in', () => {
  // The three constraint blocks as v151.8's plans carry them on 2026-10-18,
  // with one member bullet added to each.
  const SHARED = [
    '- Measured against `74dfc2f02` on 2026-10-17',
    '- Waits on `feature-density-check` and `feature-density-standard` merging, since the audit has to report density and the standard has to state the shape before a rewrite starts',
    '- Shared path: `src/markdown/scope.ts` with every other rewrite batch. Each adds its own lines to `GATED_PATHS`, so the one merging second rebases and keeps both.',
    '- The target shape is variant B at `.canon/groundwork/154-markdown-density/evidence/rewrites/context-sandbox-coverage-overview-b.md`, a short lead sentence under each H3, then two or three bullets or a small table',
    '- A rewrite keeps every fact a later session acts on. History and rejected alternatives move to a decision record or are cut, per the standard.',
    '- No exemption marker. A file that cannot pass is a finding to raise, not to mark.',
    '- Fan-in member of `feature-density-references`, which merges the three batches into one pull request.',
  ]
  const MEMBERS = [
    'feature-density-references-a-g',
    'feature-density-references-g-r',
    'feature-density-references-r-y',
  ]
  const plans = [
    ...MEMBERS.map((stem) => plan(stem, SHARED)),
    plan('feature-density-references', [
      '- Fans in `feature-density-references-a-g`, `feature-density-references-g-r`, and',
      '  `feature-density-references-r-y`, in that order.',
    ]),
  ]

  it('should report no finding', () => {
    expect(fanInFindings(plans)).toEqual([])
  })

  it('should derive the three member branches in the order listed', () => {
    const integrator = plans[3]?.text ?? ''

    expect(readFanInMembers(integrator).map(fanInBranch)).toEqual([
      'feat/density-references-a-g',
      'feat/density-references-g-r',
      'feat/density-references-r-y',
    ])
  })
})
