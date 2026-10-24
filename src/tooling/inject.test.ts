import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gitEnv } from '@/git/env'
import { PROJECT_ROOT } from '@/roots/project'
import {
  injectConfigs,
  injectGitignore,
  injectManifest,
  injectSeeds,
} from '@/tooling/inject'
import { type Manifest, resolveChain } from '@/tooling/manifest'

let target: string

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'canon-inject-'))
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(target, { recursive: true, force: true })
})

const captureStderr = (): (() => string) => {
  const writes: string[] = []
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    writes.push(String(chunk))
    return true
  })
  return () => writes.join('')
}

const subfolder = (): string => {
  spawnSync('git', ['init', '-q', target], { env: gitEnv() })
  const sub = join(target, 'web')
  mkdirSync(sub)
  return sub
}

const scriptsOnly = (scripts: Record<string, string>): Manifest => ({
  name: 'scripts-only',
  dir: '/tooling/scripts-only',
  configsDir: '/tooling/scripts-only/configs',
  seedsDir: '/tooling/scripts-only/seeds',
  scripts,
  scriptOverrides: {},
  gitignore: [],
  devPackages: [],
})

const readManifest = (): Record<string, unknown> =>
  JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))

describe('injectManifest', () => {
  it('should write a minimal package.json before installing scripts into it', async () => {
    captureStderr()

    await injectManifest([scriptsOnly({ check: 'bun run lint' })], target)

    const written = readManifest()
    expect(written.name).toBe(basename(target).toLowerCase())
    expect(written.version).toBe('0.0.0')
    expect(written.type).toBe('module')
    expect(written.scripts).toEqual({ check: 'bun run lint' })
    expect(Object.keys(written)).not.toContain('private')
    expect(Object.keys(written)).not.toContain('description')
    expect(Object.keys(written)).not.toContain('main')
  })

  it('should leave an existing package.json as it was', async () => {
    captureStderr()
    const body = '{"name":"mine","scripts":{"check":"x"}}\n'
    writeFileSync(join(target, 'package.json'), body)

    await injectManifest([scriptsOnly({ check: 'y', lint: 'z' })], target)

    const written = readManifest()
    expect(written.name).toBe('mine')
    expect(written.version).toBeUndefined()
    expect(written.scripts).toEqual({ check: 'x', lint: 'z' })
  })

  it('should leave an invalid package.json byte for byte and say it is invalid', async () => {
    const stderr = captureStderr()
    const body = '{ not json'
    writeFileSync(join(target, 'package.json'), body)

    await injectManifest([scriptsOnly({ check: 'y' })], target)

    expect(readFileSync(join(target, 'package.json'), 'utf8')).toBe(body)
    expect(stderr()).toContain(
      `package.json is not valid JSON: fix it in ${target}, then sync again`,
    )
    expect(stderr()).not.toContain('bun init')
  })

  it('should return the refusal and leave the scripts unwritten when the install fails', async () => {
    const stderr = captureStderr()
    const body = '{"name":"mine"}\n'
    writeFileSync(join(target, 'package.json'), body)
    writeFileSync(
      join(target, 'bunfig.toml'),
      '[install]\nregistry = "http://127.0.0.1:9"\n',
    )

    const result = await injectManifest(
      [
        {
          ...scriptsOnly({ check: 'bun run lint' }),
          devPackages: ['zz-nonexistent'],
        },
      ],
      target,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('install-failed')
    expect(result.message).toContain('zz-nonexistent')
    expect(readFileSync(join(target, 'package.json'), 'utf8')).toBe(body)
    expect(existsSync(join(target, '.gitignore'))).toBe(false)
    expect(stderr()).not.toContain('Applying scripts')
  }, 30_000)

  it('should write no package.json when the chain installs nothing', async () => {
    const stderr = captureStderr()

    await injectManifest([scriptsOnly({})], target)

    expect(existsSync(join(target, 'package.json'))).toBe(false)
    expect(stderr()).not.toContain('bun init')
  })
})

describe('injectSeeds over an existing destination', () => {
  it('should leave the file byte for byte', async () => {
    captureStderr()
    const mine = 'mine-only\n'
    writeFileSync(join(target, '.lintstagedrc'), mine)

    await injectSeeds(resolveChain(PROJECT_ROOT, 'base'), target)

    expect(readFileSync(join(target, '.lintstagedrc'), 'utf8')).toBe(mine)
  })

  it('should write the seed when the destination is missing', async () => {
    captureStderr()

    await injectSeeds(resolveChain(PROJECT_ROOT, 'base'), target)

    expect(readFileSync(join(target, '.lintstagedrc'), 'utf8')).toBe(
      readFileSync(
        join(PROJECT_ROOT, 'tooling/base/seeds/.lintstagedrc'),
        'utf8',
      ),
    )
  })
})

describe('injectSeeds with the base stack in a subfolder', () => {
  it('should write no .github seed into the subfolder', async () => {
    captureStderr()
    const sub = subfolder()

    await injectSeeds(resolveChain(PROJECT_ROOT, 'base'), sub)

    expect(existsSync(join(sub, '.github'))).toBe(false)
  })
})

describe('injectSeeds with a config at the same path', () => {
  it('should leave the path to the config the chain ships', async () => {
    captureStderr()

    const applied = await injectSeeds(resolveChain(PROJECT_ROOT, 'web'), target)

    expect(applied).not.toContain('.github/workflows/verify.yml')
  })
})

describe('injectConfigs over a derived verify.ts', () => {
  const RUNNER = join(PROJECT_ROOT, 'tooling/base/configs/scripts/verify.ts')
  const STALE = '// derived web copy\n'

  const seedStale = (dir: string): void => {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, 'scripts/verify.ts'), STALE)
  }

  it('should overwrite it with the base runner at a root', async () => {
    captureStderr()
    seedStale(target)

    await injectConfigs(resolveChain(PROJECT_ROOT, 'web'), target)

    expect(readFileSync(join(target, 'scripts/verify.ts'), 'utf8')).toBe(
      readFileSync(RUNNER, 'utf8'),
    )
  })

  it('should overwrite it with the base runner in a --skip base subfolder', async () => {
    captureStderr()
    const sub = subfolder()
    seedStale(sub)

    await injectConfigs(
      resolveChain(PROJECT_ROOT, 'vite-react', { skipStack: 'base' }),
      sub,
    )

    expect(readFileSync(join(sub, 'scripts/verify.ts'), 'utf8')).toBe(
      readFileSync(RUNNER, 'utf8'),
    )
  })

  it('should write no other base config into a --skip base subfolder', async () => {
    captureStderr()
    const sub = subfolder()

    await injectConfigs(
      resolveChain(PROJECT_ROOT, 'vite-react', { skipStack: 'base' }),
      sub,
    )

    expect(existsSync(join(sub, 'commitlint.config.js'))).toBe(false)
  })

  it('should give a --skip base subfolder the stack phase list', async () => {
    captureStderr()
    const sub = subfolder()

    await injectConfigs(
      resolveChain(PROJECT_ROOT, 'vite-react', { skipStack: 'base' }),
      sub,
    )

    expect(readFileSync(join(sub, 'scripts/verify.json'), 'utf8')).toBe(
      readFileSync(
        join(PROJECT_ROOT, 'tooling/web/configs/scripts/verify.json'),
        'utf8',
      ),
    )
  })
})

describe('injectGitignore', () => {
  it('should resolve the web chain and add the screenshots entry to a target .gitignore', async () => {
    const chain = resolveChain(PROJECT_ROOT, 'web')

    const added = await injectGitignore(chain, target)

    expect(added).toContain('screenshots/')
    expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain(
      'screenshots/',
    )
  })
})
