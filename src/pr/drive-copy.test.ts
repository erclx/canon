import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  branchSlug,
  buildDriveCopy,
  changedSince,
  loadPreviewConfig,
  readWorktreeStatus,
} from '@/pr/drive-copy'

let tempDir: string
let worktree: string
let copyRoot: string

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
  tempDir = mkdtempSync(join(tmpdir(), 'canon-drive-copy-'))
  worktree = join(tempDir, 'worktree')
  copyRoot = join(tempDir, 'copy', 'board')
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

describe('loadPreviewConfig', () => {
  it('should read as absent when the project declares no config', () => {
    expect(loadPreviewConfig(worktree)).toEqual({ kind: 'absent' })
  })

  it('should default the variable name when the config leaves it out', () => {
    write('canon/config/preview.json', '{"writes":["board"]}')

    expect(loadPreviewConfig(worktree)).toEqual({
      kind: 'read',
      config: { writes: ['board'], env: 'CANON_PREVIEW_ROOT', keep: [] },
    })
  })

  it('should read the keep paths a declared path holds', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":["board/.run"]}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'read',
      config: { keep: ['board/.run'] },
    })
  })

  it('should refuse a keep that is not a list of paths', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":"board/.run"}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'bad-config',
    })
  })

  it('should refuse a keep outside every declared path', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":["elsewhere/.run"]}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'bad-config',
    })
  })

  it('should refuse a keep climbing out of the worktree', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":["board/../../etc"]}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'unsafe-path',
    })
  })

  it('should keep the variable name the project declares', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"env":"BOARD_ROOT"}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      config: { env: 'BOARD_ROOT' },
    })
  })

  it('should refuse a config that does not parse', () => {
    write('canon/config/preview.json', '{"writes":')

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'bad-config',
    })
  })

  it('should refuse a writes path climbing out of the worktree', () => {
    write('canon/config/preview.json', '{"writes":["board/../../etc"]}')

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'unsafe-path',
    })
  })

  it('should refuse an absolute writes path', () => {
    write('canon/config/preview.json', '{"writes":["/etc"]}')

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'unsafe-path',
    })
  })
})

describe('buildDriveCopy', () => {
  it('should copy each declared path into the copy root', () => {
    const result = buildDriveCopy(worktree, copyRoot, ['board'])

    expect(result).toEqual({ copied: ['board'], missing: [] })
    expect(readFileSync(join(copyRoot, 'board/frames.json'), 'utf8')).toBe(
      '{"x":0}',
    )
  })

  it('should replace what the last copy held', () => {
    buildDriveCopy(worktree, copyRoot, ['board'])
    writeFileSync(join(copyRoot, 'board/dragged.json'), '{}')

    buildDriveCopy(worktree, copyRoot, ['board'])

    expect(existsSync(join(copyRoot, 'board/dragged.json'))).toBe(false)
  })

  it('should name a declared path the worktree does not hold', () => {
    const result = buildDriveCopy(worktree, copyRoot, ['board', 'gone'])

    expect(result).toEqual({ copied: ['board'], missing: ['gone'] })
  })
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

describe('branchSlug', () => {
  it('should drop a leading type segment and flatten the rest', () => {
    expect(branchSlug('feat/review-ui/drive-copy')).toBe('review-ui-drive-copy')
  })

  it('should keep a first segment that names no type', () => {
    expect(branchSlug('spike/parser')).toBe('spike-parser')
  })

  it('should keep a type that no further segment follows', () => {
    expect(branchSlug('feat')).toBe('feat')
  })
})

describe('readWorktreeStatus', () => {
  it('should read as undefined outside a repository', async () => {
    expect(await readWorktreeStatus(join(tempDir, 'nowhere'))).toBeUndefined()
  })
})
