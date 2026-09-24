import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import { PROJECT_ROOT } from '@/project-root'
import { resolveChain } from '@/tooling/manifest'
import {
  isSubfolderTarget,
  isWithheldInSubfolder,
  subfolderPath,
  subfolderSpellConfig,
} from '@/tooling/subfolder'

interface SpellConfig {
  readonly dictionaryDefinitions: readonly { name: string; path: string }[]
  readonly dictionaries: readonly string[]
}

let fixture: string

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'canon-subfolder-'))
})

afterEach(() => {
  rmSync(fixture, { recursive: true, force: true })
})

const initRepo = (dir: string): void => {
  spawnSync('git', ['init', '-q', dir], { env: gitEnv() })
}

const parseSpell = (body: string | undefined): SpellConfig =>
  JSON.parse(body ?? '') as SpellConfig

describe('isSubfolderTarget', () => {
  it('should read a folder below the git toplevel as a subfolder', () => {
    const repo = join(fixture, 'repo')
    initRepo(repo)
    mkdirSync(join(repo, 'web'))

    expect(isSubfolderTarget(join(repo, 'web'))).toBe(true)
  })

  it('should read the git toplevel itself as a root', () => {
    const repo = join(fixture, 'repo')
    initRepo(repo)

    expect(isSubfolderTarget(repo)).toBe(false)
  })

  it('should read a directory outside any repository as a root', () => {
    expect(isSubfolderTarget(fixture)).toBe(false)
  })

  it('should read a symlinked path to the toplevel as a root', () => {
    const repo = join(fixture, 'repo')
    initRepo(repo)
    const link = join(fixture, 'link')
    symlinkSync(repo, link)

    expect(isSubfolderTarget(link)).toBe(false)
  })
})

describe('subfolderPath', () => {
  it('should give a nested target relative to the toplevel', () => {
    const repo = join(fixture, 'repo')
    initRepo(repo)
    mkdirSync(join(repo, 'apps', 'web'), { recursive: true })

    expect(subfolderPath(join(repo, 'apps', 'web'))).toBe(join('apps', 'web'))
  })

  it('should give nothing for the toplevel', () => {
    const repo = join(fixture, 'repo')
    initRepo(repo)

    expect(subfolderPath(repo)).toBeUndefined()
  })
})

describe('isWithheldInSubfolder', () => {
  it('should withhold a workflow under .github', () => {
    expect(isWithheldInSubfolder('.github/workflows/verify.yml')).toBe(true)
  })

  it('should keep a config outside .github', () => {
    expect(isWithheldInSubfolder('scripts/verify.sh')).toBe(false)
  })

  it('should keep a folder whose name only starts with .github', () => {
    expect(isWithheldInSubfolder('.github-pages/index.html')).toBe(false)
  })
})

describe('subfolderSpellConfig', () => {
  it('should register the one python dictionary under a local name', () => {
    const chain = resolveChain(PROJECT_ROOT, 'python', { skipStack: 'base' })

    expect(parseSpell(subfolderSpellConfig(chain)).dictionaries).toEqual([
      'local-tech-stack',
    ])
  })

  it('should register both vite-react dictionaries under local names', () => {
    const chain = resolveChain(PROJECT_ROOT, 'vite-react', {
      skipStack: 'base',
    })

    expect(parseSpell(subfolderSpellConfig(chain)).dictionaries).toEqual([
      'local-project-terms',
      'local-tech-stack',
    ])
  })

  it('should point each definition at the seeded word list', () => {
    const chain = resolveChain(PROJECT_ROOT, 'python', { skipStack: 'base' })

    expect(
      parseSpell(subfolderSpellConfig(chain)).dictionaryDefinitions,
    ).toContainEqual(
      expect.objectContaining({
        name: 'local-tech-stack',
        path: '.cspell/tech-stack.txt',
      }),
    )
  })

  it('should return nothing for a chain that carries base', () => {
    const chain = resolveChain(PROJECT_ROOT, 'python')

    expect(subfolderSpellConfig(chain)).toBeUndefined()
  })
})
