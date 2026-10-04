import { describe, expect, it } from 'vitest'
import {
  buildIssueArgs,
  failureDetail,
  issueFailureMessage,
} from '@/feedback/github-format'

describe('buildIssueArgs', () => {
  it('builds title and body args with no labels', () => {
    const args = buildIssueArgs({ title: 'A bug', body: 'It broke' })
    expect(args).toEqual([
      'issue',
      'create',
      '--title',
      'A bug',
      '--body',
      'It broke',
      '--repo',
      'erclx/canon',
    ])
  })

  it('appends one --label flag per label', () => {
    const args = buildIssueArgs({
      title: 'A bug',
      body: 'It broke',
      labels: ['bug', 'enhancement'],
    })
    expect(args).toEqual([
      'issue',
      'create',
      '--title',
      'A bug',
      '--body',
      'It broke',
      '--label',
      'bug',
      '--label',
      'enhancement',
      '--repo',
      'erclx/canon',
    ])
  })

  it('treats an empty labels array as no labels', () => {
    const args = buildIssueArgs({
      title: 'A bug',
      body: 'It broke',
      labels: [],
    })
    expect(args).not.toContain('--label')
  })
})

describe('issueFailureMessage', () => {
  it('should name installing gh when the binary is absent', () => {
    const message = issueFailureMessage({ ok: false, reason: 'missing-binary' })

    expect(message).toContain('gh is not installed')
    expect(message).toContain('https://github.com/erclx/canon/issues/new')
  })

  it('should carry the command diagnostic when the call failed', () => {
    const message = issueFailureMessage({
      ok: false,
      reason: 'command-failed',
      detail: 'gh: Not Found (HTTP 404)',
    })

    expect(message).toContain('gh could not file the issue')
    expect(message).toContain('gh: Not Found (HTTP 404)')
    expect(message).toContain('https://github.com/erclx/canon/issues/new')
  })

  it('should separate an absent binary from a failed call', () => {
    const absent = issueFailureMessage({ ok: false, reason: 'missing-binary' })
    const failed = issueFailureMessage({
      ok: false,
      reason: 'command-failed',
      detail: 'auth required',
    })

    expect(absent).not.toBe(failed)
    expect(failed).not.toContain('not installed')
  })

  it('should state the absence of a diagnostic when the failure carries none', () => {
    const message = issueFailureMessage({ ok: false, reason: 'command-failed' })

    expect(message).toContain('no diagnostic on stderr')
  })
})

describe('failureDetail', () => {
  it('should prefer the stderr gh wrote', () => {
    const detail = failureDetail({
      stderr: '  gh: could not find repository\n',
      shortMessage: 'Command failed with exit code 1',
    })

    expect(detail).toBe('gh: could not find repository')
  })

  it('should fall back to the wrapper message when stderr is empty', () => {
    const detail = failureDetail({
      stderr: '   ',
      shortMessage: 'Command timed out after 30000 milliseconds',
    })

    expect(detail).toBe('Command timed out after 30000 milliseconds')
  })

  it('should fall back to the error message when neither is present', () => {
    const detail = failureDetail(new Error('spawn ENOENT'))

    expect(detail).toBe('spawn ENOENT')
  })

  it('should report a thrown non-object as carrying no diagnostic', () => {
    expect(failureDetail('boom')).toBe('gh failed with no diagnostic on stderr')
  })

  it('should collapse a multi-line diagnostic onto one line', () => {
    const detail = failureDetail({
      stderr: 'gh: authentication failed\n\n  run gh auth login\n',
    })

    expect(detail).toBe('gh: authentication failed run gh auth login')
  })
})
