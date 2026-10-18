import { describe, expect, it } from 'vitest'
import { checkClosing, readClosingReferences } from '@/labels/closing'

describe('readClosingReferences', () => {
  it('should read one reference per closing line', () => {
    const body = '## Summary\n\n- a change\n\nCloses #12\nCloses #13\n'
    expect(readClosingReferences(body)).toEqual([12, 13])
  })

  it('should read every keyword form GitHub honors, in any case', () => {
    const body = 'fixes #1\nResolved #2\nclose: #3\nFIXED #4'
    expect(readClosingReferences(body)).toEqual([1, 2, 3, 4])
  })

  it('should count only the number a keyword is followed by', () => {
    expect(readClosingReferences('Closes #12, #13')).toEqual([12])
  })

  it('should read a reference in prose', () => {
    expect(readClosingReferences('This closes #12 once merged.')).toEqual([12])
  })

  it('should skip a code span and a fence', () => {
    const body = 'Write `Closes #12` here.\n\n```\nFixes #99\n```\n'
    expect(readClosingReferences(body)).toEqual([])
  })

  it('should not read a keyword that is part of another word', () => {
    expect(readClosingReferences('Disclosed #12 and prefixes #13')).toEqual([])
  })
})

describe('checkClosing', () => {
  it('should report a missing line', () => {
    expect(checkClosing('## Summary\n\n- x\n', [12])).toEqual({
      missing: [12],
      stray: [],
    })
  })

  it('should report a closing line the verb did not name', () => {
    expect(checkClosing('Closes #12\nFixes #99', [12])).toEqual({
      missing: [],
      stray: [99],
    })
  })

  it('should pass when the body and the expectation agree', () => {
    expect(checkClosing('Closes #12\nCloses #13', [12, 13])).toEqual({
      missing: [],
      stray: [],
    })
  })

  it('should report a stray line when nothing is expected', () => {
    expect(checkClosing('Closes #12', [])).toEqual({
      missing: [],
      stray: [12],
    })
  })

  it('should count a repeated reference once', () => {
    expect(checkClosing('Closes #12\nCloses #12', [12]).stray).toEqual([])
  })
})
