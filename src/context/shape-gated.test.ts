import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isShapeGated,
  missingGatedPrefixes,
  resolveGatedPrefixes,
  SHAPE_GATED_FOLDERS,
} from '@/context/shape-gated'

describe('isShapeGated', () => {
  it('should gate an entry under a listed prefix', () => {
    expect(
      isShapeGated('canon/context/design/render.md', ['canon/context/design/']),
    ).toBe(true)
  })

  it('should leave an entry under no listed prefix ungated', () => {
    expect(
      isShapeGated('canon/context/cli/overview.md', ['canon/context/design/']),
    ).toBe(false)
  })

  it('should gate nothing while the list is empty', () => {
    expect(isShapeGated('canon/context/cli/overview.md', [])).toBe(false)
  })

  it.each([['canon/context/auth'], ['canon/context/auth/']])(
    'should gate the folder written as %s',
    (prefix) => {
      expect(isShapeGated('canon/context/auth/login.md', [prefix])).toBe(true)
    },
  )

  it.each([['canon/context/auth'], ['canon/context/auth/']])(
    'should leave a sibling sharing the letters of %s ungated',
    (prefix) => {
      expect(isShapeGated('canon/context/authz/roles.md', [prefix])).toBe(false)
    },
  )

  it('should gate an entry a prefix names as a file', () => {
    expect(
      isShapeGated('canon/context/context-model.md', [
        'canon/context/context-model.md',
      ]),
    ).toBe(true)
  })
})

describe('resolveGatedPrefixes', () => {
  it('should replace the default with a declared list', () => {
    expect(resolveGatedPrefixes(['canon/context/'])).toEqual(['canon/context/'])
  })

  it('should gate no folder for a declared empty list', () => {
    expect(resolveGatedPrefixes([])).toEqual([])
  })

  it('should keep the toolkit default when the key is absent', () => {
    expect(resolveGatedPrefixes(null)).toBe(SHAPE_GATED_FOLDERS)
  })
})

describe('missingGatedPrefixes', () => {
  let ROOT: string

  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), 'canon-shape-gated-'))
  })

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })

  it('should name a prefix with nothing on disk and pass one that exists', () => {
    mkdirSync(join(ROOT, 'canon/context/billing'), { recursive: true })
    writeFileSync(join(ROOT, 'canon/context/model.md'), '')

    expect(
      missingGatedPrefixes(ROOT, [
        'canon/context/billing/',
        'canon/context/model.md',
        'canon/context/ghost/',
      ]),
    ).toEqual(['canon/context/ghost/'])
  })
})
