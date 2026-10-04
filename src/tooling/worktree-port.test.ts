import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/web/configs/scripts/worktree-port.sh',
)

const BASE = 4321
const BAND = 50

let root: string

// Every inherited GIT_* var is dropped before the fixtures are built. A git hook
// exports GIT_DIR, so a run under pre-push would resolve every fixture against
// the toolkit's own repository and each case would answer for the wrong tree.
// WORKTREE_PORT_OFFSET goes with them, since the helper reads it first and an
// operator who set it by hand would short-circuit every case below.
const inheritedEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith('GIT_') && key !== 'WORKTREE_PORT_OFFSET',
    ),
  )

const buildEnv = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  ...inheritedEnv(),
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_AUTHOR_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  ...extra,
})

const sh = (script: string): string =>
  execFileSync('bash', ['-c', script], {
    cwd: root,
    encoding: 'utf8',
    env: buildEnv(),
  })

interface PortResult {
  status: null | number
  stderr: string
  stdout: string
}

const port = (dir: string, extra: NodeJS.ProcessEnv = {}): PortResult => {
  const run = spawnSync('bash', [SCRIPT, String(BASE)], {
    cwd: join(root, dir),
    encoding: 'utf8',
    env: buildEnv(extra),
  })

  return { status: run.status, stderr: run.stderr, stdout: run.stdout.trim() }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'worktree-port-'))
  sh('git init -q repo')
  sh('git -C repo commit -q --allow-empty -m init')
  sh('mkdir -p repo/src repo/.claude/worktrees plain')
  sh('git -C repo worktree add -q .claude/worktrees/live -b live')

  // The two shapes a removed worktree leaves behind. Deleting the folder's own
  // `.git` sends git upward to the parent, and pruning the administrative
  // directory it points at makes git refuse outright. Both reach the base port
  // through a different branch of the helper.
  sh('mkdir -p repo/.claude/worktrees/unregistered/src')
  sh('git -C repo worktree add -q .claude/worktrees/pruned -b pruned')
  sh('rm -rf repo/.git/worktrees/pruned')
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('worktree-port', () => {
  it('should serve the base port from the main checkout', () => {
    expect(port('repo').stdout).toBe(String(BASE))
  })

  it('should serve the base port from an ordinary subdirectory', () => {
    expect(port('repo/src').stdout).toBe(String(BASE))
  })

  it('should serve the base port outside a git repository', () => {
    expect(port('plain').stdout).toBe(String(BASE))
  })

  it('should offset a registered worktree within the band', () => {
    const served = Number(port('repo/.claude/worktrees/live').stdout)

    expect(served).toBeGreaterThan(BASE)
    expect(served).toBeLessThanOrEqual(BASE + BAND)
  })

  it('should refuse a folder no worktree is registered for', () => {
    const result = port('repo/.claude/worktrees/unregistered')

    expect(result.status).not.toBe(0)
    expect(result.stdout).toBe('')
  })

  it('should name the override when refusing an unregistered folder', () => {
    const result = port('repo/.claude/worktrees/unregistered')

    expect(result.stderr).toContain('WORKTREE_PORT_OFFSET')
  })

  it('should refuse a subdirectory of an unregistered folder', () => {
    const result = port('repo/.claude/worktrees/unregistered/src')

    expect(result.status).not.toBe(0)
  })

  it('should refuse a folder whose administrative directory was pruned', () => {
    const result = port('repo/.claude/worktrees/pruned')

    expect(result.status).not.toBe(0)
    expect(result.stdout).toBe('')
  })

  it('should name the override when refusing a pruned folder', () => {
    const result = port('repo/.claude/worktrees/pruned')

    expect(result.stderr).toContain('WORKTREE_PORT_OFFSET')
  })

  it('should honor an explicit offset inside a leftover folder', () => {
    const result = port('repo/.claude/worktrees/unregistered', {
      WORKTREE_PORT_OFFSET: '7',
    })

    expect(result.stdout).toBe(String(BASE + 7))
  })
})
