import { spawnSync } from 'node:child_process'
import {
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
import { copySource, replaySource } from '@/sandbox/replay/run'

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
