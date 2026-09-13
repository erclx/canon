import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stampPath } from '@/sync/stamp'

const CLI = join(import.meta.dirname, '../cli.ts')
const GOLDEN = '.editorconfig'
const LOCAL_EDIT = '# a project owns this line\n'

interface Run {
  readonly status: null | number
  readonly stderr: string
}

let target: string

// A git hook exports GIT_DIR, so a run under pre-push would resolve the fixture
// against the toolkit's own repository rather than the temp directory.
const buildEnv = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  ),
  ...extra,
})

const sync = (args: readonly string[], headless = true): Run => {
  const run = spawnSync(
    'bun',
    [CLI, 'tooling', 'sync', 'base', target, ...args],
    {
      encoding: 'utf8',
      env: buildEnv(headless ? { CANON_NON_INTERACTIVE: '1' } : {}),
    },
  )

  return { status: run.status, stderr: run.stderr }
}

const goldenContent = (): string => readFileSync(join(target, GOLDEN), 'utf8')

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'tooling-sync-'))
  writeFileSync(join(target, GOLDEN), LOCAL_EDIT)
})

afterEach(() => {
  rmSync(target, { force: true, recursive: true })
})

describe('tooling sync write authorization', () => {
  it('should leave a local edit in place when no write flag is passed', () => {
    sync([])

    expect(goldenContent()).toBe(LOCAL_EDIT)
  })

  it('should exit 1 when a headless run is asked to sync without --write', () => {
    expect(sync([]).status).toBe(1)
  })

  it('should name the flag that would have applied the changes', () => {
    expect(sync([]).stderr).toContain('--write')
  })

  it('should report the paths it would replace before refusing', () => {
    expect(sync([]).stderr).toContain(GOLDEN)
  })

  it('should replace the same local edit once --write is passed', () => {
    sync(['--write'])

    expect(goldenContent()).not.toBe(LOCAL_EDIT)
  })

  it('should exit 0 after applying with --write', () => {
    expect(sync(['--write']).status).toBe(0)
  })

  it('should leave a local edit in place under --check', () => {
    sync(['--check'])

    expect(goldenContent()).toBe(LOCAL_EDIT)
  })

  it('should exit 0 under --check, since a report is not a failed sync', () => {
    expect(sync(['--check']).status).toBe(0)
  })

  it('should refuse a run passing both --check and --write', () => {
    expect(sync(['--check', '--write']).status).toBe(1)
  })

  it('should write no install stamp under --check', () => {
    sync(['--check'])

    expect(() => readFileSync(stampPath(target))).toThrow()
  })

  it('should write no install stamp when an up-to-date target is synced without --write', () => {
    sync(['--write'])
    rmSync(stampPath(target))

    sync([])

    expect(() => readFileSync(stampPath(target))).toThrow()
  })
})

describe('tooling sync checkout-mismatch warning', () => {
  let decoy: string

  beforeEach(() => {
    decoy = mkdtempSync(join(tmpdir(), 'tooling-sync-decoy-'))
    writeFileSync(
      join(decoy, 'package.json'),
      JSON.stringify({ name: '@erclx/canon' }),
    )
  })

  afterEach(() => {
    rmSync(decoy, { force: true, recursive: true })
  })

  const syncFrom = (cwd: string): Run => {
    const run = spawnSync(
      'bun',
      [CLI, 'tooling', 'sync', 'base', target, '--check'],
      { cwd, encoding: 'utf8', env: buildEnv({ CANON_NON_INTERACTIVE: '1' }) },
    )

    return { status: run.status, stderr: run.stderr }
  }

  it('should warn on stderr when cwd sits inside a second canon checkout', () => {
    expect(syncFrom(decoy).stderr).toContain(decoy)
  })

  it('should warn nothing from an ordinary target-style cwd', () => {
    expect(syncFrom(target).stderr).not.toContain('checkout')
  })
})
