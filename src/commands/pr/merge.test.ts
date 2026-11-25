import { describe, expect, it } from 'vitest'
import { refusalText } from '@/commands/pr/merge'

describe('refusalText for standing-stale', () => {
  it('should name gh pr update-branch for a release-please pull request', () => {
    const text = refusalText({
      reason: 'standing-stale',
      number: 3512,
      bot: 'release-please',
    })

    expect(text).toContain('gh pr update-branch 3512')
    expect(text).toContain('release tool will not refresh')
  })

  it('should keep the general hint for a Dependabot pull request', () => {
    const text = refusalText({
      reason: 'standing-stale',
      number: 40,
      bot: 'dependabot',
    })

    expect(text).toContain('Update the branch and wait for CI')
    expect(text).not.toContain('gh pr update-branch')
  })

  it('should keep the general hint for an ordinary pull request', () => {
    const text = refusalText({
      reason: 'standing-stale',
      number: 41,
    })

    expect(text).toContain('Update the branch and wait for CI')
    expect(text).not.toContain('gh pr update-branch')
  })
})
