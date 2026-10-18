import { describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'
import { loadManifest } from '@/tooling/manifest'

describe('web gitignore', () => {
  it('should ignore the vitest folder beside coverage', () => {
    const sections = loadManifest(PROJECT_ROOT, 'web')?.gitignore ?? []
    const coverage = sections.find((s) => s.header === '# Coverage')

    expect(coverage?.entries).toEqual(['coverage/', '.vitest/'])
  })
})
