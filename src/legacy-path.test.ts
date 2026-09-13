import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveExisting } from '@/legacy-path'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-legacy-path-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function writeFixture(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '')
}

describe('resolveExisting', () => {
  it('should return the preferred path when neither exists', () => {
    const preferred = join(ROOT, 'current.json')
    const legacy = join(ROOT, 'legacy.json')

    expect(resolveExisting([preferred, legacy])).toBe(preferred)
  })

  it('should return the preferred path when only it exists', () => {
    const preferred = join(ROOT, 'current.json')
    const legacy = join(ROOT, 'legacy.json')
    writeFixture(preferred)

    expect(resolveExisting([preferred, legacy])).toBe(preferred)
  })

  it('should fall back to a legacy path when only it exists', () => {
    const preferred = join(ROOT, 'current.json')
    const legacy = join(ROOT, 'legacy.json')
    writeFixture(legacy)

    expect(resolveExisting([preferred, legacy])).toBe(legacy)
  })

  it('should prefer the current path over a legacy one when both exist', () => {
    const preferred = join(ROOT, 'current.json')
    const legacy = join(ROOT, 'legacy.json')
    writeFixture(preferred)
    writeFixture(legacy)

    expect(resolveExisting([preferred, legacy])).toBe(preferred)
  })

  it('should walk more than one legacy path in order', () => {
    const preferred = join(ROOT, 'current.json')
    const legacyOld = join(ROOT, 'legacy-old.json')
    const legacyOlder = join(ROOT, 'legacy-older.json')
    writeFixture(legacyOlder)

    expect(resolveExisting([preferred, legacyOld, legacyOlder])).toBe(
      legacyOlder,
    )
  })
})
