import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readStamp, stampPath } from '@/sync/stamp'
import { appRootPath, parseAppRoot, readAppRoot } from '@/tooling/app-root'

describe('parseAppRoot', () => {
  it.each([
    ['web', 'web'],
    ['web/', 'web'],
    ['apps/web', 'apps/web'],
  ])('should accept %s as %s', (input, expected) => {
    expect(parseAppRoot(input)).toBe(expected)
  })

  it.each(['', '/', '/web', '../web', 'apps/../web', './web', 'Web', '.web'])(
    'should refuse %j',
    (input) => {
      expect(parseAppRoot(input)).toBeUndefined()
    },
  )
})

describe('appRootPath', () => {
  it('should move a path under src/ to the app root', () => {
    expect(appRootPath('src/test/setup.ts', 'web')).toBe('web/test/setup.ts')
  })

  it('should leave a path that only starts with the letters src', () => {
    expect(appRootPath('srcset/a.ts', 'web')).toBe('srcset/a.ts')
  })

  it('should leave a root-level path', () => {
    expect(appRootPath('vite.config.ts', 'web')).toBe('vite.config.ts')
  })
})

describe('readAppRoot', () => {
  let target: string

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'canon-app-root-'))
  })

  afterEach(() => {
    rmSync(target, { recursive: true, force: true })
  })

  const writeTooling = (record: Record<string, unknown>): void => {
    mkdirSync(join(target, 'canon', 'config'), { recursive: true })
    writeFileSync(
      stampPath(target),
      JSON.stringify({
        covers: ['tooling'],
        domains: { tooling: { syncedAt: 'then', files: {}, ...record } },
      }),
    )
  }

  it('should read src for an unstamped target', () => {
    expect(readAppRoot(target)).toBe('src')
  })

  it('should read src for a recorded root that climbs out', () => {
    writeTooling({ appRoot: '../elsewhere' })

    expect(readAppRoot(target)).toBe('src')
  })

  it('should drop a root that is not a string and keep the rest of the record', () => {
    writeTooling({ appRoot: 5, chain: ['base'] })

    expect(readAppRoot(target)).toBe('src')
    expect(readStamp(target)?.domains.tooling?.chain).toEqual(['base'])
  })
})
