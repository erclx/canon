import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const LIB = join(import.meta.dirname, '../../scripts/lib/sandbox-git.sh')

let root: string

interface Run {
  status: null | number
  stderr: string
  stdout: string
}

const sh = (script: string, env: NodeJS.ProcessEnv = {}): Run => {
  const run = spawnSync('bash', ['-c', `set -e\nsource ${LIB}\n${script}`], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })

  return { status: run.status, stderr: run.stderr, stdout: run.stdout.trim() }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sandbox-git-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('resolve_sandbox_skill_diff_base', () => {
  // The property the fix buys: preferring origin/main over local main means the
  // result never moves when local main catches up, which the bare-main form
  // this replaces could not hold, since it read local main directly.
  it('should return the same base whether local main is stale or freshly matched to origin/main', () => {
    sh(`
      git init -q --bare origin.git

      git init -q -b main work
      cd work
      git config user.email t@example.com
      git config user.name t
      echo base > file.txt
      git add file.txt
      git commit -q -m base
      git remote add origin ../origin.git
      git push -q origin main

      git checkout -q -b feature
      echo feature > feature.txt
      git add feature.txt
      git commit -q -m feature

      cd ..
      git clone -q origin.git advancer
      cd advancer
      git config user.email t@example.com
      git config user.name t
      mkdir -p claude/skills/example
      echo body > claude/skills/example/SKILL.md
      git add claude/skills/example/SKILL.md
      git commit -q -m 'touch skill body'
      git push -q origin main
    `)

    const staleEnv = { PROJECT_ROOT: join(root, 'work') }
    const stale = sh(
      `cd work
       git fetch -q origin main >/dev/null 2>&1
       resolve_sandbox_skill_diff_base`,
      staleEnv,
    )

    const fresh = sh(
      `cd work
       git branch -f main origin/main >/dev/null 2>&1
       resolve_sandbox_skill_diff_base`,
      staleEnv,
    )

    expect(stale.stdout).not.toBe('')
    expect(stale.stdout).toBe(fresh.stdout)
  })
})
