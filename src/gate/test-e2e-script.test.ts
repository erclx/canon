import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { E2E_FILTER } from '@/gate/hand-suite'

describe('the test:e2e script', () => {
  it('should hand vitest the filter the Tests lock reads', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }

    expect(manifest.scripts['test:e2e']).toContain(E2E_FILTER)
  })
})
