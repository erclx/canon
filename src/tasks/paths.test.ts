import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isUnder } from '@/tasks/paths'

describe('isUnder', () => {
  it('should read a directory as being under itself', () => {
    expect(isUnder('/root/plans', '/root/plans')).toBe(true)
  })

  it('should read a file inside the directory as under it', () => {
    expect(isUnder(join('/root/plans', 'feature-gate.md'), '/root/plans')).toBe(
      true,
    )
  })

  it('should read a nested file as under the directory above it', () => {
    expect(
      isUnder(join('/root/plans', 'archive', 'feature-gate.md'), '/root/plans'),
    ).toBe(true)
  })

  it('should not read a sibling sharing the name as a prefix', () => {
    expect(isUnder('/root/plans-archive/feature-gate.md', '/root/plans')).toBe(
      false,
    )
  })

  it('should not read a path outside the directory as under it', () => {
    expect(isUnder('/root/tasks/v1.md', '/root/plans')).toBe(false)
  })
})
