import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hashContent } from '@/sync/stamp'
import {
  customize,
  decline,
  lift,
  normalizeGoldenPath,
  resolveGolden,
} from '@/tooling/disposition'
import type { Manifest } from '@/tooling/manifest'

let root: string

function makeManifest(name: string): Manifest {
  const dir = join(root, 'tooling', name)
  return {
    name,
    dir,
    configsDir: join(dir, 'configs'),
    seedsDir: join(dir, 'seeds'),
    scripts: {},
    scriptOverrides: {},
    gitignore: [],
    devPackages: [],
  }
}

function writeAt(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, body)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-disposition-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('normalizeGoldenPath', () => {
  it('should strip a leading ./ and collapse separators', () => {
    expect(normalizeGoldenPath('./.github//workflows/ci.yml')).toBe(
      '.github/workflows/ci.yml',
    )
  })

  it.each(['/etc/passwd', '../outside.yml', 'a/../../b', '', '.'])(
    'should reject %j as no path inside the target',
    (input) => {
      expect(normalizeGoldenPath(input)).toBeUndefined()
    },
  )
})

describe('resolveGolden', () => {
  it('should resolve a config to the nearest stack shipping it, with that copy hash', () => {
    const web = makeManifest('web')
    const base = makeManifest('base')
    writeAt(join(web.configsDir, '.editorconfig'), 'web\n')
    writeAt(join(base.configsDir, '.editorconfig'), 'base\n')

    expect(resolveGolden([web, base], '.editorconfig')).toEqual({
      rel: '.editorconfig',
      stack: 'web',
      kind: 'config',
      hash: hashContent('web\n'),
    })
  })

  it('should resolve a seed the chain ships as a seed', () => {
    const base = makeManifest('base')
    writeAt(join(base.seedsDir, 'docs', 'intro.md'), 'intro\n')

    expect(resolveGolden([base], 'docs/intro.md')?.kind).toBe('seed')
  })

  it('should read a path shipped as both config and seed as the config', () => {
    const base = makeManifest('base')
    writeAt(join(base.configsDir, 'ci.yml'), 'config\n')
    writeAt(join(base.seedsDir, 'ci.yml'), 'seed\n')

    expect(resolveGolden([base], 'ci.yml')?.kind).toBe('config')
  })

  it('should return undefined for a path no stack ships', () => {
    expect(resolveGolden([makeManifest('base')], 'nope.txt')).toBeUndefined()
  })
})

const CONFIG = {
  rel: 'ci.yml',
  stack: 'web',
  kind: 'config',
  hash: 'sha256:golden',
} as const

const SEED = { ...CONFIG, rel: 'docs/intro.md', kind: 'seed' } as const

describe('decline', () => {
  it('should record a declined config with its reason', () => {
    const result = decline({}, CONFIG, 'unused')

    expect(result).toEqual({
      ok: true,
      dispositions: { 'ci.yml': { disposition: 'declined', reason: 'unused' } },
    })
  })

  it('should decline a seed', () => {
    const result = decline({}, SEED)

    expect(result).toEqual({
      ok: true,
      dispositions: { 'docs/intro.md': { disposition: 'declined' } },
    })
  })

  it('should keep the other entries', () => {
    const result = decline({ 'x.yml': { disposition: 'declined' } }, CONFIG)

    expect(result.ok && Object.keys(result.dispositions)).toEqual([
      'x.yml',
      'ci.yml',
    ])
  })

  it('should refuse a path no stack ships', () => {
    expect(decline({}, undefined)).toMatchObject({
      ok: false,
      reason: 'not-golden',
    })
  })

  it('should refuse a path already held', () => {
    const held = { 'ci.yml': { disposition: 'customized' as const } }

    expect(decline(held, CONFIG)).toMatchObject({
      ok: false,
      reason: 'already-held',
    })
  })
})

describe('customize', () => {
  it('should record the golden hash as base', () => {
    expect(customize({}, CONFIG, true)).toEqual({
      ok: true,
      dispositions: {
        'ci.yml': { disposition: 'customized', base: 'sha256:golden' },
      },
    })
  })

  it('should refuse a seed, which the target already owns', () => {
    expect(customize({}, SEED, true)).toMatchObject({
      ok: false,
      reason: 'seed-not-customizable',
    })
  })

  it('should refuse a config the target does not hold', () => {
    expect(customize({}, CONFIG, false)).toMatchObject({
      ok: false,
      reason: 'missing-file',
    })
  })

  it('should refuse a path no stack ships', () => {
    expect(customize({}, undefined, true)).toMatchObject({
      ok: false,
      reason: 'not-golden',
    })
  })

  it('should refuse a path already held', () => {
    const held = { 'ci.yml': { disposition: 'declined' as const } }

    expect(customize(held, CONFIG, true)).toMatchObject({
      ok: false,
      reason: 'already-held',
    })
  })
})

describe('lift', () => {
  it('should remove the entry', () => {
    const held = {
      'ci.yml': { disposition: 'declined' as const },
      'x.yml': { disposition: 'declined' as const },
    }

    expect(lift(held, 'ci.yml')).toEqual({
      ok: true,
      dispositions: { 'x.yml': { disposition: 'declined' } },
    })
  })

  it('should lift a path the chain no longer ships', () => {
    const held = { 'gone.yml': { disposition: 'declined' as const } }

    expect(lift(held, 'gone.yml')).toEqual({ ok: true, dispositions: {} })
  })

  it('should refuse a path not held', () => {
    expect(lift({}, 'ci.yml')).toMatchObject({
      ok: false,
      reason: 'not-held',
    })
  })
})
