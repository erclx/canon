import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { PROJECT_ROOT } from '@/roots/project'
import {
  checkoutRefusal,
  copyCheckout,
  copySource,
  listSnapshots,
  type ReplaySource,
  replaySource,
} from '@/sandbox/replay/run'

let scratch: string

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'replay-test-'))
})

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

function write(root: string, rel: string, body: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), body)
}

function git(cwd: string, ...args: string[]): void {
  spawnSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@localhost', ...args],
    { cwd, env: gitEnv() },
  )
}

describe('copySource', () => {
  it('should strip the fixture suffix and keep a gitignored record from a snapshot', () => {
    const snapshot = join(scratch, 'snap')
    write(snapshot, '.gitignore.fixture', '.canon/\n')
    write(snapshot, 'canon/config/config.json.fixture', '{}\n')
    write(snapshot, '.canon/tasks/index.md.fixture', '# Tasks\n')
    const tree = join(scratch, 'tree')

    copySource({ name: 'snap', path: snapshot, kind: 'snapshot' }, tree)

    expect(existsSync(join(tree, 'canon/config/config.json'))).toBe(true)
    expect(existsSync(join(tree, '.canon/tasks/index.md'))).toBe(true)
  })

  it('should leave the recorded expectation out of the tree without throwing', () => {
    const snapshot = join(scratch, 'snap')
    write(snapshot, 'CLAUDE.md.fixture', '# Snap\n')
    write(snapshot, 'expected.json', '{"steps":{}}\n')
    const tree = join(scratch, 'tree')

    copySource({ name: 'snap', path: snapshot, kind: 'snapshot' }, tree)

    expect(readdirSync(tree)).toEqual(['CLAUDE.md'])
  })

  it('should keep a gitignored record a clone of the checkout would drop', () => {
    const checkout = join(scratch, 'consumer')
    write(checkout, '.gitignore', '.canon/\nnode_modules/\n')
    write(checkout, 'CLAUDE.md', '# Consumer\n')
    write(checkout, '.canon/tasks/index.md', '# Tasks\n')
    write(checkout, 'node_modules/pkg/index.js', '')
    git(checkout, 'init', '-q', '-b', 'main')
    git(checkout, 'add', '-A')
    git(checkout, 'commit', '-q', '-m', 'init')
    const tree = join(scratch, 'tree')

    copySource({ name: 'consumer', path: checkout, kind: 'checkout' }, tree)

    expect(existsSync(join(tree, '.canon/tasks/index.md'))).toBe(true)
    expect(existsSync(join(tree, 'node_modules'))).toBe(false)
  })
})

describe('copyCheckout', () => {
  const checkout = (): ReplaySource => {
    const path = join(scratch, 'consumer')
    write(path, 'CLAUDE.md', '# Consumer\n')
    return { name: 'consumer', path, kind: 'checkout' }
  }

  const vanish = (code: string): Error =>
    Object.assign(new Error(`${code}: lstat maintenance.lock`), { code })

  it('should retry after a file vanishes and leave nothing of the failed attempt', () => {
    const source = checkout()
    const tree = join(scratch, 'tree')
    let calls = 0
    const copy: typeof cpSync = (from, to, options) => {
      calls += 1
      if (calls === 1) {
        write(to as string, 'half-written.txt', '')
        throw vanish('ENOENT')
      }
      cpSync(from, to, options)
    }

    copyCheckout(source, tree, copy)

    expect(calls).toBe(2)
    expect(existsSync(join(tree, 'CLAUDE.md'))).toBe(true)
    expect(existsSync(join(tree, 'half-written.txt'))).toBe(false)
  })

  it('should throw the original ENOENT after three attempts', () => {
    const source = checkout()
    const error = vanish('ENOENT')
    let calls = 0
    const copy: typeof cpSync = () => {
      calls += 1
      throw error
    }

    expect(() => copyCheckout(source, join(scratch, 'tree'), copy)).toThrow(
      error,
    )
    expect(calls).toBe(3)
  })

  it('should not retry an error other than ENOENT', () => {
    const source = checkout()
    const error = vanish('EACCES')
    let calls = 0
    const copy: typeof cpSync = () => {
      calls += 1
      throw error
    }

    expect(() => copyCheckout(source, join(scratch, 'tree'), copy)).toThrow(
      error,
    )
    expect(calls).toBe(1)
  })
})

describe('checkoutRefusal', () => {
  it('should refuse a checkout with uncommitted changes rather than sync over it', () => {
    const checkout = join(scratch, 'consumer')
    write(checkout, 'CLAUDE.md', '# Consumer\n')
    git(checkout, 'init', '-q', '-b', 'main')
    git(checkout, 'add', '-A')
    git(checkout, 'commit', '-q', '-m', 'init')
    write(checkout, 'CLAUDE.md', '# Edited\n')

    expect(checkoutRefusal(checkout)?.reason).toBe('dirty')
  })

  it('should refuse a folder that is not a repository', () => {
    const folder = join(scratch, 'plain')
    write(folder, 'CLAUDE.md', '# Plain\n')

    expect(checkoutRefusal(folder)?.reason).toBe('not-a-repo')
  })

  it('should accept a clean checkout', () => {
    const checkout = join(scratch, 'consumer')
    write(checkout, 'CLAUDE.md', '# Consumer\n')
    git(checkout, 'init', '-q', '-b', 'main')
    git(checkout, 'add', '-A')
    git(checkout, 'commit', '-q', '-m', 'init')

    expect(checkoutRefusal(checkout)).toBeUndefined()
  })
})

describe('listSnapshots', () => {
  it('should list each snapshot folder by name in sorted order', () => {
    write(scratch, 'snapshots/zeta/CLAUDE.md.fixture', '')
    write(scratch, 'snapshots/alpha/CLAUDE.md.fixture', '')

    expect(listSnapshots(join(scratch, 'snapshots'))).toEqual([
      {
        name: 'alpha',
        path: join(scratch, 'snapshots/alpha'),
        kind: 'snapshot',
      },
      { name: 'zeta', path: join(scratch, 'snapshots/zeta'), kind: 'snapshot' },
    ])
  })
})

describe('replaySource', () => {
  it('should run every step on a minimal snapshot and remove its tree', () => {
    const snapshot = join(scratch, 'snap')
    write(snapshot, 'CLAUDE.md.fixture', '# Minimal\n')
    write(snapshot, '.gitignore.fixture', '.canon/\n')
    write(snapshot, '.canon/tasks/index.md.fixture', '# Tasks\n')
    const tempRoot = join(scratch, 'trees')

    const result = replaySource(
      { name: 'minimal', path: snapshot, kind: 'snapshot' },
      { checkoutRoot: PROJECT_ROOT, tempRoot },
    )

    expect(result.steps.map((s) => s.step)).toEqual([
      'sync',
      'sync --check',
      'context audit',
      'markdown audit',
      'migrate status',
      'format',
    ])
    expect(result.steps.filter((s) => s.verdict !== 'ok')).toEqual([])
    expect(readdirSync(tempRoot)).toEqual([])
  }, 120_000)
})
