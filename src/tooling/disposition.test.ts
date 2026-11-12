import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hashContent } from '@/sync/stamp'
import {
  customize,
  decline,
  heldScriptKeys,
  lift,
  normalizeGoldenPath,
  parseScriptAddress,
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

describe('parseScriptAddress', () => {
  it.each([
    ['package.json:test:run', 'test:run'],
    ['package.json:build/../x', 'build/../x'],
    ['package.json:lint', 'lint'],
  ])('should read %j as the script key %j, verbatim', (input, key) => {
    expect(parseScriptAddress(input)).toBe(key)
  })

  it.each(['test:run', 'package.json', 'package.json:', './package.json:x'])(
    'should read %j as no script address',
    (input) => {
      expect(parseScriptAddress(input)).toBeUndefined()
    },
  )
})

describe('heldScriptKeys', () => {
  it('should collect the keys of script addresses alone', () => {
    const held = {
      'ci.yml': { disposition: 'declined' as const },
      'package.json:test:run': { disposition: 'declined' as const },
      'package.json:lint': { disposition: 'customized' as const },
    }

    expect([...heldScriptKeys(held)]).toEqual(['test:run', 'lint'])
  })
})

describe('resolveGolden for a script address', () => {
  it('should hash the plain value the nearest stack ships', () => {
    const web = { ...makeManifest('web'), scripts: { lint: 'oxlint' } }

    expect(resolveGolden([web], 'package.json:lint')).toEqual({
      rel: 'package.json:lint',
      stack: 'web',
      kind: 'script',
      hash: hashContent('oxlint'),
    })
  })

  it('should hash the override value sync writes over a plain one', () => {
    const base = {
      ...makeManifest('base'),
      scripts: { check: 'plain' },
      scriptOverrides: { check: 'bun run gate' },
    }

    expect(resolveGolden([base], 'package.json:check')?.hash).toBe(
      hashContent('bun run gate'),
    )
  })

  it('should keep a key holding a slash verbatim', () => {
    const base = { ...makeManifest('base'), scripts: { 'a/../b': 'x' } }

    expect(resolveGolden([base], 'package.json:a/../b')?.rel).toBe(
      'package.json:a/../b',
    )
  })

  it('should return undefined for a key no stack ships', () => {
    expect(
      resolveGolden([makeManifest('base')], 'package.json:lint'),
    ).toBeUndefined()
  })
})

const SCRIPT = {
  rel: 'package.json:test:run',
  stack: 'web',
  kind: 'script',
  hash: 'sha256:value',
} as const

describe('script transitions', () => {
  it('should decline a script under its address', () => {
    expect(decline({}, SCRIPT, 'own runner')).toEqual({
      ok: true,
      dispositions: {
        'package.json:test:run': {
          disposition: 'declined',
          reason: 'own runner',
        },
      },
    })
  })

  it('should customize a script the target defines, with the value hash as base', () => {
    expect(customize({}, SCRIPT, true)).toEqual({
      ok: true,
      dispositions: {
        'package.json:test:run': {
          disposition: 'customized',
          base: 'sha256:value',
        },
      },
    })
  })

  it('should refuse to customize a script the target lacks', () => {
    expect(customize({}, SCRIPT, false)).toMatchObject({
      ok: false,
      reason: 'missing-script',
    })
  })

  it('should lift a script by its address', () => {
    const held = {
      'package.json:test:run': { disposition: 'declined' as const },
    }

    expect(lift(held, 'package.json:test:run')).toEqual({
      ok: true,
      dispositions: {},
    })
  })
})
