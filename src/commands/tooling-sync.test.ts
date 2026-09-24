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
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stampPath } from '@/sync/stamp'

const CLI = join(import.meta.dirname, '../cli.ts')
const GOLDEN = '.editorconfig'
const LOCAL_EDIT = '# a project owns this line\n'

interface Run {
  readonly status: null | number
  readonly stderr: string
  readonly stdout?: string
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

const runVerb = (
  verb: 'diff' | 'sync',
  args: readonly string[],
  headless = true,
): Run => {
  const run = spawnSync(
    'bun',
    [CLI, 'tooling', verb, 'base', target, ...args],
    {
      encoding: 'utf8',
      env: buildEnv(headless ? { CANON_NON_INTERACTIVE: '1' } : {}),
    },
  )

  return { status: run.status, stderr: run.stderr, stdout: run.stdout }
}

const sync = (args: readonly string[], headless = true): Run =>
  runVerb('sync', args, headless)

const diff = (args: readonly string[]): Run => runVerb('diff', args)

const diffStack = (stack: string, args: readonly string[] = []): Run => {
  const run = spawnSync(
    'bun',
    [CLI, 'tooling', 'diff', stack, target, ...args],
    { encoding: 'utf8', env: buildEnv({ CANON_NON_INTERACTIVE: '1' }) },
  )

  return { status: run.status, stderr: run.stderr, stdout: run.stdout }
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

describe('tooling diff', () => {
  it('should exit 1 when a file differs, matching the headless gate', () => {
    expect(diff([]).status).toBe(1)
  })

  it('should exit 0 once the target matches the stack', () => {
    sync(['--write'])

    expect(diff([]).status).toBe(0)
  })

  it('should leave a local edit in place', () => {
    diff([])

    expect(goldenContent()).toBe(LOCAL_EDIT)
  })

  it('should write no install stamp', () => {
    diff([])

    expect(() => readFileSync(stampPath(target))).toThrow()
  })

  it('should name the drifted path on stderr', () => {
    expect(diff([]).stderr).toContain(GOLDEN)
  })

  it('should refuse a run passing --check, which sync alone carries', () => {
    expect(diff(['--check']).status).not.toBe(0)
  })

  it('should emit a record on stdout under --json that parses clean', () => {
    const record = JSON.parse(diff(['--json']).stdout ?? '') as {
      configs: { rel: string; state: string }[]
    }

    expect(record.configs).toContainEqual(
      expect.objectContaining({ rel: GOLDEN, state: 'drifted' }),
    )
  })

  it('should carry ok true on the record when the run measured', () => {
    const record = JSON.parse(diff(['--json']).stdout ?? '') as { ok: boolean }

    expect(record.ok).toBe(true)
  })

  it('should emit an unknown-stack reason under --json for a bad stack name', () => {
    const record = JSON.parse(
      diffStack('no-such-stack', ['--json']).stdout ?? '',
    ) as { ok: boolean; reason: string }

    expect(record).toMatchObject({ ok: false, reason: 'unknown-stack' })
  })

  it('should emit an excluded-stack reason under --json for the claude stack', () => {
    const record = JSON.parse(diffStack('claude', ['--json']).stdout ?? '') as {
      reason: string
    }

    expect(record.reason).toBe('excluded-stack')
  })

  it('should keep exit 1 on a refusal under --json', () => {
    expect(diffStack('no-such-stack', ['--json']).status).toBe(1)
  })

  it('should still exit 1 under --json when a file differs', () => {
    expect(diff(['--json']).status).toBe(1)
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

describe('tooling sync into a subfolder', () => {
  const WORKFLOW = '.github/workflows/verify.yml'
  let repo: string
  let stateDir: string
  let web: string

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'tooling-sync-mono-'))
    stateDir = mkdtempSync(join(tmpdir(), 'tooling-sync-state-'))
    spawnSync('git', ['init', '-q', repo], { env: buildEnv() })
    web = join(repo, 'web')
    mkdirSync(web)
  })

  afterEach(() => {
    rmSync(repo, { force: true, recursive: true })
    rmSync(stateDir, { force: true, recursive: true })
  })

  const runSubfolder = (
    verb: 'diff' | 'sync',
    args: readonly string[],
  ): Run => {
    const run = spawnSync(
      'bun',
      [CLI, 'tooling', verb, 'vite-react', web, '--skip', 'base', ...args],
      {
        encoding: 'utf8',
        env: buildEnv({
          CANON_NON_INTERACTIVE: '1',
          CANON_STATE_DIR: stateDir,
        }),
      },
    )

    return { status: run.status, stderr: run.stderr, stdout: run.stdout }
  }

  it('should write no .github folder into the subfolder', () => {
    runSubfolder('sync', ['--write'])

    expect(existsSync(join(web, '.github'))).toBe(false)
  })

  it('should name the withheld workflow on stderr', () => {
    expect(runSubfolder('sync', ['--write']).stderr).toContain(WORKFLOW)
  })

  it('should give the path a root job runs the subfolder from', () => {
    expect(runSubfolder('sync', ['--write']).stderr).toContain(
      'working-directory: web',
    )
  })

  it('should write the nested spell config', () => {
    runSubfolder('sync', ['--write'])

    expect(existsSync(join(web, 'cspell.json'))).toBe(true)
  })

  it('should still end on the success line with no package.json', () => {
    expect(runSubfolder('sync', ['--write']).stderr).toContain(
      'Tooling sync complete',
    )
  })

  it('should report the withheld paths under diff --json', () => {
    runSubfolder('sync', ['--write'])

    const record = JSON.parse(
      runSubfolder('diff', ['--json']).stdout ?? '',
    ) as { withheld: { rel: string }[] }

    expect(record.withheld).toContainEqual(
      expect.objectContaining({ rel: WORKFLOW }),
    )
  })

  it('should exit 0 from diff once the subfolder is synced', () => {
    runSubfolder('sync', ['--write'])

    expect(runSubfolder('diff', ['--json']).status).toBe(0)
  })
})
