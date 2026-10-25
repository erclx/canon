import { describe, expect, it } from 'vitest'
import { missingLabels } from '@/labels/sync'

describe('missingLabels', () => {
  it('should list each map label the remote lacks, in map order', () => {
    expect(missingLabels(['tooling', 'claude', 'docs'], ['claude'])).toEqual([
      'tooling',
      'docs',
    ])
  })

  it('should list nothing when the remote carries every map label', () => {
    expect(missingLabels(['cli'], ['cli', 'by-hand'])).toEqual([])
  })

  it('should never list a remote label the map does not name', () => {
    expect(missingLabels([], ['by-hand'])).toEqual([])
  })
})
