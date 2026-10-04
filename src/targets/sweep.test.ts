import { execSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { originOf, sweepTargets } from '@/targets/sweep'

let ROOT: string

/** Stamps a folder the way a current install leaves it. */
function stamp(...segments: string[]): string {
  const target = join(ROOT, ...segments)
  const path = join(target, '.claude', 'canon', 'config.json')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ covers: [], domains: {} }))
  return target
}

/** Stamps a folder the way an install predating the relocation left it. */
function stampLegacy(...segments: string[]): string {
  const target = join(ROOT, ...segments)
  const path = join(target, '.claude', 'aitk.json')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ covers: [], domains: {} }))
  return target
}

/** Stamps a folder the way a pre-rename install still writes it. */
function stampRetiredName(...segments: string[]): string {
  const target = join(ROOT, ...segments)
  const path = join(target, '.claude', 'aitk', 'config.json')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ covers: [], domains: {} }))
  return target
}

const noOrigin = async (): Promise<string | null> => null

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-sweep-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('sweepTargets', () => {
  it('should find a target stamped at the current path', async () => {
    const caret = stamp('caret')

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.targets.map((target) => target.paths)).toEqual([[caret]])
  })

  it('should find a target still stamped at the retired path and mark it', async () => {
    const stackr = stampLegacy('stackr')

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.targets).toHaveLength(1)
    expect(report.targets[0]?.legacyPaths).toEqual([stackr])
  })

  // A pre-rename install still writes this form as its current path, so a
  // sync from it after this row's own binary updated would otherwise drop the
  // target out of the walk with nothing saying so.
  it('should find a target stamped only at the retired folder path', async () => {
    const diction = stampRetiredName('diction')

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.targets).toHaveLength(1)
    expect(report.targets[0]?.legacyPaths).toEqual([diction])
  })

  // The group boolean this replaced cleared for the whole group the moment one
  // clone migrated, so a project half-migrated read as fully current.
  it('should name only the clone still at the retired path when its sibling migrated', async () => {
    const current = stamp('public', 'caret')
    const legacy = stampLegacy('extensions', 'caret')

    const report = await sweepTargets([ROOT], {
      originOf: async () => 'github.com/erclx/caret',
    })

    expect(report.targets).toHaveLength(1)
    expect(report.targets[0]?.legacyPaths).toEqual([legacy])
    expect(report.targets[0]?.paths).toContain(current)
  })

  it('should report a folder carrying no stamp as no target rather than as one', async () => {
    mkdirSync(join(ROOT, 'clash'), { recursive: true })

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.targets).toEqual([])
  })

  // The census taken 2026-08-28 walked one clone of `caret` and the repair had
  // run in a second clone it never saw, which is what let a ticked outcome
  // contradict its own finding. Two clones are one project.
  it('should count two clones sharing an origin as one target', async () => {
    const first = stamp('public', 'caret')
    const second = stamp('extensions', 'chrome', 'caret')

    const report = await sweepTargets([ROOT], {
      originOf: async () => 'github.com/erclx/caret',
    })

    expect(report.targets).toHaveLength(1)
    expect([...(report.targets[0]?.paths ?? [])].sort()).toEqual(
      [first, second].sort(),
    )
  })

  it('should keep two checkouts with no resolvable origin apart', async () => {
    stamp('one')
    stamp('two')

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.targets).toHaveLength(2)
  })

  it('should separate two targets whose origins differ', async () => {
    const caret = stamp('caret')

    stamp('stackr')

    const report = await sweepTargets([ROOT], {
      originOf: async (path) =>
        path === caret ? 'github.com/erclx/caret' : 'github.com/erclx/stackr',
    })

    expect(report.targets).toHaveLength(2)
  })

  // Measured on this machine: one stamped repository holds the eight folders
  // the hand census walked. Stopping at the outer one hides every target below
  // it, which is the whole population the sweep exists to find.
  it('should keep walking below a target it already found', async () => {
    const outer = stamp('career')
    const inner = stamp('career', 'public', 'stackr')

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.targets.flatMap((target) => target.paths).sort()).toEqual(
      [outer, inner].sort(),
    )
  })

  // A linked worktree holds a full checkout carrying a copy of its own target's
  // stamp. One target here had five, and each would have counted as a target.
  it('should not read a linked worktree as a target of its own', async () => {
    const career = stamp('career')

    stamp('career', '.claude', 'worktrees', 'linkedin-sync')

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.targets.flatMap((target) => target.paths)).toEqual([career])
  })

  // An answer that ran out of depth and an answer that found everything read
  // identically without this, which is exactly how the population was
  // undercounted by a folder nobody thought to look in.
  it('should name the folders it stopped at when the depth cap is reached', async () => {
    stamp('a', 'b', 'c', 'd', 'e', 'deep')

    const report = await sweepTargets([ROOT], { depth: 2, originOf: noOrigin })

    expect(report.targets).toEqual([])
    expect(report.bound.truncated).toContain(join(ROOT, 'a', 'b'))
  })

  // A depth that is not a number leaves every `level >= depth` test false, so
  // the walk runs to the bottom of its root while the bound claims a cap. The
  // command refuses such a value, and this holds the floor under that.
  it('should walk without a cap when handed a depth that is not a number', async () => {
    stamp('a', 'b', 'c', 'd', 'e', 'f', 'deep')

    const report = await sweepTargets([ROOT], {
      depth: Number.NaN,
      originOf: noOrigin,
    })

    expect(report.targets).toHaveLength(1)
    expect(report.bound.truncated).toEqual([])
  })

  it('should report the roots and the depth the answer is bounded by', async () => {
    const report = await sweepTargets([ROOT], { depth: 3, originOf: noOrigin })

    expect(report.bound.roots).toEqual([ROOT])
    expect(report.bound.depth).toBe(3)
  })

  it('should report a root that does not exist as unreadable rather than empty', async () => {
    const missing = join(ROOT, 'nowhere')

    const report = await sweepTargets([missing], { originOf: noOrigin })

    expect(report.bound.unreadable).toEqual([missing])
    expect(report.targets).toEqual([])
  })

  it('should skip a vendored tree rather than walking into it', async () => {
    stamp('node_modules', 'some-package')

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.targets).toEqual([])
  })

  it('should report one target when two roots overlap', async () => {
    stamp('nested', 'caret')

    const report = await sweepTargets([ROOT, join(ROOT, 'nested')], {
      originOf: noOrigin,
    })

    expect(report.targets).toHaveLength(1)
  })

  // `readdirSync` with `withFileTypes` answers `isDirectory()` false for a
  // symlink, so the walk neither follows it nor reports it anywhere unless the
  // bound names it explicitly.
  it('should name a symlinked directory in the bound rather than walking it', async () => {
    const real = stamp('real', 'caret')
    symlinkSync(join(ROOT, 'real'), join(ROOT, 'link'))

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.bound.symlinks).toEqual([join(ROOT, 'link')])
    expect(report.targets.flatMap((target) => target.paths)).toEqual([real])
  })

  // A symlink to a file is not a directory the walk skipped, and naming it
  // here would read as a walk candidate that was passed over when it never
  // was one.
  it('should not name a symlink to a file in the bound', async () => {
    writeFileSync(join(ROOT, 'note.txt'), 'hi')
    symlinkSync(join(ROOT, 'note.txt'), join(ROOT, 'note-link.txt'))

    const report = await sweepTargets([ROOT], { originOf: noOrigin })

    expect(report.bound.symlinks).toEqual([])
  })
})

describe('originOf', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-sweep-origin-'))
    execSync('git init --quiet', { cwd: root, env: gitEnv() })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function withRemote(url: string): Promise<string | null> {
    execSync(`git remote add origin ${url}`, { cwd: root, env: gitEnv() })
    return originOf(root)
  }

  it('should normalize an ssh remote', async () => {
    expect(await withRemote('git@github.com:owner/repo.git')).toBe(
      'github.com/owner/repo',
    )
  })

  it('should normalize an https remote', async () => {
    expect(await withRemote('https://github.com/owner/repo.git')).toBe(
      'github.com/owner/repo',
    )
  })

  // A checkout cloned with a token puts the token in the userinfo component,
  // and the key this returns reaches stdout on `canon targets list --json`.
  it('should strip a token-bearing userinfo component', async () => {
    expect(
      await withRemote(
        'https://x-access-token:secret-token@github.com/owner/repo.git',
      ),
    ).toBe('github.com/owner/repo')
  })

  // A bare username in the userinfo component used to survive the strip and
  // key the target under the username instead, which failed to group with
  // the same project's ssh clone.
  it('should strip a bare-username userinfo component', async () => {
    expect(await withRemote('https://someuser@github.com/owner/repo.git')).toBe(
      'github.com/owner/repo',
    )
  })
})
