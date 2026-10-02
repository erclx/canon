import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { repairBareFlag } from '@/worktrees/bare-flag'

let root: string

// A git hook exports GIT_DIR, so a run under pre-push would otherwise resolve
// `git -C real-bare.git` against the toolkit's own repository and the
// genuinely-bare case would pass for the wrong reason. Isolating config also
// drops the commit identity, hence the ident vars.
const sh = (script: string): string =>
  execFileSync('bash', ['-c', script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
      ),
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_AUTHOR_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
    },
  })

const bareFlag = (target: string): string =>
  sh(`git -C ${target} config --get core.bare 2>/dev/null || echo unset`).trim()

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bare-flag-'))
  sh('git init -q repo')
  sh('git -C repo commit -q --allow-empty -m init')
  sh('git -C repo worktree add -q ../linked -b linked')
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('repairBareFlag', () => {
  it('should leave a healthy repository untouched', async () => {
    const record = await repairBareFlag(join(root, 'repo'))

    expect(record).toMatchObject({ repaired: false, reason: 'flag-unset' })
    expect(bareFlag('repo')).toBe('false')
  })

  it('should clear the flag when run from the main worktree', async () => {
    sh('git -C repo config core.bare true')

    const record = await repairBareFlag(join(root, 'repo'))

    expect(record.repaired).toBe(true)
    expect(record.message).toContain('Repaired core.bare')
    expect(bareFlag('repo')).toBe('false')
  })

  it("should clear the parent's flag when run from a linked worktree", async () => {
    sh('git -C repo config core.bare true')

    const record = await repairBareFlag(join(root, 'linked'))

    expect(record.repaired).toBe(true)
    expect(bareFlag('repo')).toBe('false')
  })

  it('should restore a stranded main worktree to a usable state', async () => {
    sh('git -C repo config core.bare true')
    await repairBareFlag(join(root, 'linked'))

    expect(sh('git -C repo status --short; echo ok').trim()).toBe('ok')
  })

  it('should leave a genuinely bare repository alone', async () => {
    sh('git init -q --bare real-bare.git')

    const record = await repairBareFlag(join(root, 'real-bare.git'))

    expect(record).toMatchObject({ repaired: false, reason: 'genuinely-bare' })
    expect(bareFlag('real-bare.git')).toBe('true')
  })

  it('should return cleanly outside a git repository', async () => {
    sh('mkdir plain')

    const record = await repairBareFlag(join(root, 'plain'))

    expect(record.repaired).toBe(false)
  })
})
