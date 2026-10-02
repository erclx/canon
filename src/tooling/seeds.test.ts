import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { seedRoots } from '@/tooling/seeds'

describe('seedRoots', () => {
  let root: string

  const dir = (path: string): void => {
    mkdirSync(join(root, path), { recursive: true })
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-seed-roots-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('names a seed root carrying .claude/ only', () => {
    dir('tooling/claude/seeds/.claude')

    expect(seedRoots(root)).toEqual(['tooling/claude/seeds'])
  })

  it('names a seed root carrying canon/ only', () => {
    dir('tooling/web/seeds/canon')

    expect(seedRoots(root)).toEqual(['tooling/web/seeds'])
  })

  it('leaves out a seed root carrying neither', () => {
    dir('tooling/base/seeds/.github')

    expect(seedRoots(root)).toEqual([])
  })

  it('sorts the roots it finds', () => {
    dir('tooling/web/seeds/canon')
    dir('tooling/base/seeds/.claude')

    expect(seedRoots(root)).toEqual(['tooling/base/seeds', 'tooling/web/seeds'])
  })

  it('answers empty where there is no tooling folder', () => {
    expect(seedRoots(root)).toEqual([])
  })
})
