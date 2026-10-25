import { describe, expect, it } from 'vitest'
import {
  checkReason,
  close,
  type CloseApi,
  type CloseOptions,
  type ClosePull,
} from '@/pr/close'

const REASON =
  'Closing unmerged. Base should stay stack-neutral, so each project adds rows for its own stack.'

const OPEN: ClosePull = { isOpen: true, branch: 'feat/x', isFork: false }

interface Fake {
  readonly pull?: ClosePull | undefined
  readonly commentFails?: boolean
  readonly closeFails?: boolean
  readonly deleteFails?: boolean
}

function fakeApi(fake: Fake = {}): { api: CloseApi; calls: string[] } {
  const calls: string[] = []
  const pull = 'pull' in fake ? fake.pull : OPEN
  return {
    calls,
    api: {
      readPull: async () => {
        calls.push('read')
        return pull
      },
      postComment: async (body) => {
        calls.push(`comment:${body}`)
        return fake.commentFails ? undefined : 'https://example.test/c/1'
      },
      patchClosed: async () => {
        calls.push('close')
        return !fake.closeFails
      },
      deleteBranch: async (branch) => {
        calls.push(`delete:${branch}`)
        return !fake.deleteFails
      },
    },
  }
}

const OPTS: CloseOptions = {
  number: 7,
  reason: REASON,
  head: 'feat/x',
  isKeepBranch: false,
}

describe('checkReason', () => {
  it('should find nothing in a short plain reason', () => {
    expect(checkReason(REASON).isClean).toBe(true)
  })

  it('should flag a paragraph run past two', () => {
    const findings = checkReason(['One.', '', 'Two.', '', 'Three.'].join('\n'))

    expect(findings.isClean).toBe(false)
    expect(findings.density.map((f) => f.kind)).toContain('paragraph-run')
  })

  it('should flag a paragraph past the length limit', () => {
    const findings = checkReason(`Closing unmerged. ${'word '.repeat(80)}`)

    expect(findings.density.map((f) => f.kind)).toContain('paragraph-length')
  })

  it('should flag a session link', () => {
    const findings = checkReason(
      `${REASON} https://claude.ai/code/session_01ABCdefGHIjklMNOpqrSTU`,
    )

    expect(findings.sessionLinks).toHaveLength(1)
  })
})

describe('close', () => {
  it('should post the reason, close, then delete the branch, in that order', async () => {
    const { api, calls } = fakeApi()

    const record = await close(api, OPTS)

    expect(record.reason).toBe('closed')
    expect(record.isOk).toBe(true)
    expect(record.branch).toBe('deleted')
    expect(calls).toEqual([
      'read',
      `comment:${REASON}`,
      'close',
      'delete:feat/x',
    ])
  })

  it('should refuse an empty reason before reading anything', async () => {
    const { api, calls } = fakeApi()

    const record = await close(api, { ...OPTS, reason: '  \n' })

    expect(record.reason).toBe('no-reason')
    expect(calls).toEqual([])
  })

  it('should refuse an unpublishable reason before reading anything', async () => {
    const { api, calls } = fakeApi()

    const record = await close(api, {
      ...OPTS,
      reason: ['One.', '', 'Two.', '', 'Three.'].join('\n'),
    })

    expect(record.reason).toBe('reason-unpublishable')
    expect(record.findings?.isClean).toBe(false)
    expect(calls).toEqual([])
  })

  it('should refuse a pull request whose head is another branch', async () => {
    const { api, calls } = fakeApi()

    const record = await close(api, { ...OPTS, head: 'feat/other' })

    expect(record.reason).toBe('head-mismatch')
    expect(calls).toEqual(['read'])
  })

  it('should refuse a pull request already closed', async () => {
    const { api, calls } = fakeApi({ pull: { ...OPEN, isOpen: false } })

    const record = await close(api, OPTS)

    expect(record.reason).toBe('pull-closed')
    expect(calls).toEqual(['read'])
  })

  it('should refuse gh-failed when the pull request cannot be read', async () => {
    const { api } = fakeApi({ pull: undefined })

    expect((await close(api, OPTS)).reason).toBe('gh-failed')
  })

  it('should leave the pull request open when the comment fails', async () => {
    const { api, calls } = fakeApi({ commentFails: true })

    const record = await close(api, OPTS)

    expect(record.reason).toBe('comment-failed')
    expect(calls).not.toContain('close')
  })

  it('should report close-failed with the comment that did post', async () => {
    const { api, calls } = fakeApi({ closeFails: true })

    const record = await close(api, OPTS)

    expect(record.reason).toBe('close-failed')
    expect(record.commentUrl).toBe('https://example.test/c/1')
    expect(calls).not.toContain('delete:feat/x')
  })

  it('should keep the branch under keep-branch', async () => {
    const { api, calls } = fakeApi()

    const record = await close(api, { ...OPTS, isKeepBranch: true })

    expect(record.branch).toBe('kept')
    expect(calls).not.toContain('delete:feat/x')
  })

  it('should skip deleting a fork head this repository cannot delete', async () => {
    const { api, calls } = fakeApi({ pull: { ...OPEN, isFork: true } })

    const record = await close(api, OPTS)

    expect(record.branch).toBe('fork')
    expect(calls).not.toContain('delete:feat/x')
  })

  it('should still report closed when the branch delete fails', async () => {
    const { api } = fakeApi({ deleteFails: true })

    const record = await close(api, OPTS)

    expect(record.reason).toBe('closed')
    expect(record.isOk).toBe(true)
    expect(record.branch).toBe('delete-failed')
  })
})
