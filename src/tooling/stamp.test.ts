import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  hashContent,
  readStamp,
  stampedChain,
  stampedHashes,
} from '@/sync/stamp'
import type { Manifest } from '@/tooling/manifest'
import { isWorkspaceRoot, recordToolingChain } from '@/tooling/stamp'

let TARGET: string

const NOW = new Date('2026-08-05T12:00:00.000Z')

/** Only `name` is read, so the rest stands in rather than pointing at real dirs. */
function manifest(name: string): Manifest {
  return {
    name,
    dir: `/nowhere/${name}`,
    configsDir: `/nowhere/${name}/configs`,
    seedsDir: `/nowhere/${name}/seeds`,
    scripts: {},
    scriptOverrides: {},
    gitignore: [],
    devPackages: [],
  }
}

function writePackage(fields: Record<string, unknown>): void {
  writeFileSync(join(TARGET, 'package.json'), JSON.stringify(fields))
}

beforeEach(() => {
  TARGET = mkdtempSync(join(tmpdir(), 'canon-tooling-stamp-'))
})

afterEach(() => {
  rmSync(TARGET, { recursive: true, force: true })
})

describe('isWorkspaceRoot', () => {
  it('should report false for a target with no package.json', () => {
    expect(isWorkspaceRoot(TARGET)).toBe(false)
  })

  it('should report false for a package.json without workspaces', () => {
    writePackage({ name: 'app' })

    expect(isWorkspaceRoot(TARGET)).toBe(false)
  })

  it('should report true for an array of workspace globs', () => {
    writePackage({ name: 'root', workspaces: ['packages/*'] })

    expect(isWorkspaceRoot(TARGET)).toBe(true)
  })

  it('should report true for the object form yarn accepts', () => {
    writePackage({ name: 'root', workspaces: { packages: ['packages/*'] } })

    expect(isWorkspaceRoot(TARGET)).toBe(true)
  })

  it('should report true when pnpm declares the workspace in its own file', () => {
    writeFileSync(
      join(TARGET, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n",
    )

    expect(isWorkspaceRoot(TARGET)).toBe(true)
  })
})

describe('recordToolingChain', () => {
  it('should record the stack names in chain order', async () => {
    const recorded = await recordToolingChain(
      '/nowhere',
      TARGET,
      [{ ...manifest('vite-react'), parent: 'base' }, manifest('base')],
      NOW,
    )

    expect(recorded).toEqual(['vite-react', 'base'])
    expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual([
      'vite-react',
      'base',
    ])
  })

  it('should record nothing for a workspace root', async () => {
    writePackage({ name: 'root', workspaces: ['packages/*'] })

    const recorded = await recordToolingChain(
      '/nowhere',
      TARGET,
      [manifest('base')],
      NOW,
    )

    expect(recorded).toBeUndefined()
    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should leave out a skipped stack kept for its per-root configs', async () => {
    const kept = { ...manifest('base'), onlyConfigs: ['scripts/verify.sh'] }

    await recordToolingChain('/nowhere', TARGET, [manifest('web'), kept], NOW)

    expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual(['web'])
  })

  describe('with an add-on stack', () => {
    let TOOLKIT: string

    /** Writes the manifest `loadManifest` reads for a stack the stamp already holds. */
    function stack(name: string, extendsName = ''): Manifest {
      const dir = join(TOOLKIT, 'tooling', name)
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        join(dir, 'manifest.toml'),
        `[stack]\nname = "${name}"\nextends = "${extendsName}"\n`,
      )
      return {
        ...manifest(name),
        ...(extendsName === '' ? {} : { parent: extendsName }),
      }
    }

    beforeEach(() => {
      TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-tooling-toolkit-'))
    })

    afterEach(() => {
      rmSync(TOOLKIT, { recursive: true, force: true })
    })

    it('should keep the recorded chain when an add-on syncs after it', async () => {
      const chain = [
        stack('vite-react', 'web'),
        stack('web', 'base'),
        stack('base'),
      ]
      await recordToolingChain(TOOLKIT, TARGET, chain, NOW)

      await recordToolingChain(TOOLKIT, TARGET, [stack('public')], NOW)

      expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual([
        'vite-react',
        'web',
        'base',
        'public',
      ])
    })

    it('should keep the add-on when a stack syncs after it', async () => {
      await recordToolingChain(TOOLKIT, TARGET, [stack('public')], NOW)

      await recordToolingChain(
        TOOLKIT,
        TARGET,
        [stack('web', 'base'), stack('base')],
        NOW,
      )

      expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual([
        'web',
        'base',
        'public',
      ])
    })

    it('should return the merged chain it wrote', async () => {
      await recordToolingChain(
        TOOLKIT,
        TARGET,
        [stack('web', 'base'), stack('base')],
        NOW,
      )

      const recorded = await recordToolingChain(
        TOOLKIT,
        TARGET,
        [stack('public')],
        NOW,
      )

      expect(recorded).toEqual(['web', 'base', 'public'])
    })

    it('should record two add-ons side by side', async () => {
      await recordToolingChain(TOOLKIT, TARGET, [stack('shell')], NOW)

      await recordToolingChain(TOOLKIT, TARGET, [stack('public')], NOW)

      expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual([
        'shell',
        'public',
      ])
    })

    it('should not record an add-on twice on a repeat sync', async () => {
      await recordToolingChain(TOOLKIT, TARGET, [stack('public')], NOW)

      await recordToolingChain(TOOLKIT, TARGET, [stack('public')], NOW)

      expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual(['public'])
    })

    it('should replace the core chain when a different stack syncs', async () => {
      await recordToolingChain(
        TOOLKIT,
        TARGET,
        [stack('vite-react', 'base'), stack('base')],
        NOW,
      )

      await recordToolingChain(
        TOOLKIT,
        TARGET,
        [stack('astro', 'base'), stack('base')],
        NOW,
      )

      expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual([
        'astro',
        'base',
      ])
    })
  })

  describe('file hashes', () => {
    let TOOLKIT: string

    function shipping(name: string, files: Record<string, string>): Manifest {
      const configsDir = join(TOOLKIT, name, 'configs')
      for (const [rel, body] of Object.entries(files)) {
        mkdirSync(dirname(join(configsDir, rel)), { recursive: true })
        writeFileSync(join(configsDir, rel), body)
      }
      return { ...manifest(name), configsDir }
    }

    function hashes(): Record<string, string> {
      return { ...stampedHashes(readStamp(TARGET), 'tooling') }
    }

    beforeEach(() => {
      TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-tooling-hashes-'))
    })

    afterEach(() => {
      rmSync(TOOLKIT, { recursive: true, force: true })
    })

    it('should record the golden hash of a config the target matches', async () => {
      const base = shipping('base', { 'a.json': 'golden\n' })
      writeFileSync(join(TARGET, 'a.json'), 'golden\n')

      await recordToolingChain(TOOLKIT, TARGET, [base], NOW)

      expect(hashes()).toEqual({ 'a.json': hashContent('golden\n') })
    })

    it('should record no hash for a config the target edited and never matched', async () => {
      const base = shipping('base', { 'a.json': 'golden\n' })
      writeFileSync(join(TARGET, 'a.json'), 'mine\n')

      await recordToolingChain(TOOLKIT, TARGET, [base], NOW)

      expect(hashes()).toEqual({})
    })

    it('should keep the previous hash of a config held this run', async () => {
      writeFileSync(join(TARGET, 'a.json'), 'golden\n')
      await recordToolingChain(
        TOOLKIT,
        TARGET,
        [shipping('base', { 'a.json': 'golden\n' })],
        NOW,
      )
      writeFileSync(join(TARGET, 'a.json'), 'mine\n')

      await recordToolingChain(
        TOOLKIT,
        TARGET,
        [shipping('base', { 'a.json': 'newer golden\n' })],
        NOW,
      )

      expect(hashes()).toEqual({ 'a.json': hashContent('golden\n') })
    })

    it('should record the nearest stack copy a shadowed config matches', async () => {
      const web = shipping('web', { 'a.json': 'web\n' })
      const base = shipping('base', { 'a.json': 'base\n' })
      writeFileSync(join(TARGET, 'a.json'), 'web\n')

      await recordToolingChain(TOOLKIT, TARGET, [web, base], NOW)

      expect(hashes()).toEqual({ 'a.json': hashContent('web\n') })
    })
  })
})
