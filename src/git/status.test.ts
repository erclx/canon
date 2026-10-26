import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { changedSince, readWorktreeStatus } from '@/git/status'

let tempDir: string
let worktree: string

function git(...args: string[]): void {
  execaSync('git', ['-C', worktree, ...args], {
    env: {
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  })
}

function write(path: string, text: string): void {
  mkdirSync(dirname(join(worktree, path)), { recursive: true })
  writeFileSync(join(worktree, path), text)
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'canon-git-status-'))
  worktree = join(tempDir, 'worktree')
  mkdirSync(worktree)
  git('init', '-q', '-b', 'feat/x')
  write('board/frames.json', '{"x":0}')
  write('board/assets/a.png', 'a')
  write('README.md', '# r\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('changedSince', () => {
  it('should report a tracked file changed after the baseline', async () => {
    const baseline = await readWorktreeStatus(worktree)
    write('board/frames.json', '{"x":40}')

    const current = await readWorktreeStatus(worktree)

    expect(changedSince(baseline ?? [], current ?? [])).toEqual([
      'board/frames.json',
    ])
  })

  it('should ignore a change already present at the baseline', async () => {
    write('README.md', '# worker edit\n')
    const baseline = await readWorktreeStatus(worktree)

    const current = await readWorktreeStatus(worktree)

    expect(changedSince(baseline ?? [], current ?? [])).toEqual([])
  })

  it('should report a file already dirty at the baseline that changed again', async () => {
    write('README.md', '# worker edit\n')
    const baseline = await readWorktreeStatus(worktree)
    write('README.md', '# drive edit\n')

    const current = await readWorktreeStatus(worktree)

    expect(changedSince(baseline ?? [], current ?? [])).toEqual(['README.md'])
  })

  it('should report a new file inside a tracked folder', async () => {
    const baseline = await readWorktreeStatus(worktree)
    write('board/assets/b.png', 'b')

    const current = await readWorktreeStatus(worktree)

    expect(changedSince(baseline ?? [], current ?? [])).toEqual([
      'board/assets/b.png',
    ])
  })
})

describe('readWorktreeStatus', () => {
  it('should read as undefined outside a repository', async () => {
    expect(await readWorktreeStatus(join(tempDir, 'nowhere'))).toBeUndefined()
  })
})
