import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'
import { loadManifest } from '@/tooling/manifest'

interface Override {
  readonly files?: readonly string[]
  readonly rules?: Readonly<Record<string, unknown>>
}

const RULE = 'react/only-export-components'

const webOverrides = (): readonly Override[] => {
  const path = join(PROJECT_ROOT, 'tooling/web/configs/.oxlintrc.json')
  return JSON.parse(readFileSync(path, 'utf8')).overrides
}

describe('web gitignore', () => {
  it('should ignore the vitest folder beside coverage', () => {
    const sections = loadManifest(PROJECT_ROOT, 'web')?.gitignore ?? []
    const coverage = sections.find((s) => s.header === '# Coverage')

    expect(coverage?.entries).toEqual(['coverage/', '.vitest/'])
  })
})

describe('web oxlint config', () => {
  it('should turn the export rule off for components/ui after the override that sets it', () => {
    const overrides = webOverrides()
    const setsRule = overrides.findIndex((o) => o.rules && RULE in o.rules)
    const ui = overrides.findIndex((o) =>
      o.files?.includes('**/components/ui/**'),
    )

    expect(setsRule).toBeGreaterThanOrEqual(0)
    expect(ui).toBeGreaterThan(setsRule)
    expect(overrides[ui].rules?.[RULE]).toBe('off')
  })
})
