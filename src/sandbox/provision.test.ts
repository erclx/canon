import { execFileSync } from 'node:child_process'
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { commitScenarioChanges, injectChangedSkills } from '@/sandbox/provision'

let dir: string
let root: string
let sandbox: string

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function write(base: string, path: string, content: string): void {
  mkdirSync(dirname(join(base, path)), { recursive: true })
  writeFileSync(join(base, path), content)
}

function initRepo(path: string): void {
  mkdirSync(path, { recursive: true })
  git(path, 'init', '-q', '-b', 'main')
  git(path, 'config', 'user.name', 'test')
  git(path, 'config', 'user.email', 'test@example.com')
}

function commitAll(path: string, message: string): void {
  git(path, 'add', '-A')
  git(path, 'commit', '-q', '--no-verify', '-m', message)
}

/** A toolkit checkout on a branch off `main` that edits, adds, and deletes skills. */
function branchTouchingSkills(): void {
  initRepo(root)
  write(root, 'claude/skills/edited/SKILL.md', 'before\n')
  write(root, 'claude/skills/removed/SKILL.md', 'gone soon\n')
  commitAll(root, 'base')
  git(root, 'checkout', '-q', '-b', 'feature')
  write(root, 'claude/skills/edited/SKILL.md', 'after\n')
  rmSync(join(root, 'claude/skills/removed'), { recursive: true })
  commitAll(root, 'feature')
  write(root, 'claude/skills/fresh/SKILL.md', 'untracked\n')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sandbox-provision-'))
  root = join(dir, 'root')
  sandbox = join(dir, 'tree')
  initRepo(sandbox)
  write(sandbox, 'README.md', 'tree\n')
  commitAll(sandbox, 'initial')
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
})

describe('injectChangedSkills', () => {
  it('should inject the skills the branch changed and the untracked ones', () => {
    branchTouchingSkills()

    const injected = injectChangedSkills(root, sandbox, false)

    expect(injected).toEqual(['edited', 'fresh'])
  })

  it('should copy each injected body into the tree', () => {
    branchTouchingSkills()

    injectChangedSkills(root, sandbox, false)

    expect(
      readFileSync(join(sandbox, '.claude/skills/edited/SKILL.md'), 'utf8'),
    ).toBe('after\n')
  })

  it('should leave out a skill only main changed after the branch forked', () => {
    initRepo(root)
    write(root, 'claude/skills/shared/SKILL.md', 'at the fork\n')
    commitAll(root, 'base')
    git(root, 'checkout', '-q', '-b', 'feature')
    git(root, 'checkout', '-q', 'main')
    write(root, 'claude/skills/shared/SKILL.md', 'moved on main\n')
    commitAll(root, 'main moves')
    git(root, 'checkout', '-q', 'feature')

    const injected = injectChangedSkills(root, sandbox, false)

    expect(injected).toEqual([])
  })

  it('should take the merge base against origin/main over a stale local main', () => {
    const remote = join(dir, 'origin.git')
    const advancer = join(dir, 'advancer')
    git(dir, 'init', '-q', '--bare', '-b', 'main', remote)
    initRepo(root)
    write(root, 'claude/skills/shared/SKILL.md', 'before the remote moved\n')
    commitAll(root, 'base')
    git(root, 'remote', 'add', 'origin', remote)
    git(root, 'push', '-q', 'origin', 'main')
    git(dir, 'clone', '-q', remote, advancer)
    git(advancer, 'config', 'user.name', 'test')
    git(advancer, 'config', 'user.email', 'test@example.com')
    write(advancer, 'claude/skills/shared/SKILL.md', 'merged upstream\n')
    commitAll(advancer, 'merged upstream')
    git(advancer, 'push', '-q', 'origin', 'main')
    git(root, 'fetch', '-q', 'origin')
    git(root, 'checkout', '-q', '-b', 'feature', 'origin/main')

    const injected = injectChangedSkills(root, sandbox, false)

    expect(injected).toEqual([])
  })

  it('should skip a skill the branch deleted', () => {
    branchTouchingSkills()

    injectChangedSkills(root, sandbox, false)

    expect(existsSync(join(sandbox, '.claude/skills/removed'))).toBe(false)
  })

  it('should exclude the injected paths when the auto-commit is skipped', () => {
    branchTouchingSkills()

    injectChangedSkills(root, sandbox, true)

    expect(readFileSync(join(sandbox, '.git/info/exclude'), 'utf8')).toContain(
      '.claude/skills/edited/SKILL.md\n.claude/skills/fresh/SKILL.md\n',
    )
  })

  it('should inject nothing when the run resolves skills through the plugin', () => {
    branchTouchingSkills()

    const injected = injectChangedSkills(root, sandbox, false, true)

    expect(injected).toEqual([])
    expect(existsSync(join(sandbox, '.claude/skills'))).toBe(false)
  })

  it('should write no exclude line when injection is skipped', () => {
    branchTouchingSkills()

    injectChangedSkills(root, sandbox, true, true)

    expect(
      readFileSync(join(sandbox, '.git/info/exclude'), 'utf8'),
    ).not.toContain('.claude/skills/')
  })
})

describe('commitScenarioChanges', () => {
  it('should commit what the scenario staged', () => {
    write(sandbox, 'staged.txt', 'x\n')

    const status = commitScenarioChanges(sandbox, false, process.env)

    expect(status).toBe(0)
    expect(git(sandbox, 'log', '-1', '--format=%s').trim()).toBe(
      'chore(sandbox): apply scenario specific setup',
    )
  })

  it('should leave the tree uncommitted when the auto-commit is skipped', () => {
    write(sandbox, 'staged.txt', 'x\n')

    commitScenarioChanges(sandbox, true, process.env)

    expect(git(sandbox, 'status', '--porcelain')).toBe('?? staged.txt\n')
  })

  it('should fail as the dispatcher did when the scenario staged nothing', () => {
    const status = commitScenarioChanges(sandbox, false, process.env)

    expect(status).toBe(1)
  })
})
