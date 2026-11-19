import { describe, expect, it } from 'vitest'
import {
  buildCommentArgs,
  buildIssueArgs,
  buildIssueListArgs,
  buildIssueReadArgs,
  commentFailureMessage,
  failureDetail,
  issueFailureMessage,
  issueListFailureMessage,
  issueReadFailureMessage,
  parseIssueList,
  parseIssueRead,
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

describe('buildCommentArgs', () => {
  it('should comment on the numbered issue in the toolkit repository', () => {
    expect(buildCommentArgs(2801, 'a follow-up')).toEqual([
      'issue',
      'comment',
      '2801',
      '--body',
      'a follow-up',
      '--repo',
      'erclx/canon',
    ])
  })
})

describe('buildIssueReadArgs', () => {
  it('should read the state and labels of the issue in the toolkit repository', () => {
    expect(buildIssueReadArgs(2801)).toEqual([
      'issue',
      'view',
      '2801',
      '--json',
      'state,labels',
      '--repo',
      'erclx/canon',
    ])
  })
})

describe('parseIssueRead', () => {
  it('should read the state and each label name', () => {
    const stdout = JSON.stringify({
      state: 'OPEN',
      labels: [{ name: 'feedback' }, { name: 'skills' }],
    })

    expect(parseIssueRead(stdout)).toEqual({
      ok: true,
      state: 'OPEN',
      labels: ['feedback', 'skills'],
    })
  })

  it('should fail on output that is not JSON', () => {
    expect(parseIssueRead('not json')).toMatchObject({
      ok: false,
      reason: 'command-failed',
    })
  })

  it('should fail on a record carrying no labels array', () => {
    expect(parseIssueRead('{"state":"OPEN"}')).toMatchObject({ ok: false })
  })
})

describe('buildIssueListArgs', () => {
  it('should list open feedback issues in the toolkit repository', () => {
    const args = buildIssueListArgs()

    expect(args.slice(0, 2)).toEqual(['issue', 'list'])
    expect(args).toContain('feedback')
    expect(args).toContain('open')
    expect(args.slice(-2)).toEqual(['--repo', 'erclx/canon'])
  })
})

describe('parseIssueList', () => {
  function issue(number: number, title = `report ${number}`) {
    return {
      number,
      title,
      url: `https://github.com/erclx/canon/issues/${number}`,
    }
  }

  it('should read each issue as its number, title, and url', () => {
    const stdout = JSON.stringify([issue(3210, 'retro skill')])

    expect(parseIssueList(stdout)).toEqual({
      ok: true,
      issues: [
        {
          number: 3210,
          title: 'retro skill',
          url: 'https://github.com/erclx/canon/issues/3210',
        },
      ],
    })
  })

  it('should sort the issues by number, oldest first', () => {
    const stdout = JSON.stringify([issue(30), issue(10), issue(20)])

    const read = parseIssueList(stdout)

    expect(read.ok && read.issues.map((entry) => entry.number)).toEqual([
      10, 20, 30,
    ])
  })

  it('should read an empty queue as no issues rather than a failure', () => {
    expect(parseIssueList('[]')).toEqual({ ok: true, issues: [] })
  })

  it('should drop fields gh carries beyond the three it reports', () => {
    const stdout = JSON.stringify([{ ...issue(5), body: 'long', author: {} }])

    const read = parseIssueList(stdout)

    expect(read.ok && Object.keys(read.issues[0] ?? {})).toEqual([
      'number',
      'title',
      'url',
    ])
  })

  it('should fail on output that is not JSON', () => {
    expect(parseIssueList('not json')).toMatchObject({
      ok: false,
      reason: 'command-failed',
    })
  })

  it('should fail on a record that is not an array', () => {
    expect(parseIssueList('{"number":1}')).toMatchObject({ ok: false })
  })

  it('should fail on an entry carrying no number', () => {
    const stdout = JSON.stringify([{ title: 'x', url: 'y' }])

    expect(parseIssueList(stdout)).toMatchObject({ ok: false })
  })
})

describe('issueListFailureMessage', () => {
  it('should name installing gh when the binary is absent', () => {
    const message = issueListFailureMessage({
      ok: false,
      reason: 'missing-binary',
    })

    expect(message).toContain('gh is not installed')
  })

  it('should carry the command diagnostic when the call failed', () => {
    const message = issueListFailureMessage({
      ok: false,
      reason: 'command-failed',
      detail: 'HTTP 401',
    })

    expect(message).toContain('HTTP 401')
  })
})

describe('commentFailureMessage', () => {
  it('should point at the issue rather than a new one when gh is absent', () => {
    const message = commentFailureMessage(
      { ok: false, reason: 'missing-binary' },
      2801,
    )

    expect(message).toContain('gh is not installed')
    expect(message).toContain('https://github.com/erclx/canon/issues/2801')
  })

  it('should carry the command diagnostic when the call failed', () => {
    const message = commentFailureMessage(
      { ok: false, reason: 'command-failed', detail: 'HTTP 404' },
      2801,
    )

    expect(message).toContain('HTTP 404')
    expect(message).not.toContain('issues/new')
  })
})

describe('issueReadFailureMessage', () => {
  it('should name the issue and ask for the number rather than a hand comment', () => {
    const message = issueReadFailureMessage(
      {
        ok: false,
        reason: 'command-failed',
        detail: 'Could not resolve to an issue or pull request',
      },
      999999,
    )

    expect(message).toContain('#999999')
    expect(message).toContain('Could not resolve to an issue')
    expect(message).toContain('Check the number')
    expect(message).not.toContain('Comment manually')
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
