import { describe, expect, it } from 'vitest'
import { baseCandidates, isMergeBase, TRUNK_REFS } from '@/git/base'

describe('baseCandidates', () => {
  it('should return only the named ref when one is given', () => {
    expect(baseCandidates('feat/parser')).toEqual(['feat/parser'])
  })

  it('should return the trunk list when no ref is named', () => {
    expect(baseCandidates(undefined)).toEqual(TRUNK_REFS)
  })
})

describe('isMergeBase', () => {
  it('should accept a commit hash', () => {
    expect(isMergeBase('abc123')).toBe(true)
  })

  it('should refuse undefined', () => {
    expect(isMergeBase(undefined)).toBe(false)
  })

  it('should refuse an empty string', () => {
    expect(isMergeBase('')).toBe(false)
  })
})
