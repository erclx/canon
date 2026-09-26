import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listSkills } from '@/claude/skills-list'

let root: string

function skillFile(name: string, body: string): void {
  const dir = join(root, 'claude', 'skills', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), body)
}

function internalSkillFile(name: string, body: string): void {
  const dir = join(root, '.claude', 'skills', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), body)
}

function requirementFile(name: string): void {
  const dir = join(root, 'claude', 'skills', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'REQUIREMENT.md'), '# Requirement\n')
}

function frontmatter(name: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# Body\n`
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-skills-list-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('listSkills', () => {
  it('should map each skill to its folder name and frontmatter description', () => {
    skillFile('git-commit', frontmatter('git-commit', 'Writes a commit'))

    expect(listSkills(root)).toEqual([
      {
        name: 'git-commit',
        description: 'Writes a commit',
        requirement: false,
      },
    ])
  })

  it('should sort entries by folder name', () => {
    skillFile('git-pr', frontmatter('git-pr', 'Opens a pull request'))
    skillFile('bash-script', frontmatter('bash-script', 'Writes a script'))
    skillFile('context-fold', frontmatter('context-fold', 'Syncs docs'))

    expect(listSkills(root).map((entry) => entry.name)).toEqual([
      'bash-script',
      'context-fold',
      'git-pr',
    ])
  })

  it('should exclude internal skills that never install into a target', () => {
    skillFile('git-commit', frontmatter('git-commit', 'Writes a commit'))
    internalSkillFile(
      'internal-scripts',
      frontmatter('internal-scripts', 'Internal'),
    )

    expect(listSkills(root).map((entry) => entry.name)).toEqual(['git-commit'])
  })

  it('should prefer the folder name when the frontmatter name disagrees', () => {
    skillFile('git-commit', frontmatter('renamed-in-frontmatter', 'Commits'))

    expect(listSkills(root)[0]?.name).toBe('git-commit')
  })

  it('should return an empty description when frontmatter is absent', () => {
    skillFile('git-commit', '# Body with no frontmatter\n')

    expect(listSkills(root)).toEqual([
      { name: 'git-commit', description: '', requirement: false },
    ])
  })

  it('should keep the rest of the catalog when one skill has unparseable frontmatter', () => {
    skillFile('broken', '---\ndescription: "unterminated\n---\n\n# Body\n')
    skillFile('git-commit', frontmatter('git-commit', 'Writes a commit'))

    expect(listSkills(root)).toEqual([
      { name: 'broken', description: '', requirement: false },
      {
        name: 'git-commit',
        description: 'Writes a commit',
        requirement: false,
      },
    ])
  })

  it('should ignore a nested SKILL.md below the skill folder level', () => {
    skillFile('git-commit', frontmatter('git-commit', 'Writes a commit'))
    const nested = join(root, 'claude', 'skills', 'git-commit', 'references')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'SKILL.md'), frontmatter('nested', 'Nested'))

    expect(listSkills(root).map((entry) => entry.name)).toEqual(['git-commit'])
  })

  it('should report a requirement when the skill folder carries one', () => {
    skillFile('git-commit', frontmatter('git-commit', 'Writes a commit'))
    requirementFile('git-commit')

    expect(listSkills(root)[0]?.requirement).toBe(true)
  })

  it('should not report a requirement from a sibling skill folder', () => {
    skillFile('git-commit', frontmatter('git-commit', 'Writes a commit'))
    skillFile('git-pr', frontmatter('git-pr', 'Opens a pull request'))
    requirementFile('git-pr')

    expect(
      listSkills(root).map((entry) => [entry.name, entry.requirement]),
    ).toEqual([
      ['git-commit', false],
      ['git-pr', true],
    ])
  })

  it('should return an empty list when no skills directory exists', () => {
    expect(listSkills(root)).toEqual([])
  })
})
