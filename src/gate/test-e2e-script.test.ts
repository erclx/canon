import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { E2E_CONFIG, locksHandSuite } from '@/gate/hand-suite'

function scriptArgs(): string[] {
  const manifest = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'),
  ) as { scripts: Record<string, string> }
  const words = (manifest.scripts['test:e2e'] ?? '').split(/\s+/)
  return words.slice(words.indexOf('vitest') + 1)
}

function locks(args: string[]): boolean {
  return locksHandSuite({ args, ci: false, watch: false, heldLock: undefined })
}

describe('the test:e2e script', () => {
  it('should hand vitest the config the Tests lock reads', () => {
    expect(scriptArgs()).toEqual(['run', '--config', E2E_CONFIG])
  })

  it('should queue a bare run on the Tests lock', () => {
    expect(locks(scriptArgs())).toBe(true)
  })

  it('should queue a run narrowed to a path on the Tests lock', () => {
    expect(locks([...scriptArgs(), 'src/inventory'])).toBe(true)
  })
})
