import { execaSync } from 'execa'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { gitTrunkReader } from '@/tasks/trunk'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function commit(message: string): void {
  writeFileSync(join(ROOT, 'file.txt'), `${message}\n`)
  git('add', '--all')
  git('commit', '-m', message)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-tasks-trunk-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('gitTrunkReader', () => {
  it('should report a squash merge sitting on the trunk', async () => {
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    commit('feat(tasks): count plan citations (#673)')

    expect(await gitTrunkReader(ROOT)(673)).toBe(true)
  })

  it('should report a merge commit sitting on the trunk', async () => {
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    commit('Merge pull request #673 from erclx/fix/board-guards')

    expect(await gitTrunkReader(ROOT)(673)).toBe(true)
  })

  it('should not read a longer number as the one it was asked about', async () => {
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    commit('feat(tasks): count plan citations (#6731)')

    expect(await gitTrunkReader(ROOT)(673)).toBe(false)
  })

  it('should report a pull request the trunk does not carry', async () => {
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    commit('feat(tasks): something else entirely')

    expect(await gitTrunkReader(ROOT)(673)).toBe(false)
  })

  it('should answer undefined where no trunk ref resolves', async () => {
    expect(await gitTrunkReader(ROOT)(673)).toBeUndefined()
  })
})
