import { describe, expect, it } from 'vitest'
import { lift } from '@/pr/lift'
import { makeApi } from '@/pr/fixtures/lift-api'

const RUN = 'https://github.com/erclx/frameboard/actions/runs/45560474777'

function outcome(result: string, conditions = `[run](${RUN})`): string {
  return [
    '## Outcome',
    '',
    '| <what was measured> | Result | baseline | conditions |',
    '| --- | --- | --- | --- |',
    `| scan of 200 files | ${result} | 41 ms | ${conditions} |`,
  ].join('\n')
}

// A pending row holds the merge, never the review or the evidence, so each case reads how the record names it.
describe('lift over a pending measurement', () => {
  it('should refuse a draft whose results row reads pending and write nothing', async () => {
    const { api, calls } = makeApi({ pull: { body: outcome('pending') } })

    const record = await lift(api, { isCheck: false, waitSeconds: 60 })

    expect(record).toMatchObject({
      reason: 'measurement-pending',
      isOk: false,
      pending: [{ row: 'scan of 200 files', run: RUN }],
    })
    expect(calls.marks).toEqual([])
  })

  it('should name the measurement gate beside the others on the record', async () => {
    const { api } = makeApi({ pull: { body: outcome('pending') } })

    const record = await lift(api, { isCheck: true, waitSeconds: 0 })

    expect(record.gates).toContainEqual(
      expect.objectContaining({
        gate: 'measurement',
        isOk: false,
        reason: 'measurement-pending',
      }),
    )
  })

  it('should refuse a ready pull request and leave it out of draft', async () => {
    const { api, calls } = makeApi({
      pull: { isDraft: false, body: outcome('pending') },
    })

    const record = await lift(api, { isCheck: false, waitSeconds: 60 })

    expect(record).toMatchObject({
      reason: 'measurement-pending',
      isReady: true,
    })
    expect(calls.drafts).toEqual([])
  })

  it('should lift once the row is filled and keeps its link', async () => {
    const { api, calls } = makeApi({ pull: { body: outcome('12 ms') } })

    const record = await lift(api, { isCheck: false, waitSeconds: 60 })

    expect(record.reason).toBe('lifted')
    expect(record.pending).toBeUndefined()
    expect(calls.marks).toEqual(['PR_node'])
  })

  it('should lift past a not measured row, since it names a reason', async () => {
    const { api } = makeApi({
      pull: { body: outcome('not measured: run cancelled', 'none') },
    })

    const record = await lift(api, { isCheck: false, waitSeconds: 60 })

    expect(record.reason).toBe('lifted')
  })

  it('should list a pending row with no run without one', async () => {
    const { api } = makeApi({
      pull: { body: outcome('pending', 'still going') },
    })

    const record = await lift(api, { isCheck: true, waitSeconds: 0 })

    expect(record.pending).toEqual([{ row: 'scan of 200 files' }])
  })

  // The merge exempts a bot body, so the lift reads it the same way and the two verbs never disagree.
  it('should lift a bot pull request whose body quotes a pending row', async () => {
    const { api } = makeApi({
      pull: { isBot: true, body: outcome('pending') },
    })

    const record = await lift(api, { isCheck: true, waitSeconds: 0 })

    expect(record.reason).toBe('clear')
    expect(record.pending).toBeUndefined()
  })

  it('should still refuse a pull request that is not a bot', async () => {
    const { api } = makeApi({
      pull: { isBot: false, body: outcome('pending') },
    })

    const record = await lift(api, { isCheck: true, waitSeconds: 0 })

    expect(record.reason).toBe('measurement-pending')
  })

  it('should leave a body with no Outcome table clear', async () => {
    const { api } = makeApi({ pull: { body: '## Summary\n\n- a\n' } })

    const record = await lift(api, { isCheck: true, waitSeconds: 0 })

    expect(record.reason).toBe('clear')
  })
})
