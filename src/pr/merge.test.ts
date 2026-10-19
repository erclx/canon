import { describe, expect, it } from 'vitest'
import type { ChecksGate } from '@/pr/lift'
import {
  composeDescription,
  merge,
  type MergeApi,
  type MergeOutcome,
  type MergePull,
  mergeTitle,
} from '@/pr/merge'

const HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'
const MERGED_SHA = 'c0ffee0000000000000000000000000000000000'

const BODY = [
  '## Summary',
  '',
  '- `canon pr merge` squash-merges one ready pull request',
  '- It refuses a draft',
  '',
  '## Key changes',
  '',
  '- Add `src/pr/merge.ts`',
  '- Register `pr merge`',
  '',
  '## Technical context',
  '',
  '- The merge goes through REST, since the proxy refuses GraphQL',
  '',
  '## Testing',
  '',
  '- [x] `bun run check`',
  '- [x] UI pass, 3 of 3 boxes passed at `9b1f2c3` <!-- pr-ui-pass -->',
  '',
  '## For the reviewer',
  '',
  '- Look at the head pin',
  '',
].join('\n')

const SUMMARY_BLOCK =
  '## Summary\n\n- `canon pr merge` squash-merges one ready pull request\n- It refuses a draft'
const KEY_CHANGES_BLOCK =
  '## Key changes\n\n- Add `src/pr/merge.ts`\n- Register `pr merge`'
const CONTEXT_BLOCK =
  '## Technical context\n\n- The merge goes through REST, since the proxy refuses GraphQL'

describe('composeDescription', () => {
  it('should keep Summary, Key changes, and Technical context in that order and nothing else', () => {
    expect(composeDescription(BODY)).toEqual({
      kind: 'composed',
      description: `${SUMMARY_BLOCK}\n\n${KEY_CHANGES_BLOCK}\n\n${CONTEXT_BLOCK}`,
    })
  })

  it('should keep the sections in that order when the body writes them in another', () => {
    const body = `${CONTEXT_BLOCK}\n\n${KEY_CHANGES_BLOCK}\n\n${SUMMARY_BLOCK}\n`

    expect(composeDescription(body)).toEqual({
      kind: 'composed',
      description: `${SUMMARY_BLOCK}\n\n${KEY_CHANGES_BLOCK}\n\n${CONTEXT_BLOCK}`,
    })
  })

  it('should drop a marker line that sits inside a kept section and keep its neighbours', () => {
    const body = BODY.replace(
      '- It refuses a draft',
      '- It refuses a draft\n- [ ] UI pass, not run at `9b1f2c3` <!-- pr-ui-pass -->\n- It refuses a closed pull request',
    )

    const composed = composeDescription(body)

    expect(composed).toMatchObject({ kind: 'composed' })
    const description = composed.kind === 'composed' ? composed.description : ''
    expect(description).not.toContain('pr-ui-pass')
    expect(description).toContain(
      '- It refuses a draft\n- It refuses a closed pull request',
    )
  })

  it('should compose two sections when the body has no Technical context', () => {
    const body = `${SUMMARY_BLOCK}\n\n${KEY_CHANGES_BLOCK}\n\n## Testing\n\n- [x] check\n`

    expect(composeDescription(body)).toEqual({
      kind: 'composed',
      description: `${SUMMARY_BLOCK}\n\n${KEY_CHANGES_BLOCK}`,
    })
  })

  it('should leave no bare heading when Technical context is empty', () => {
    const body = `${SUMMARY_BLOCK}\n\n${KEY_CHANGES_BLOCK}\n\n## Technical context\n\n## Testing\n`

    expect(composeDescription(body)).toEqual({
      kind: 'composed',
      description: `${SUMMARY_BLOCK}\n\n${KEY_CHANGES_BLOCK}`,
    })
  })

  it('should compose a lowercase heading and a CRLF body', () => {
    const body = `## summary\r\n\r\n- one\r\n\r\n## KEY CHANGES\r\n\r\n- two\r\n`

    expect(composeDescription(body)).toEqual({
      kind: 'composed',
      description: '## Summary\n\n- one\n\n## Key changes\n\n- two',
    })
  })

  it('should keep a fenced heading in the text and end nothing at it', () => {
    const body = [
      '## Summary',
      '',
      '```md',
      '## Not a heading',
      '```',
      '',
      '- after the fence',
      '',
      KEY_CHANGES_BLOCK,
    ].join('\n')

    const composed = composeDescription(body)

    expect(composed).toMatchObject({ kind: 'composed' })
    const description = composed.kind === 'composed' ? composed.description : ''
    expect(description).toContain('```md\n## Not a heading\n```')
    expect(description).toContain('- after the fence')
  })

  it('should refuse missing-summary when the heading is absent', () => {
    expect(composeDescription(KEY_CHANGES_BLOCK)).toEqual({
      kind: 'refused',
      reason: 'missing-summary',
    })
  })

  it('should refuse missing-summary when the heading sits over a blank line', () => {
    const body = `## Summary\n\n\n${KEY_CHANGES_BLOCK}`

    expect(composeDescription(body)).toEqual({
      kind: 'refused',
      reason: 'missing-summary',
    })
  })

  it('should refuse missing-summary when only a pass line fills it', () => {
    const body = `## Summary\n\n- [ ] UI pass <!-- pr-ui-pass -->\n\n${KEY_CHANGES_BLOCK}`

    expect(composeDescription(body)).toEqual({
      kind: 'refused',
      reason: 'missing-summary',
    })
  })

  it('should refuse missing-key-changes when the heading is absent', () => {
    expect(composeDescription(SUMMARY_BLOCK)).toEqual({
      kind: 'refused',
      reason: 'missing-key-changes',
    })
  })
})

describe('mergeTitle', () => {
  it('should append the pull request number the way the web merge does', () => {
    expect(mergeTitle('feat(pr): add a merge verb', 2544)).toBe(
      'feat(pr): add a merge verb (#2544)',
    )
  })
})

interface Fixture {
  pull?: Partial<MergePull> | null
  checks?: ChecksGate | null
  outcome?: MergeOutcome
}

interface Harness {
  readonly api: MergeApi
  readonly puts: { title: string; description: string; sha: string }[]
}

function harness(fixture: Fixture = {}): Harness {
  const puts: Harness['puts'] = []
  const pull: MergePull = {
    isOpen: true,
    isDraft: false,
    title: 'feat(pr): add a merge verb',
    body: BODY,
    head: HEAD,
    ...fixture.pull,
  }
  const api: MergeApi = {
    readPull: async () => (fixture.pull === null ? undefined : pull),
    readChecks: async () =>
      fixture.checks === null
        ? undefined
        : (fixture.checks ?? { state: 'passing', isConflicted: false }),
    putMerge: async (request) => {
      puts.push(request)
      return fixture.outcome ?? { kind: 'merged', sha: MERGED_SHA }
    },
  }
  return { api, puts }
}

describe('merge', () => {
  it('should squash-merge a ready pull request with the composed message pinned to the head', async () => {
    const { api, puts } = harness()

    const record = await merge(api, { number: 2544, isDryRun: false })

    expect(record).toMatchObject({
      reason: 'merged',
      isOk: true,
      number: 2544,
      title: 'feat(pr): add a merge verb (#2544)',
      sha: MERGED_SHA,
    })
    expect(puts).toEqual([
      {
        title: 'feat(pr): add a merge verb (#2544)',
        description: `${SUMMARY_BLOCK}\n\n${KEY_CHANGES_BLOCK}\n\n${CONTEXT_BLOCK}`,
        sha: HEAD,
      },
    ])
  })

  it('should report the title and description on a dry run and call no merge', async () => {
    const { api, puts } = harness()

    const record = await merge(api, { number: 2544, isDryRun: true })

    expect(record).toMatchObject({
      reason: 'dry-run',
      isOk: true,
      title: 'feat(pr): add a merge verb (#2544)',
    })
    expect(record.description).toContain('## Summary')
    expect(record.sha).toBeUndefined()
    expect(puts).toEqual([])
  })

  it.each<[string, Fixture, string]>([
    ['a closed pull request', { pull: { isOpen: false } }, 'pull-closed'],
    ['a draft', { pull: { isDraft: true } }, 'pull-draft'],
    [
      'failing checks',
      { checks: { state: 'failing', isConflicted: false } },
      'ci-failing',
    ],
    [
      'pending checks',
      { checks: { state: 'pending', isConflicted: false } },
      'ci-pending',
    ],
    [
      'conflicted checks',
      { checks: { state: 'pending', isConflicted: true } },
      'ci-conflicted',
    ],
    [
      'a missing summary',
      { pull: { body: KEY_CHANGES_BLOCK } },
      'missing-summary',
    ],
    [
      'a missing key changes',
      { pull: { body: SUMMARY_BLOCK } },
      'missing-key-changes',
    ],
    ['a pull read that failed', { pull: null }, 'gh-failed'],
    ['a checks read that failed', { checks: null }, 'gh-failed'],
  ])('should refuse %s and call no merge', async (_name, fixture, reason) => {
    const { api, puts } = harness(fixture)

    const record = await merge(api, { number: 2544, isDryRun: false })

    expect(record).toMatchObject({ reason, isOk: false })
    expect(record.sha).toBeUndefined()
    expect(puts).toEqual([])
  })

  it('should refuse a dry run the same way it refuses a merge', async () => {
    const { api } = harness({ pull: { isDraft: true } })

    const record = await merge(api, { number: 2544, isDryRun: true })

    expect(record).toMatchObject({ reason: 'pull-draft', isOk: false })
  })

  it('should refuse head-moved on a 409 rather than read it as a merge', async () => {
    const { api } = harness({ outcome: { kind: 'head-moved' } })

    const record = await merge(api, { number: 2544, isDryRun: false })

    expect(record).toMatchObject({ reason: 'head-moved', isOk: false })
    expect(record.sha).toBeUndefined()
  })

  it('should refuse not-mergeable on a 405 rather than read it as a merge', async () => {
    const { api } = harness({ outcome: { kind: 'not-mergeable' } })

    const record = await merge(api, { number: 2544, isDryRun: false })

    expect(record).toMatchObject({ reason: 'not-mergeable', isOk: false })
  })

  it('should refuse gh-failed when the merge call failed', async () => {
    const { api } = harness({ outcome: { kind: 'failed' } })

    const record = await merge(api, { number: 2544, isDryRun: false })

    expect(record).toMatchObject({ reason: 'gh-failed', isOk: false })
  })
})
