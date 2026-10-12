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
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gitEnv } from '@/git/env'
import { PROJECT_ROOT } from '@/roots/project'
import {
  injectConfigs,
  injectGitignore,
  injectManifest,
  injectSeeds,
} from '@/tooling/inject'
import { resolveChain } from '@/tooling/manifest'

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

describe('injectManifest', () => {
  it('should name a declared script it could not install without a package.json', async () => {
    const stderr = captureStderr()

    await injectManifest(resolveChain(PROJECT_ROOT, 'web'), target)

    expect(stderr()).toContain('test:run')
  })

  it('should name an override script it could not install without a package.json', async () => {
    const stderr = captureStderr()

    await injectManifest(resolveChain(PROJECT_ROOT, 'web'), target)

    const listed = stderr()
      .match(/Scripts not added: (.*)/)?.[1]
      .split(', ')
    expect(listed).toContain('check:format')
    expect(listed).toContain('lint')
  })

  it('should list a script declared as both plain and override once', async () => {
    const stderr = captureStderr()

    await injectManifest(resolveChain(PROJECT_ROOT, 'vite-react'), target)

    const listed = stderr()
      .match(/Scripts not added: (.*)/)?.[1]
      .split(', ')
    expect(listed?.filter((key) => key === 'build')).toEqual(['build'])
  })

  it('should name a declared dev dependency it could not install without a package.json', async () => {
    const stderr = captureStderr()

    await injectManifest(resolveChain(PROJECT_ROOT, 'web'), target)

    expect(stderr()).toContain('eslint-plugin-check-file')
  })

  it('should tell the reader to run bun init in the target', async () => {
    const stderr = captureStderr()

    await injectManifest(resolveChain(PROJECT_ROOT, 'web'), target)

    expect(stderr()).toContain(`run 'bun init' in ${target}`)
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
