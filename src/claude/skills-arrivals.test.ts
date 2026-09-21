import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readArrivals } from '@/claude/skills-arrivals'

let root: string

function git(...args: string[]): void {
  execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' })
}

function write(rel: string, body = '# Body\n'): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), body)
}

function commitAll(message: string): void {
  git('add', '-A')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', message)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-skills-arrivals-'))
  git('init', '-b', 'main')
  write('claude/skills/git-pr/SKILL.md')
  commitAll('base')
  git('checkout', '-b', 'feat/x')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('readArrivals', () => {
  it('should report a body added on the branch', async () => {
    write('claude/skills/new-skill/SKILL.md')
    commitAll('add')

    const result = await readArrivals(root, 'main')

    expect(result).toMatchObject({
      kind: 'measured',
      arrivals: [
        { name: 'new-skill', path: 'claude/skills/new-skill/SKILL.md' },
      ],
    })
  })

  it('should report an untracked body in the internal corpus', async () => {
    write('.claude/skills/internal-x/SKILL.md')

    const result = await readArrivals(root, 'main')

    expect(result).toMatchObject({ arrivals: [{ name: 'internal-x' }] })
  })

  it('should report nothing for an edited body', async () => {
    write('claude/skills/git-pr/SKILL.md', '# Changed\n')
    commitAll('edit')

    const result = await readArrivals(root, 'main')

    expect(result).toMatchObject({ kind: 'measured', arrivals: [] })
  })

  it('should count a renamed folder as an arrival', async () => {
    git('mv', 'claude/skills/git-pr', 'claude/skills/git-pull')
    commitAll('move')

    const result = await readArrivals(root, 'main')

    expect(result).toMatchObject({ arrivals: [{ name: 'git-pull' }] })
  })

  it('should refuse when no base resolves', async () => {
    const result = await readArrivals(root, 'no-such-ref')

    expect(result).toMatchObject({ kind: 'refused', reason: 'no-base' })
  })
})
