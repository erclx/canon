import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readStamp, stampedChain } from '@/sync/stamp'
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
      [manifest('vite-react'), manifest('base')],
      NOW,
    )

    expect(recorded).toBe(true)
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

    expect(recorded).toBe(false)
    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should leave out a skipped stack kept for its per-root configs', async () => {
    const kept = { ...manifest('base'), onlyConfigs: ['scripts/verify.sh'] }

    await recordToolingChain('/nowhere', TARGET, [manifest('web'), kept], NOW)

    expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual(['web'])
  })
})
