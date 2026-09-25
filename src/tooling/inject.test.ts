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
import { gitEnv } from '@/git-env'
import { PROJECT_ROOT } from '@/project-root'
import { injectGitignore, injectManifest, injectSeeds } from '@/tooling/inject'
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

    expect(stderr()).toContain('lint:fix')
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

describe('injectSeeds in a subfolder', () => {
  const chain = () =>
    resolveChain(PROJECT_ROOT, 'vite-react', { skipStack: 'base' })

  it('should write the nested spell config', async () => {
    captureStderr()
    const sub = subfolder()

    await injectSeeds(chain(), sub)

    expect(readFileSync(join(sub, 'cspell.json'), 'utf8')).toContain(
      'local-tech-stack',
    )
  })

  it('should leave a spell config the subfolder already edited', async () => {
    captureStderr()
    const sub = subfolder()
    await injectSeeds(chain(), sub)
    writeFileSync(join(sub, 'cspell.json'), '{"edited":true}\n')

    await injectSeeds(chain(), sub)

    expect(readFileSync(join(sub, 'cspell.json'), 'utf8')).toBe(
      '{"edited":true}\n',
    )
  })

  it('should write no cspell.json beside an existing cspell.config file', async () => {
    captureStderr()
    const sub = subfolder()
    writeFileSync(join(sub, 'cspell.config.yaml'), 'version: "0.2"\n')

    await injectSeeds(chain(), sub)

    expect(() => readFileSync(join(sub, 'cspell.json'))).toThrow()
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
