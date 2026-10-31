import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  backfillTarget,
  isScratchPath,
  readTargetRegistry,
  recordTarget,
  registryPath,
  scratchRoots,
  stateDir,
} from '@/targets/registry'

let ROOT: string
let FILE: string

/**
 * `vitest.setup.ts` points this at a temp folder for the whole file, so a test
 * calling either read with no path stays out of the developer's real state
 * folder. Restoring it is what keeps that true: deleting the key instead would
 * leave the rest of the file resolving to the home directory.
 */
const SETUP_STATE_DIR = process.env.CANON_STATE_DIR

/**
 * Every fixture folder sits under the OS temp folder, which is itself a scratch
 * root. Passing no roots is what lets a case about replacing or keeping rows
 * record a real folder at all, and a case about refusal names its own roots.
 */
const NO_ROOTS: readonly string[] = []

/** A real project folder under the fixture root, since a gone path is pruned. */
function project(name: string): string {
  const path = join(ROOT, 'repos', name)
  mkdirSync(path, { recursive: true })
  return path
}

function scratchRun(): { scratch: string; run: string } {
  const scratch = join(ROOT, 'scratch')
  const run = join(scratch, 'run-1')
  mkdirSync(run, { recursive: true })
  return { scratch, run }
}

function paths(registry: ReturnType<typeof readTargetRegistry>): string[] {
  return registry.kind === 'read' ? registry.targets.map((row) => row.path) : []
}

function storedPaths(): string[] {
  const stored = JSON.parse(readFileSync(FILE, 'utf8')) as {
    targets: { path: string }[]
  }
  return stored.targets.map((row) => row.path)
}

function writeRows(rows: readonly object[]): void {
  writeFileSync(FILE, JSON.stringify({ version: 1, targets: rows }))
}

const STAMPED = '2026-08-30T00:00:00.000Z'

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-targets-'))
  FILE = join(ROOT, 'targets.json')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  process.env.CANON_STATE_DIR = SETUP_STATE_DIR
  delete process.env.XDG_STATE_HOME
})

describe('stateDir', () => {
  it('should prefer the explicit override over every other source', () => {
    process.env.CANON_STATE_DIR = '/explicit'
    process.env.XDG_STATE_HOME = '/xdg'

    expect(stateDir()).toBe('/explicit')
  })

  it('should fall back to the XDG state home when no override is set', () => {
    delete process.env.CANON_STATE_DIR
    process.env.XDG_STATE_HOME = '/xdg'

    expect(registryPath()).toBe(join('/xdg', 'canon', 'targets.json'))
  })

  it('should honor the retired override, which an existing operator exported', () => {
    delete process.env.CANON_STATE_DIR
    process.env.AITK_STATE_DIR = '/retired'

    expect(stateDir()).toBe('/retired')
    delete process.env.AITK_STATE_DIR
  })
})

describe('registryPath', () => {
  it('should resolve the retired folder when only it holds a registry', () => {
    const home = mkdtempSync(join(tmpdir(), 'canon-state-'))
    delete process.env.CANON_STATE_DIR
    delete process.env.AITK_STATE_DIR
    process.env.XDG_STATE_HOME = home

    const retired = join(home, 'aitk', 'targets.json')
    mkdirSync(dirname(retired), { recursive: true })
    writeFileSync(retired, JSON.stringify({ version: 1, targets: [] }))

    expect(registryPath()).toBe(retired)
    rmSync(home, { recursive: true, force: true })
  })

  it('should prefer the current folder when both hold a registry', () => {
    const home = mkdtempSync(join(tmpdir(), 'canon-state-'))
    delete process.env.CANON_STATE_DIR
    delete process.env.AITK_STATE_DIR
    process.env.XDG_STATE_HOME = home

    for (const folder of ['aitk', 'canon']) {
      const path = join(home, folder, 'targets.json')
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify({ version: 1, targets: [] }))
    }

    expect(registryPath()).toBe(join(home, 'canon', 'targets.json'))
    rmSync(home, { recursive: true, force: true })
  })
})

describe('readTargetRegistry', () => {
  // A machine no sync has ever run on and a machine whose targets were all
  // removed answer differently. Reading the first as an empty population would
  // report a confident zero from a lookup that never ran, which is the reading
  // the sweep exists to stand in for.
  it('should report an absent file as absent rather than as no targets', () => {
    const registry = readTargetRegistry(FILE, NO_ROOTS)

    expect(registry).toEqual({ kind: 'absent', path: FILE })
  })

  it('should report a file it cannot parse as read and holding no row', () => {
    writeFileSync(FILE, 'not json at all\n')

    expect(readTargetRegistry(FILE, NO_ROOTS)).toEqual({
      kind: 'read',
      path: FILE,
      targets: [],
    })
  })

  it('should drop a row missing either field and keep the rows around it', () => {
    const caret = project('caret')
    writeRows([
      { path: caret, stampedAt: STAMPED },
      { path: project('stackr') },
      { stampedAt: STAMPED },
    ])

    const registry = readTargetRegistry(FILE, NO_ROOTS)

    expect(registry.kind === 'read' ? registry.targets : []).toEqual([
      { path: caret, stampedAt: STAMPED },
    ])
  })

  it('should sort the rows by path so two reads of one file agree', () => {
    const zeta = project('zeta')
    const alpha = project('alpha')
    writeRows([
      { path: zeta, stampedAt: STAMPED },
      { path: alpha, stampedAt: STAMPED },
    ])

    expect(paths(readTargetRegistry(FILE, NO_ROOTS))).toEqual([alpha, zeta])
  })

  // A file written before the prune existed holds thousands of dead rows, and
  // the list has to be right on that machine before any sync rewrites it.
  it('should leave out a row whose folder no longer exists', () => {
    const caret = project('caret')
    writeRows([
      { path: caret, stampedAt: STAMPED },
      { path: join(ROOT, 'gone'), stampedAt: STAMPED },
    ])

    expect(paths(readTargetRegistry(FILE, NO_ROOTS))).toEqual([caret])
  })

  it('should leave out a row under a scratch root even when it still exists', () => {
    const caret = project('caret')
    const { scratch, run } = scratchRun()
    writeRows([
      { path: caret, stampedAt: STAMPED },
      { path: run, stampedAt: STAMPED },
    ])

    expect(paths(readTargetRegistry(FILE, [scratch]))).toEqual([caret])
  })
})

describe('isScratchPath', () => {
  it('should refuse a path under a named root', () => {
    expect(isScratchPath(join(ROOT, 'run', 'repo'), [ROOT])).toBe(true)
  })

  it('should refuse the root itself', () => {
    expect(isScratchPath(ROOT, [ROOT])).toBe(true)
  })

  it('should keep a sibling whose name only starts with the root', () => {
    expect(isScratchPath(`${ROOT}-sibling`, [ROOT])).toBe(false)
  })

  it('should refuse a path inside a .canon/tmp folder whatever the roots', () => {
    expect(
      isScratchPath(join(ROOT, 'repo', '.canon', 'tmp', 'fixture'), NO_ROOTS),
    ).toBe(true)
  })

  // A worktree checkout is a real checkout of a real project, so only a root
  // or a .canon/tmp segment may refuse it, never the .claude folder alone.
  it('should keep a .claude/worktrees checkout', () => {
    expect(
      isScratchPath(
        join(ROOT, 'repo', '.claude', 'worktrees', 'feat'),
        NO_ROOTS,
      ),
    ).toBe(false)
  })

  // macOS hands out its temp folder as /var/folders while a resolved path reads
  // /private/var/folders, so the refusal has to match through the symlink.
  it('should refuse a real path whose root was named through a symlink', () => {
    const real = join(ROOT, 'real')
    mkdirSync(join(real, 'repo'), { recursive: true })
    const link = join(ROOT, 'link')
    symlinkSync(real, link)

    expect(isScratchPath(join(real, 'repo'), [link])).toBe(true)
  })

  it('should refuse a symlinked path whose real form sits under a root', () => {
    const real = join(ROOT, 'real')
    mkdirSync(join(real, 'repo'), { recursive: true })
    const link = join(ROOT, 'link')
    symlinkSync(real, link)

    expect(isScratchPath(join(link, 'repo'), [real])).toBe(true)
  })
})

describe('scratchRoots', () => {
  it('should hold the OS temp folder and the jobs folder', () => {
    expect(scratchRoots()).toEqual(
      expect.arrayContaining([tmpdir(), join(homedir(), '.claude', 'jobs')]),
    )
  })

  // Read at call time rather than at import, so a test that moves the state
  // folder refuses the folder it moved to rather than the home directory.
  it('should follow a state folder override set after import', () => {
    process.env.CANON_STATE_DIR = '/moved/state'

    expect(scratchRoots()).toContain('/moved/state')
  })
})

describe('recordTarget', () => {
  it('should create the file and its folder on the first target recorded', () => {
    const caret = project('caret')
    const nested = join(ROOT, 'state', 'canon', 'targets.json')

    expect(recordTarget(caret, new Date('2026-08-30'), nested, NO_ROOTS)).toBe(
      'recorded',
    )
    expect(readTargetRegistry(nested, NO_ROOTS)).toEqual({
      kind: 'read',
      path: nested,
      targets: [{ path: caret, stampedAt: STAMPED }],
    })
  })

  // Every sync of one target reaches this, so a second run has to move the
  // stamp rather than add a row. A registry that grew per sync would report one
  // project as many and inflate every count read off it.
  it('should replace the row for a target it already holds', () => {
    const caret = project('caret')
    recordTarget(caret, new Date('2026-08-01'), FILE, NO_ROOTS)
    recordTarget(caret, new Date('2026-08-30'), FILE, NO_ROOTS)

    const registry = readTargetRegistry(FILE, NO_ROOTS)

    expect(registry.kind === 'read' ? registry.targets : []).toEqual([
      { path: caret, stampedAt: STAMPED },
    ])
  })

  it('should key the row on the resolved path so a relative target lands once', () => {
    const caret = project('caret')
    project('nested')
    recordTarget(caret, new Date('2026-08-01'), FILE, NO_ROOTS)
    recordTarget(
      join(ROOT, 'repos', 'nested', '..', 'caret'),
      new Date('2026-08-30'),
      FILE,
      NO_ROOTS,
    )

    expect(paths(readTargetRegistry(FILE, NO_ROOTS))).toEqual([caret])
  })

  it('should keep every other target when one is re-recorded', () => {
    const stackr = project('stackr')
    const caret = project('caret')
    recordTarget(stackr, new Date('2026-08-01'), FILE, NO_ROOTS)
    recordTarget(caret, new Date('2026-08-01'), FILE, NO_ROOTS)
    recordTarget(caret, new Date('2026-08-30'), FILE, NO_ROOTS)

    expect(paths(readTargetRegistry(FILE, NO_ROOTS))).toEqual([caret, stackr])
  })

  // The stamp inside the target is the authoritative record and this index is a
  // cache over those, so a state folder nobody can write must not fail the sync
  // that was recording into it.
  it('should report a location it cannot write rather than throwing', () => {
    const blocked = join(FILE, 'targets.json')
    writeFileSync(FILE, '{}\n')

    expect(
      recordTarget(project('caret'), new Date('2026-08-30'), blocked, NO_ROOTS),
    ).toBe('unwritten')
  })

  it('should leave no temp file behind after a write that landed', () => {
    recordTarget(project('caret'), new Date('2026-08-30'), FILE, NO_ROOTS)

    expect(JSON.parse(readFileSync(FILE, 'utf8')).version).toBe(1)
  })

  // Sandbox runs, job scratch, and test temp folders each pass through a
  // stamping sync, and a row for each is how the index reached thousands of
  // paths that no longer exist.
  it('should refuse a target under a scratch root and write nothing', () => {
    const { scratch, run } = scratchRun()

    expect(recordTarget(run, new Date('2026-08-30'), FILE, [scratch])).toBe(
      'scratch',
    )
    expect(readTargetRegistry(FILE, [scratch])).toEqual({
      kind: 'absent',
      path: FILE,
    })
  })

  it('should refuse a target inside a .canon/tmp folder', () => {
    const fixture = join(project('caret'), '.canon', 'tmp', 'fixture')
    mkdirSync(fixture, { recursive: true })

    expect(recordTarget(fixture, new Date('2026-08-30'), FILE, NO_ROOTS)).toBe(
      'scratch',
    )
  })

  it('should refuse a target under the OS temp folder by default', () => {
    expect(recordTarget(project('caret'), new Date('2026-08-30'), FILE)).toBe(
      'scratch',
    )
  })

  it('should refuse a target under the state folder override', () => {
    const state = join(project('caret'), 'state')
    const run = join(state, 'sandbox-1')
    mkdirSync(run, { recursive: true })
    process.env.CANON_STATE_DIR = state

    expect(isScratchPath(run, scratchRoots())).toBe(true)
  })

  it('should record a .claude/worktrees checkout of a real project', () => {
    const worktree = join(project('caret'), '.claude', 'worktrees', 'feat')
    mkdirSync(worktree, { recursive: true })

    expect(recordTarget(worktree, new Date('2026-08-30'), FILE, NO_ROOTS)).toBe(
      'recorded',
    )
    expect(paths(readTargetRegistry(FILE, NO_ROOTS))).toEqual([worktree])
  })

  it('should drop a gone row from the file on the next write', () => {
    const caret = project('caret')
    writeRows([{ path: join(ROOT, 'gone'), stampedAt: STAMPED }])

    recordTarget(caret, new Date('2026-08-30'), FILE, NO_ROOTS)

    expect(storedPaths()).toEqual([caret])
  })

  it('should drop a scratch row from the file on the next write', () => {
    const caret = project('caret')
    const { scratch, run } = scratchRun()
    writeRows([{ path: run, stampedAt: STAMPED }])

    recordTarget(caret, new Date('2026-08-30'), FILE, [scratch])

    expect(storedPaths()).toEqual([caret])
  })
})

describe('backfillTarget', () => {
  it('should record a row dated by the checkout, not by the backfill run', () => {
    const caret = project('caret')
    const outcome = backfillTarget(
      { path: caret, stampedAt: '2026-08-01T00:00:00.000Z' },
      FILE,
      NO_ROOTS,
    )

    expect(outcome).toBe('recorded')
    expect(readTargetRegistry(FILE, NO_ROOTS)).toEqual({
      kind: 'read',
      path: FILE,
      targets: [{ path: caret, stampedAt: '2026-08-01T00:00:00.000Z' }],
    })
  })

  // A checkout whose stamp could not be read has no date to seed the row
  // with, and dating it by the moment the backfill ran would claim a sync
  // that never happened.
  it('should skip a checkout with no readable stamp rather than dating it by now', () => {
    const outcome = backfillTarget(
      { path: project('caret'), stampedAt: null },
      FILE,
      NO_ROOTS,
    )

    expect(outcome).toBe('no-stamp')
    expect(readTargetRegistry(FILE, NO_ROOTS)).toEqual({
      kind: 'absent',
      path: FILE,
    })
  })

  it('should pass a scratch refusal through as its own outcome', () => {
    const outcome = backfillTarget(
      { path: project('caret'), stampedAt: '2026-08-01T00:00:00.000Z' },
      FILE,
      [ROOT],
    )

    expect(outcome).toBe('scratch')
  })
})
