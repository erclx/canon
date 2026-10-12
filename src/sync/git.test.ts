import { describe, expect, it } from 'vitest'
import {
  changedNames,
  changedPaths,
  classifyStatus,
  commitMessage,
  type DomainChange,
  formatFileList,
  pullRequestBody,
  syncBranchName,
} from '@/sync/git'

describe('classifyStatus', () => {
  it('should report Add when every entry is untracked', () => {
    const status = '?? .claude/standards/one.md\n?? .claude/standards/two.md'

    expect(classifyStatus(status)).toBe('Add')
  })

  it('should report Remove when every entry is a deletion', () => {
    const status = ' D .claude/standards/one.md\nD  .claude/standards/two.md'

    expect(classifyStatus(status)).toBe('Remove')
  })

  it('should report Remove for a both-deleted conflict code', () => {
    expect(classifyStatus('DD .claude/standards/one.md')).toBe('Remove')
  })

  it('should report Update for a modification', () => {
    expect(classifyStatus(' M .claude/standards/one.md')).toBe('Update')
  })

  it('should report Update when an addition and a deletion mix', () => {
    const status = '?? .claude/standards/new.md\n D .claude/standards/old.md'

    expect(classifyStatus(status)).toBe('Update')
  })

  it('should report Update for empty output rather than guessing a verb', () => {
    expect(classifyStatus('')).toBe('Update')
  })
})

describe('changedPaths', () => {
  it('should take the path from each porcelain line', () => {
    const status = ' M .claude/standards/one.md\n?? .claude/rules/two.md'

    expect(changedPaths(status)).toEqual([
      '.claude/standards/one.md',
      '.claude/rules/two.md',
    ])
  })

  it('should ignore blank lines', () => {
    expect(changedPaths('\n M a.md\n\n')).toEqual(['a.md'])
  })

  it('should take the destination of a rename', () => {
    expect(changedPaths('R  old.md -> new.md')).toEqual(['new.md'])
  })
})

describe('changedNames', () => {
  it('should reduce paths to sorted unique basenames', () => {
    const status = ' M .claude/rules/b.md\n M .claude/standards/a.md'

    expect(changedNames(status)).toEqual(['a.md', 'b.md'])
  })

  it('should collapse the same basename from two directories', () => {
    const status = ' M .claude/rules/core/a.md\n M .claude/rules/lang/a.md'

    expect(changedNames(status)).toEqual(['a.md'])
  })

  it('should return nothing for empty output', () => {
    expect(changedNames('')).toEqual([])
  })
})

describe('formatFileList', () => {
  it('should join three or fewer names in full', () => {
    expect(formatFileList(['a.md', 'b.md', 'c.md'])).toBe('a.md, b.md, c.md')
  })

  it('should truncate past three and count the rest', () => {
    const files = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md']

    expect(formatFileList(files)).toBe('a.md, b.md, c.md, and 2 more')
  })

  it('should return an empty string for no files', () => {
    expect(formatFileList([])).toBe('')
  })
})

describe('syncBranchName', () => {
  it('should name the branch at minute resolution', () => {
    const now = new Date(2026, 6, 29, 12, 42, 59)

    expect(syncBranchName(now)).toBe('chore/canon-sync-20260729-1242')
  })

  it('should pad single-digit month, day, hour, and minute', () => {
    const now = new Date(2026, 0, 5, 4, 7, 0)

    expect(syncBranchName(now)).toBe('chore/canon-sync-20260105-0407')
  })

  it('should produce the same name twice inside one minute', () => {
    const first = new Date(2026, 6, 29, 12, 42, 1)
    const second = new Date(2026, 6, 29, 12, 42, 58)

    expect(syncBranchName(first)).toBe(syncBranchName(second))
  })
})

describe('commitMessage', () => {
  it('should list every changed domain', () => {
    expect(commitMessage(['governance', 'claude'])).toBe(
      'chore(sync): update governance, claude from toolkit',
    )
  })
})

describe('pullRequestBody', () => {
  it('should render one bullet per domain under the headings', () => {
    const changes: DomainChange[] = [
      {
        domain: 'claude',
        verb: 'Update',
        names: ['.gitignore'],
        paths: ['.gitignore'],
      },
      {
        domain: 'governance',
        verb: 'Add',
        names: ['testing.md'],
        paths: ['.claude/rules/core/testing.md'],
      },
    ]

    expect(pullRequestBody(changes)).toBe(
      [
        '## Summary',
        '',
        'Sync claude, governance from toolkit.',
        '',
        '## Key changes',
        '',
        '- Update `claude/` .gitignore.',
        '- Add `governance/` testing.md.',
      ].join('\n'),
    )
  })

  it('should truncate a long file list inside the bullet', () => {
    const changes: DomainChange[] = [
      {
        domain: 'claude',
        verb: 'Update',
        names: ['a.md', 'b.md', 'c.md', 'd.md'],
        paths: [],
      },
    ]

    expect(pullRequestBody(changes)).toContain(
      '- Update `claude/` a.md, b.md, c.md, and 1 more.',
    )
  })
})
