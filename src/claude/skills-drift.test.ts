import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseMovedBodies, readDrift } from '@/claude/skills-drift'

const FIRST = 'a'.repeat(40)
const SECOND = 'b'.repeat(40)

let root: string

function skillsRoot(): void {
  mkdirSync(join(root, 'claude', 'skills', 'git-commit'), { recursive: true })
  writeFileSync(
    join(root, 'claude', 'skills', 'git-commit', 'SKILL.md'),
    '# Body\n',
  )
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-skills-drift-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('parseMovedBodies', () => {
  it('should name each skill whose body a commit rewrote', () => {
    const output = [
      FIRST,
      '',
      'claude/skills/git-commit/SKILL.md',
      'claude/skills/git-pr/SKILL.md',
    ].join('\n')

    expect(parseMovedBodies(output)).toEqual([
      { name: 'git-commit', commit: FIRST },
      { name: 'git-pr', commit: FIRST },
    ])
  })

  it('should report the newest commit for a body rewritten twice', () => {
    const output = [
      SECOND,
      '',
      'claude/skills/git-commit/SKILL.md',
      '',
      FIRST,
      '',
      'claude/skills/git-commit/SKILL.md',
    ].join('\n')

    expect(parseMovedBodies(output)).toEqual([
      { name: 'git-commit', commit: SECOND },
    ])
  })

  it('should sort entries by skill name', () => {
    const output = [
      FIRST,
      '',
      'claude/skills/git-pr/SKILL.md',
      'claude/skills/bash-script/SKILL.md',
      'claude/skills/context-fold/SKILL.md',
    ].join('\n')

    expect(parseMovedBodies(output).map((entry) => entry.name)).toEqual([
      'bash-script',
      'context-fold',
      'git-pr',
    ])
  })

  it('should ignore a reference file beside the body', () => {
    const output = [
      FIRST,
      '',
      'claude/skills/role-orchestrator/references/orchestrator-poll.md',
      'claude/skills/git-commit/SKILL.md',
    ].join('\n')

    expect(parseMovedBodies(output).map((entry) => entry.name)).toEqual([
      'git-commit',
    ])
  })

  it('should ignore a requirement file beside the body', () => {
    const output = [FIRST, '', 'claude/skills/git-commit/REQUIREMENT.md'].join(
      '\n',
    )

    expect(parseMovedBodies(output)).toEqual([])
  })

  it('should ignore a body in the internal corpus', () => {
    const output = [FIRST, '', '.claude/skills/internal-scripts/SKILL.md'].join(
      '\n',
    )

    expect(parseMovedBodies(output)).toEqual([])
  })

  it('should ignore a path listed before any commit line', () => {
    const output = ['claude/skills/git-commit/SKILL.md'].join('\n')

    expect(parseMovedBodies(output)).toEqual([])
  })

  it('should return an empty list for output with no commits', () => {
    expect(parseMovedBodies('')).toEqual([])
  })
})

describe('readDrift', () => {
  it('should name the absent corpus when the tree ships no skills', () => {
    const report = readDrift(root, 'HEAD')

    expect(report.kind).toBe('unreadable')
    expect(report.kind === 'unreadable' && report.reason).toContain(
      'claude/skills',
    )
  })

  it('should name the missing history rather than reporting nothing moved', () => {
    skillsRoot()

    const report = readDrift(root, 'HEAD')

    expect(report.kind).toBe('unreadable')
    expect(report.kind === 'unreadable' && report.reason).toContain(
      'No git history',
    )
  })
})
