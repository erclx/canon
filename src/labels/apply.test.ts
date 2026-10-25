import { describe, expect, it } from 'vitest'
import { diffLabels } from '@/labels/apply'

describe('diffLabels', () => {
  it('should owe each earned label the pull request lacks', () => {
    const diff = diffLabels(['cli', 'docs'], [], ['cli', 'docs'])

    expect(diff.owed).toEqual(['cli', 'docs'])
    expect(diff.toAdd).toEqual(['cli', 'docs'])
  })

  it('should not count a label already on the pull request as owed', () => {
    const diff = diffLabels(['cli', 'docs'], ['cli'], ['cli', 'docs'])

    expect(diff.owed).toEqual(['docs'])
    expect(diff.toAdd).toEqual(['docs'])
  })

  it('should report a label the remote lacks and never offer it to add', () => {
    const diff = diffLabels(['cli', 'ghost'], [], ['cli'])

    expect(diff.missingOnRemote).toEqual(['ghost'])
    expect(diff.toAdd).toEqual(['cli'])
  })

  it('should leave a label the map does not earn out of every list', () => {
    const diff = diffLabels(['cli'], ['cli', 'by-hand'], ['cli', 'by-hand'])

    expect(diff).toEqual({ owed: [], toAdd: [], missingOnRemote: [] })
  })

  it('should match a label differing only in case on the remote and the pull request', () => {
    expect(diffLabels(['docs'], [], ['Docs']).toAdd).toEqual(['docs'])
    expect(diffLabels(['docs'], ['Docs'], ['Docs']).owed).toEqual([])
  })

  it('should owe nothing when the set earns nothing', () => {
    const diff = diffLabels([], ['cli'], ['cli'])

    expect(diff.owed).toEqual([])
  })
})
