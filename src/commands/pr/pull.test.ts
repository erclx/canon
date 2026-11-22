import { describe, expect, it } from 'vitest'
import {
  isNotFound,
  parsePullNumber,
  pullRefusalMessage,
} from '@/commands/pr/pull'

describe('parsePullNumber', () => {
  it.each(['3348]', '33x8', '0', '007', '-1', '#12', '', ' 12', '1.5'])(
    'should refuse %j as bad-input',
    (input) => {
      expect(parsePullNumber(input)).toEqual({
        kind: 'refused',
        reason: 'bad-input',
        number: input,
      })
    },
  )

  it('should accept a positive integer', () => {
    expect(parsePullNumber('3348')).toEqual({ kind: 'found', number: '3348' })
  })
})

describe('isNotFound', () => {
  it('should read the 404 gh prints on stderr', () => {
    expect(isNotFound('gh: Not Found (HTTP 404)')).toBe(true)
  })

  it('should not read another status as not found', () => {
    expect(isNotFound('gh: API rate limit exceeded (HTTP 403)')).toBe(false)
    expect(isNotFound('')).toBe(false)
  })
})

describe('pullRefusalMessage', () => {
  it('should name the number a no-pull refusal carries', () => {
    expect(
      pullRefusalMessage({ reason: 'no-pull', number: '999999' }),
    ).toContain('#999999')
  })

  it('should quote the malformed number a bad-input refusal carries', () => {
    expect(
      pullRefusalMessage({ reason: 'bad-input', number: '3348]' }),
    ).toContain('3348]')
  })

  it('should keep the shared message for every other reason', () => {
    expect(pullRefusalMessage({ reason: 'gh-failed' })).toBe(
      'gh could not answer for this branch. Name the pull request number instead.',
    )
  })
})
