import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { hashContent, stampPath } from '@/sync/stamp'
import type { Manifest } from '@/tooling/manifest'
import { scan } from '@/tooling/scan'

let root: string

function makeManifest(
  name: string,
  overrides: Partial<Manifest> = {},
): Manifest {
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
    ...overrides,
  }
}

function seedFile(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, body)
}

function target(): string {
  const dir = join(root, 'target')
  mkdirSync(dir, { recursive: true })
  return dir
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-scan-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scan', () => {
  it('should report a config the target lacks as new', () => {
    const manifest = makeManifest('base')
    seedFile(join(manifest.configsDir, '.editorconfig'), 'root = true\n')

    const result = scan([manifest], target())

    expect(result.configs).toEqual([
      { rel: '.editorconfig', stack: 'base', state: 'new' },
    ])
  })

  it('should report an identical config as matching', () => {
    const manifest = makeManifest('base')
    const dir = target()
    seedFile(join(manifest.configsDir, '.editorconfig'), 'root = true\n')
    seedFile(join(dir, '.editorconfig'), 'root = true\n')

    const result = scan([manifest], dir)

    expect(result.configs[0].state).toBe('matching')
  })

  it('should report a differing config as drifted', () => {
    const manifest = makeManifest('base')
    const dir = target()
    seedFile(join(manifest.configsDir, '.editorconfig'), 'root = true\n')
    seedFile(join(dir, '.editorconfig'), 'root = false\n')

    const result = scan([manifest], dir)

    expect(result.configs[0].state).toBe('drifted')
  })

  it('should see dotfiles when comparing configs', () => {
    const manifest = makeManifest('base')
    seedFile(join(manifest.configsDir, '.husky', 'pre-commit'), 'echo hi\n')

    const result = scan([manifest], target())

    expect(result.configs.map((entry) => entry.rel)).toEqual([
      '.husky/pre-commit',
    ])
  })

  it('should let the nearest stack own a config both stacks ship', () => {
    const child = makeManifest('web')
    const parent = makeManifest('base')
    seedFile(join(child.configsDir, 'shared.json'), '{}\n')
    seedFile(join(parent.configsDir, 'shared.json'), '{"a":1}\n')

    const result = scan([child, parent], target())

    expect(result.configs).toEqual([
      { rel: 'shared.json', stack: 'web', state: 'new' },
    ])
  })

  it('should not report the same gitignore entry twice across stacks', () => {
    const child = makeManifest('web', {
      gitignore: [{ header: '# Build', entries: ['dist/'] }],
    })
    const parent = makeManifest('base', {
      gitignore: [{ header: '# Build', entries: ['dist/'] }],
    })

    const result = scan([child, parent], target())

    expect(result.gitignore).toEqual([{ entry: 'dist/', state: 'missing' }])
  })

  it('should report a gitignore entry already in the file as present', () => {
    const dir = target()
    writeFileSync(join(dir, '.gitignore'), '# Build\ndist/\n')
    const manifest = makeManifest('base', {
      gitignore: [{ header: '# Build', entries: ['dist/'] }],
    })

    const result = scan([manifest], dir)

    expect(result.gitignore).toEqual([{ entry: 'dist/', state: 'present' }])
  })

  it('should scan scripts and deps against an empty manifest when the target has no package.json', () => {
    const manifest = makeManifest('base', {
      scripts: { check: './verify.sh' },
      devPackages: ['prettier'],
    })

    const result = scan([manifest], target())

    expect(result.hasPackageJson).toBe(false)
    expect(result.newManifest).toBe(true)
    expect(result.scripts).toEqual([{ key: 'check', state: 'missing' }])
    expect(result.deps).toEqual([
      { spec: 'prettier', name: 'prettier', state: 'missing' },
    ])
  })

  it('should count a dependency on a later major as no change', () => {
    const manifest = makeManifest('base', { devPackages: ['typescript@^6'] })
    const dir = target()
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { typescript: '^7.0.0' } }),
    )

    const result = scan([manifest], dir)

    expect(result.deps.map((dep) => dep.state)).toEqual(['ahead'])
    expect(result.totalChanges).toBe(0)
  })

  it('should count the new manifest once in the total', () => {
    const manifest = makeManifest('base', {
      scripts: { check: './verify.sh' },
      devPackages: ['prettier'],
    })

    const result = scan([manifest], target())

    expect(result.totalChanges).toBe(3)
  })

  it('should report no new manifest when the chain installs nothing', () => {
    const result = scan([makeManifest('base')], target())

    expect(result.newManifest).toBe(false)
    expect(result.totalChanges).toBe(0)
  })

  it('should report no new manifest when package.json exists', () => {
    const dir = target()
    writeFileSync(join(dir, 'package.json'), '{}\n')
    const manifest = makeManifest('base', { scripts: { check: 'x' } })

    const result = scan([manifest], dir)

    expect(result.newManifest).toBe(false)
    expect(result.hasPackageJson).toBe(true)
  })

  it('should report no new manifest over an invalid package.json', () => {
    const dir = target()
    writeFileSync(join(dir, 'package.json'), '{ not json')
    const manifest = makeManifest('base', { scripts: { check: 'x' } })

    const result = scan([manifest], dir)

    expect(result.newManifest).toBe(false)
    expect(result.scripts).toEqual([])
  })

  it('should count every pending change once in the total', () => {
    const dir = target()
    writeFileSync(join(dir, 'package.json'), '{}\n')
    const manifest = makeManifest('base', {
      scripts: { check: './verify.sh' },
      devPackages: ['prettier'],
      gitignore: [{ header: '# Build', entries: ['dist/'] }],
    })
    seedFile(join(manifest.configsDir, '.editorconfig'), 'root = true\n')
    seedFile(join(manifest.seedsDir, 'seed.json'), '{}\n')

    const result = scan([manifest], dir)

    expect(result.totalChanges).toBe(5)
  })

  it('should count a stale override script toward the total', () => {
    const dir = target()
    writeFileSync(
      join(dir, 'package.json'),
      '{"scripts":{"format":"prettier --write ."}}\n',
    )
    const manifest = makeManifest('base', {
      scriptOverrides: { format: 'oxfmt .' },
    })

    const result = scan([manifest], dir)

    expect(result.scripts).toEqual([{ key: 'format', state: 'drifted' }])
    expect(result.totalChanges).toBe(1)
  })

  it('should report a path shipped as a config and a seed once, as a config', () => {
    const child = makeManifest('web')
    const parent = makeManifest('base')
    seedFile(join(child.configsDir, 'shared.yml'), 'on: push\n')
    seedFile(join(parent.seedsDir, 'shared.yml'), 'on: pull_request\n')

    const result = scan([child, parent], target())

    expect(result.seeds).toEqual([])
    expect(result.totalChanges).toBe(1)
  })

  it('should report nothing to do when the target already matches', () => {
    const dir = target()
    const manifest = makeManifest('base')
    seedFile(join(manifest.configsDir, '.editorconfig'), 'root = true\n')
    seedFile(join(dir, '.editorconfig'), 'root = true\n')

    const result = scan([manifest], dir)

    expect(result.totalChanges).toBe(0)
  })
})

describe('scan with a restricted manifest', () => {
  function restrictedBase(): Manifest {
    const manifest = makeManifest('base', {
      onlyConfigs: ['scripts/verify.sh'],
    })
    seedFile(join(manifest.configsDir, 'scripts/verify.sh'), 'exec bun\n')
    seedFile(join(manifest.configsDir, '.prettierrc'), '{}\n')
    seedFile(join(manifest.seedsDir, 'notes/tech-stack.txt'), 'bun\n')
    return manifest
  }

  it('should report only the configs it is restricted to', () => {
    const result = scan([restrictedBase()], target())

    expect(result.configs.map((entry) => entry.rel)).toEqual([
      'scripts/verify.sh',
    ])
  })

  it('should report none of its seeds', () => {
    const result = scan([restrictedBase()], target())

    expect(result.seeds).toEqual([])
  })
})

describe('scan in a subfolder', () => {
  const WORKFLOW = '.github/workflows/verify.yml'

  function repoWithSubfolder(): string {
    const repo = join(root, 'repo')
    mkdirSync(repo, { recursive: true })
    spawnSync('git', ['init', '-q', repo], { env: gitEnv() })
    const sub = join(repo, 'web')
    mkdirSync(sub)
    return sub
  }

  function webManifest(): Manifest {
    const manifest = makeManifest('web')
    seedFile(join(manifest.configsDir, WORKFLOW), 'on: push\n')
    seedFile(join(manifest.configsDir, '.editorconfig'), 'root = true\n')
    seedFile(join(manifest.seedsDir, 'notes/tech-stack.txt'), 'vite\n')
    return manifest
  }

  it('should move a .github path out of configs', () => {
    const result = scan([webManifest()], repoWithSubfolder())

    expect(result.configs.map((entry) => entry.rel)).toEqual(['.editorconfig'])
  })

  it('should report the moved path as withheld', () => {
    const result = scan([webManifest()], repoWithSubfolder())

    expect(result.withheld).toEqual([
      { rel: WORKFLOW, stack: 'web', present: false },
    ])
  })

  it('should mark a withheld copy an earlier sync left as present', () => {
    const sub = repoWithSubfolder()
    seedFile(join(sub, WORKFLOW), 'on: push\n')

    const result = scan([webManifest()], sub)

    expect(result.withheld[0]?.present).toBe(true)
  })

  it('should keep withheld paths out of the total', () => {
    const result = scan([webManifest()], repoWithSubfolder())

    expect(result.totalChanges).toBe(2)
  })

  it('should report a .github seed as withheld rather than as a missing seed', () => {
    const manifest = makeManifest('base')
    seedFile(join(manifest.seedsDir, WORKFLOW), 'on: push\n')

    const result = scan([manifest], repoWithSubfolder())

    expect(result.seeds).toEqual([])
    expect(result.withheld).toEqual([
      { rel: WORKFLOW, stack: 'base', present: false },
    ])
  })

  it('should report a seed shadowed by a withheld config once', () => {
    const base = makeManifest('base')
    seedFile(join(base.seedsDir, WORKFLOW), 'on: pull_request\n')

    const result = scan([webManifest(), base], repoWithSubfolder())

    expect(result.withheld).toEqual([
      { rel: WORKFLOW, stack: 'web', present: false },
    ])
  })

  it('should keep .github in configs at a root', () => {
    const result = scan([webManifest()], target())

    expect(result.configs.map((entry) => entry.rel)).toContain(WORKFLOW)
  })

  it('should report nothing withheld at a root', () => {
    const result = scan([webManifest()], target())

    expect(result.withheld).toEqual([])
  })
})

describe('scan cause on a drifted config', () => {
  function recorded(dir: string, files: Record<string, string>): void {
    seedFile(
      stampPath(dir),
      JSON.stringify({
        covers: ['tooling'],
        domains: { tooling: { syncedAt: 'then', files, chain: ['base'] } },
      }),
    )
  }

  function drifted(dir: string): ReturnType<typeof scan>['configs'][number] {
    const manifest = makeManifest('base')
    seedFile(join(manifest.configsDir, '.editorconfig'), 'root = true\n')
    return scan([manifest], dir).configs[0]
  }

  it('should read a copy still at the recorded hash as stale', () => {
    const dir = target()
    seedFile(join(dir, '.editorconfig'), 'older golden\n')
    recorded(dir, { '.editorconfig': hashContent('older golden\n') })

    expect(drifted(dir)).toMatchObject({ state: 'drifted', cause: 'stale' })
  })

  it('should read a copy off the recorded hash as edited', () => {
    const dir = target()
    seedFile(join(dir, '.editorconfig'), 'mine\n')
    recorded(dir, { '.editorconfig': hashContent('older golden\n') })

    expect(drifted(dir)).toMatchObject({ state: 'drifted', cause: 'edited' })
  })

  it('should read a copy with no recorded hash as unattributed', () => {
    const dir = target()
    seedFile(join(dir, '.editorconfig'), 'mine\n')

    expect(drifted(dir)).toMatchObject({
      state: 'drifted',
      cause: 'unattributed',
    })
  })

  it('should give a matching config no cause', () => {
    const dir = target()
    seedFile(join(dir, '.editorconfig'), 'root = true\n')

    expect(drifted(dir)).not.toHaveProperty('cause')
  })
})

describe('scan with dispositions', () => {
  const WORKFLOW = '.github/workflows/ci.yml'

  function hold(dir: string, dispositions: Record<string, unknown>): void {
    seedFile(
      stampPath(dir),
      JSON.stringify({
        covers: ['tooling'],
        domains: {
          tooling: {
            syncedAt: 'then',
            files: {},
            chain: ['web'],
            dispositions,
          },
        },
      }),
    )
  }

  function webManifest(): Manifest {
    const manifest = makeManifest('web')
    seedFile(join(manifest.configsDir, WORKFLOW), 'on: push\n')
    seedFile(join(manifest.configsDir, '.editorconfig'), 'root = true\n')
    seedFile(join(manifest.seedsDir, 'notes/stack.md'), 'vite\n')
    return manifest
  }

  it('should move a declined config the target deleted out of configs', () => {
    const dir = target()
    hold(dir, { [WORKFLOW]: { disposition: 'declined' } })

    const result = scan([webManifest()], dir)

    expect(result.configs.map((entry) => entry.rel)).toEqual(['.editorconfig'])
    expect(result.dispositions).toEqual([
      {
        rel: WORKFLOW,
        stack: 'web',
        kind: 'config',
        disposition: 'declined',
        present: false,
      },
    ])
  })

  it('should keep a declined config out of the total', () => {
    const dir = target()
    hold(dir, { [WORKFLOW]: { disposition: 'declined' } })

    expect(scan([webManifest()], dir).totalChanges).toBe(2)
  })

  it('should list a declined config the project still holds as present', () => {
    const dir = target()
    seedFile(join(dir, WORKFLOW), 'on: pull_request\n')
    hold(dir, { [WORKFLOW]: { disposition: 'declined' } })

    expect(scan([webManifest()], dir).dispositions[0]?.present).toBe(true)
  })

  it('should move a declined seed out of seeds', () => {
    const dir = target()
    hold(dir, { 'notes/stack.md': { disposition: 'declined' } })

    const result = scan([webManifest()], dir)

    expect(result.seeds).toEqual([])
    expect(result.dispositions[0]).toMatchObject({
      rel: 'notes/stack.md',
      kind: 'seed',
      present: false,
    })
  })

  it('should not count a customized config whose golden is unchanged', () => {
    const dir = target()
    seedFile(join(dir, WORKFLOW), 'on: [push, pull_request]\n')
    hold(dir, {
      [WORKFLOW]: {
        disposition: 'customized',
        base: hashContent('on: push\n'),
      },
    })

    const result = scan([webManifest()], dir)

    expect(result.dispositions[0]).toMatchObject({
      disposition: 'customized',
      moved: false,
    })
    expect(result.totalChanges).toBe(2)
  })

  it('should mark and count a customized config whose golden moved', () => {
    const dir = target()
    seedFile(join(dir, WORKFLOW), 'on: [push, pull_request]\n')
    hold(dir, {
      [WORKFLOW]: { disposition: 'customized', base: hashContent('older\n') },
    })

    const result = scan([webManifest()], dir)

    expect(result.dispositions[0]?.moved).toBe(true)
    expect(result.totalChanges).toBe(3)
  })

  it('should list a declined .github path in a subfolder once, as declined', () => {
    const repo = join(root, 'repo')
    mkdirSync(repo, { recursive: true })
    spawnSync('git', ['init', '-q', repo], { env: gitEnv() })
    const sub = join(repo, 'web')
    mkdirSync(sub)
    hold(sub, { [WORKFLOW]: { disposition: 'declined' } })

    const result = scan([webManifest()], sub)

    expect(result.withheld).toEqual([])
    expect(result.dispositions.map((entry) => entry.rel)).toEqual([WORKFLOW])
  })

  it('should list nothing held when the target has no stamp', () => {
    expect(scan([webManifest()], target()).dispositions).toEqual([])
  })
})
