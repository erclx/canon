import { describe, expect, it } from 'vitest'
import { readStackParents, stackFindings, stackPairs } from '@/tasks/stack'

interface PlanFixture {
  readonly stem: string
  readonly files: readonly string[]
  readonly constraints?: readonly string[]
}

function files(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `src/${prefix}/f${i}.ts`)
}

function plan({ stem, files: declared, constraints = [] }: PlanFixture) {
  const text = [
    `# Feature: ${stem}`,
    '',
    '**Constraints:**',
    '',
    ...constraints.map((line) => `- ${line}`),
    '',
    '**Files to touch:**',
    '',
    ...declared.map((path) => `- \`${path}\`: the change.`),
    '',
  ].join('\n')

  return { stem, text }
}

const STACKS = 'Stacks on `feature-parent`, which builds first.'

function pair(
  parentFiles: readonly string[],
  childFiles: readonly string[],
  constraints: readonly string[] = [STACKS],
) {
  return [
    plan({ stem: 'feature-parent', files: parentFiles }),
    plan({ stem: 'feature-child', files: childFiles, constraints }),
  ]
}

describe('stackFindings', () => {
  it('should report the inspector shape, 9 shared of 10 and 12', () => {
    const shared = files('inspector', 9)
    const parent = [...shared, 'src/a.ts']
    const child = [...shared, 'src/b.ts', 'src/c.ts', 'src/d.ts']

    const findings = stackFindings(pair(parent, child))

    expect(findings.map((f) => [f.kind, f.record])).toEqual([
      ['stack-foldable', 'feature-child.md'],
    ])
    expect(findings[0]?.message).toContain('feature-parent')
  })

  it('should not report the sidebar shape, 3 shared of 8 and 9', () => {
    const shared = files('shell', 3)
    const parent = [...shared, ...files('tree', 5)]
    const child = [...shared, ...files('panel', 6)]

    expect(stackFindings(pair(parent, child))).toEqual([])
  })

  it('should not report a pair sharing two files', () => {
    const shared = files('shell', 2)

    expect(stackFindings(pair(shared, [...shared, 'src/b.ts']))).toEqual([])
  })

  it('should not report a union of 21', () => {
    const shared = files('big', 10)
    const parent = [...shared, ...files('p', 5)]
    const child = [...shared, ...files('c', 6)]

    expect(stackFindings(pair(parent, child))).toEqual([])
  })

  it('should report a union of exactly 20', () => {
    const shared = files('big', 10)
    const parent = [...shared, ...files('p', 5)]
    const child = [...shared, ...files('c', 5)]

    expect(stackFindings(pair(parent, child))).toHaveLength(1)
  })

  it('should not report a parent with no live plan', () => {
    const child = plan({
      stem: 'feature-child',
      files: files('inspector', 5),
      constraints: [STACKS],
    })

    expect(stackFindings([child])).toEqual([])
  })

  it('should not report a stack phrase naming main', () => {
    const shared = files('inspector', 5)

    expect(
      stackFindings(pair(shared, shared, ['Branch from `main`, then rebase.'])),
    ).toEqual([])
  })

  it('should not report a pair carrying a Judged apart line with a reason', () => {
    const shared = files('inspector', 5)
    const judged =
      'Judged apart from `feature-parent`: the operator judges the taste call in its own sitting.'

    expect(stackFindings(pair(shared, shared, [STACKS, judged]))).toEqual([])
  })

  it('should still report a Judged apart line with an empty reason', () => {
    const shared = files('inspector', 5)

    expect(
      stackFindings(
        pair(shared, shared, [STACKS, 'Judged apart from `feature-parent`:']),
      ),
    ).toHaveLength(1)
  })

  it('should still report when the Judged apart line names another plan', () => {
    const shared = files('inspector', 5)
    const judged = 'Judged apart from `feature-other`: a contract split.'

    expect(stackFindings(pair(shared, shared, [STACKS, judged]))).toHaveLength(
      1,
    )
  })

  it('should read only the slug the phrase governs', () => {
    const shared = files('inspector', 5)
    const parent = plan({ stem: 'feature-parent', files: shared })
    const other = plan({ stem: 'feature-y', files: shared })
    const child = plan({
      stem: 'feature-x',
      files: shared,
      constraints: [
        '`feature-x` stacks on this slice, not on `feature-y`, which is unrelated.',
      ],
    })

    expect(stackFindings([parent, other, child])).toEqual([])
  })

  it('should count a folder declaration as covering the files under it', () => {
    const parent = ['src/canvas/inspector', 'src/a.ts', 'src/b.ts']
    const child = [
      'src/canvas/inspector/one.ts',
      'src/canvas/inspector/two.ts',
      'src/canvas/inspector/three.ts',
    ]

    expect(stackFindings(pair(parent, child))).toHaveLength(1)
  })

  it('should report a mutual pair once, on the child sorting second', () => {
    const shared = files('inspector', 5)
    const first = plan({
      stem: 'feature-a',
      files: shared,
      constraints: ['Builds on `feature-b`.'],
    })
    const second = plan({
      stem: 'feature-b',
      files: shared,
      constraints: ['Builds on `feature-a`.'],
    })

    expect(stackFindings([first, second]).map((f) => f.record)).toEqual([
      'feature-b.md',
    ])
  })
})

describe('stackPairs', () => {
  it('should carry the counts a reader needs', () => {
    const shared = files('inspector', 4)

    expect(stackPairs(pair(shared, [...shared, 'src/z.ts']))).toEqual([
      { child: 'feature-child', parent: 'feature-parent', shared: 4, union: 5 },
    ])
  })
})

describe('readStackParents', () => {
  it('should read the slug after each stack phrase', () => {
    const { text } = plan({
      stem: 'feature-c',
      files: [],
      constraints: [
        'Stacks on the `feature-one` slice.',
        'Builds on `feature-two`.',
        'Branch from `feature-three` once it merges.',
      ],
    })

    expect(readStackParents(text)).toEqual([
      'feature-one',
      'feature-two',
      'feature-three',
    ])
  })
})
