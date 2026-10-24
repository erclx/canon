import { describe, expect, it } from 'vitest'
import type { ChecksGate } from '@/pr/lift'
import {
  botKind,
  composeBotDescription,
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

const RELEASE_BODY = [
  ':robot: I have created a release *beep* *boop*',
  '---',
  '',
  '',
  '## [5.58.0](https://github.com/erclx/canon/compare/v5.57.0...v5.58.0) (2026-10-24)',
  '',
  '',
  '### Features',
  '',
  '* **skills:** offer a restructure before document-repair rewrites ([#2648](https://github.com/erclx/canon/issues/2648)) ([7c2776a](https://github.com/erclx/canon/commit/7c2776a))',
  '',
  '### Bug Fixes',
  '',
  '* **context:** count table rows toward no folder paragraph ([#2646](https://github.com/erclx/canon/issues/2646)) ([a99b020](https://github.com/erclx/canon/commit/a99b020))',
  '',
  '---',
  'This PR was generated with [Release Please](https://github.com/googleapis/release-please). See [documentation](https://github.com/googleapis/release-please#release-please).',
].join('\n')

const RELEASE_CHANGELOG = RELEASE_BODY.split('\n')
  .slice(4, 14)
  .join('\n')
  .trim()

const DEPENDABOT_LEAD = [
  'Bumps the bun group with 3 updates:',
  '',
  '| Package | From | To |',
  '| --- | --- | --- |',
  '| [vitest](https://github.com/vitest-dev/vitest) | `4.0.1` | `4.0.2` |',
  '| [typescript](https://github.com/microsoft/TypeScript) | `5.9.2` | `5.9.3` |',
  '| [zod](https://github.com/colinhacks/zod) | `4.1.1` | `4.1.2` |',
].join('\n')

const DEPENDABOT_BODY = [
  DEPENDABOT_LEAD,
  '',
  'Updates `vitest` from 4.0.1 to 4.0.2',
  '<details>',
  '<summary>Release notes</summary>',
  '<p><em>Sourced from <a href="https://github.com/vitest-dev/vitest/releases">vitest releases</a>.</em></p>',
  '</details>',
  '',
  'Updates `typescript` from 5.9.2 to 5.9.3',
  '<details>',
  '<summary>Commits</summary>',
  '</details>',
  '',
  '_Description has been truncated_',
].join('\n')

describe('botKind', () => {
  it('should read a release-please branch whose body opens on the robot line as release-please', () => {
    expect(
      botKind({
        branch: 'release-please--branches--main--components--canon',
        body: RELEASE_BODY,
        isBotAuthor: false,
      }),
    ).toBe('release-please')
  })

  it('should read a dependabot branch authored by a bot as dependabot', () => {
    expect(
      botKind({
        branch: 'dependabot/bun/bun-0523db4276',
        body: DEPENDABOT_BODY,
        isBotAuthor: true,
      }),
    ).toBe('dependabot')
  })

  it('should leave a human pull request on a dependabot branch on the human path', () => {
    expect(
      botKind({
        branch: 'dependabot/bun/bun-0523db4276',
        body: DEPENDABOT_BODY,
        isBotAuthor: false,
      }),
    ).toBeUndefined()
  })

  it('should leave a human pull request on a release-please branch on the human path', () => {
    expect(
      botKind({
        branch: 'release-please--branches--main--components--canon',
        body: BODY,
        isBotAuthor: false,
      }),
    ).toBeUndefined()
  })

  it('should leave an ordinary branch on the human path', () => {
    expect(
      botKind({ branch: 'feat/x', body: RELEASE_BODY, isBotAuthor: true }),
    ).toBeUndefined()
  })
})

describe('composeBotDescription for release-please', () => {
  it('should keep the changelog and drop the robot line, both dividers, and the footer', () => {
    expect(composeBotDescription('release-please', RELEASE_BODY)).toEqual({
      kind: 'composed',
      description: RELEASE_CHANGELOG,
    })
  })

  it('should compose the same changelog from Windows line endings', () => {
    const composed = composeBotDescription(
      'release-please',
      RELEASE_BODY.replaceAll('\n', '\r\n'),
    )

    expect(composed).toEqual({
      kind: 'composed',
      description: RELEASE_CHANGELOG,
    })
  })

  it('should keep the changelog when the footer is missing', () => {
    const body = RELEASE_BODY.split('\n').slice(0, -2).join('\n')

    expect(composeBotDescription('release-please', body)).toEqual({
      kind: 'composed',
      description: RELEASE_CHANGELOG,
    })
  })

  it('should refuse missing-summary when nothing is left after the drops', () => {
    const body = ':robot: I have created a release *beep* *boop*\n---\n---\n'

    expect(composeBotDescription('release-please', body)).toEqual({
      kind: 'refused',
      reason: 'missing-summary',
    })
  })
})

describe('composeBotDescription for dependabot', () => {
  it('should keep the lead and table and cut at the first Updates line', () => {
    expect(composeBotDescription('dependabot', DEPENDABOT_BODY)).toEqual({
      kind: 'composed',
      description: DEPENDABOT_LEAD,
    })
  })

  it('should keep the whole body when neither an Updates line nor a details block exists', () => {
    expect(composeBotDescription('dependabot', DEPENDABOT_LEAD)).toEqual({
      kind: 'composed',
      description: DEPENDABOT_LEAD,
    })
  })

  it('should cut a single-package body at its first details block', () => {
    const lead =
      'Bumps [actions/checkout](https://github.com/actions/checkout) from 4.2.1 to 4.2.2.'
    const body = [
      lead,
      '<details>',
      '<summary>Release notes</summary>',
      '<p><em>Sourced from <a href="https://github.com/actions/checkout/releases">actions/checkout\'s releases</a>.</em></p>',
      '</details>',
      '',
      'Dependabot will resolve any conflicts with this PR as long as you do not alter it yourself.',
    ].join('\n')

    expect(composeBotDescription('dependabot', body)).toEqual({
      kind: 'composed',
      description: lead,
    })
  })

  it('should refuse missing-summary when the body is empty', () => {
    expect(composeBotDescription('dependabot', '\n  \n')).toEqual({
      kind: 'refused',
      reason: 'missing-summary',
    })
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
    branch: 'feat/add-merge-verb',
    isBotAuthor: false,
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

describe('merge on a bot pull request', () => {
  const RELEASE = {
    title: 'chore(main): release 5.58.0',
    body: RELEASE_BODY,
    branch: 'release-please--branches--main--components--canon',
  }
  const DEPENDABOT = {
    title: 'chore(deps): bump the bun group with 3 updates',
    body: DEPENDABOT_BODY,
    branch: 'dependabot/bun/bun-0523db4276',
    isBotAuthor: true,
  }

  it('should merge a release pull request with the changelog as its description', async () => {
    const { api, puts } = harness({ pull: RELEASE })

    const record = await merge(api, { number: 2649, isDryRun: false })

    expect(record).toMatchObject({ reason: 'merged', isOk: true })
    expect(puts).toEqual([
      {
        title: 'chore(main): release 5.58.0 (#2649)',
        description: RELEASE_CHANGELOG,
        sha: HEAD,
      },
    ])
  })

  it('should merge a dependabot pull request with the lead and table as its description', async () => {
    const { api, puts } = harness({ pull: DEPENDABOT })

    await merge(api, { number: 2483, isDryRun: false })

    expect(puts[0]?.description).toBe(DEPENDABOT_LEAD)
  })

  it.each([
    ['pull-draft', { pull: { isDraft: true } }],
    ['ci-failing', { checks: { state: 'failing', isConflicted: false } }],
    ['ci-pending', { checks: { state: 'pending', isConflicted: false } }],
    ['head-moved', { outcome: { kind: 'head-moved' } }],
  ] as const)(
    'should refuse %s the way a human pull request does',
    async (reason, extra) => {
      const fixture: Fixture = {
        ...extra,
        pull: { ...DEPENDABOT, ...('pull' in extra ? extra.pull : {}) },
      }
      const { api, puts } = harness(fixture)

      const record = await merge(api, { number: 2483, isDryRun: false })

      expect(record).toMatchObject({ reason, isOk: false })
      expect(puts.length).toBe(reason === 'head-moved' ? 1 : 0)
    },
  )

  it('should refuse missing-summary on a bot body that composes to nothing', async () => {
    const { api, puts } = harness({ pull: { ...DEPENDABOT, body: '  ' } })

    const record = await merge(api, { number: 2483, isDryRun: false })

    expect(record).toMatchObject({ reason: 'missing-summary', isOk: false })
    expect(puts).toEqual([])
  })
})
