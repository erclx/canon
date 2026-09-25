import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  auditExitCode,
  auditSkills,
  DESCRIPTION_LIMIT,
  EXIT_MISSING_REQUIREMENT,
} from '@/claude/skills-audit'

let root: string

const REQUIREMENT =
  '# Skill requirement\n\n## Gap\n\nFails.\n\n## Must\n\n- Do\n'

function frontmatter(name: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# Body\n`
}

function skillDir(name: string, corpus = 'claude'): string {
  const dir = join(root, corpus, 'skills', name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function conformingSkill(name: string, corpus = 'claude'): string {
  const dir = skillDir(name, corpus)
  writeFileSync(join(dir, 'SKILL.md'), frontmatter(name, 'Does a thing'))
  writeFileSync(join(dir, 'REQUIREMENT.md'), REQUIREMENT)
  return dir
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-skills-audit-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('auditSkills', () => {
  it('should report no finding against a conforming skill', async () => {
    conformingSkill('git-commit')

    const report = await auditSkills(root)

    expect(report).toMatchObject({
      skills: 1,
      missingRequirement: [],
      readme: [],
      folderName: [],
      missingDescription: [],
      nameMismatch: [],
      longDescription: [],
      requirementSections: [],
      datedProvenance: [],
    })
  })

  it('should measure both corpora and name each in scope', async () => {
    conformingSkill('git-commit')
    conformingSkill('internal-scripts', '.claude')

    const report = await auditSkills(root)

    expect(report.corpora).toEqual([
      { rel: join('claude', 'skills'), skills: 1 },
      { rel: join('.claude', 'skills'), skills: 1 },
    ])
    expect(report.skills).toBe(2)
  })

  it('should skip a corpus the project does not carry', async () => {
    conformingSkill('internal-scripts', '.claude')

    const report = await auditSkills(root)

    expect(report.corpora).toEqual([
      { rel: join('.claude', 'skills'), skills: 1 },
    ])
  })

  it('should report a skill folder carrying no requirement', async () => {
    const dir = skillDir('git-commit')
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('git-commit', 'Commits'))

    const report = await auditSkills(root)

    expect(report.missingRequirement).toEqual([
      join('claude', 'skills', 'git-commit'),
    ])
  })

  it('should report a frontmatter name disagreeing with the folder', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('renamed', 'Commits'))

    const report = await auditSkills(root)

    expect(report.nameMismatch).toEqual([
      {
        rel: join('claude', 'skills', 'git-commit'),
        detail: 'frontmatter name: renamed',
      },
    ])
  })

  it('should report a body whose frontmatter declares no name', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\ndescription: Commits\n---\n\n# Body\n',
    )

    const report = await auditSkills(root)

    expect(report.nameMismatch).toEqual([
      {
        rel: join('claude', 'skills', 'git-commit'),
        detail: 'frontmatter declares no name',
      },
    ])
  })

  it('should report a body declaring no description', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\nname: git-commit\n---\n\n# Body\n',
    )

    const report = await auditSkills(root)

    expect(report.missingDescription).toEqual([
      join('claude', 'skills', 'git-commit'),
    ])
  })

  it('should read a blank description as absent rather than as present', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('git-commit', "''"))

    const report = await auditSkills(root)

    expect(report.missingDescription).toEqual([
      join('claude', 'skills', 'git-commit'),
    ])
  })

  it('should report a description past the character ceiling', async () => {
    const dir = conformingSkill('git-commit')
    const long = 'a'.repeat(DESCRIPTION_LIMIT + 1)
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('git-commit', long))

    const report = await auditSkills(root)

    expect(report.longDescription).toEqual([
      {
        rel: join('claude', 'skills', 'git-commit'),
        detail: `${DESCRIPTION_LIMIT + 1} characters`,
      },
    ])
  })

  it('should leave a description at the ceiling unreported', async () => {
    const dir = conformingSkill('git-commit')
    const exact = 'a'.repeat(DESCRIPTION_LIMIT)
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('git-commit', exact))

    const report = await auditSkills(root)

    expect(report.longDescription).toEqual([])
  })

  it('should report a README beside the skill body', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(join(dir, 'README.md'), '# Readme\n')

    const report = await auditSkills(root)

    expect(report.readme).toEqual([join('claude', 'skills', 'git-commit')])
  })

  it('should report a folder name outside kebab-case', async () => {
    conformingSkill('Git_Commit')

    const report = await auditSkills(root)

    expect(report.folderName).toEqual([join('claude', 'skills', 'Git_Commit')])
  })

  it('should report a requirement short of a declared section', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'REQUIREMENT.md'),
      '# Requirement\n\n## Gap\n\nFails.\n',
    )

    const report = await auditSkills(root)

    expect(report.requirementSections).toEqual([
      {
        rel: join('claude', 'skills', 'git-commit', 'REQUIREMENT.md'),
        detail: 'missing: Must',
      },
    ])
  })

  it('should not accept a Must not heading in place of Must', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'REQUIREMENT.md'),
      '# Requirement\n\n## Gap\n\nFails.\n\n## Must not\n\n- Do not\n',
    )

    const report = await auditSkills(root)

    expect(report.requirementSections[0]?.detail).toBe('missing: Must')
  })

  it('should stay silent on section shape when the requirement is absent', async () => {
    const dir = skillDir('git-commit')
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('git-commit', 'Commits'))

    const report = await auditSkills(root)

    expect(report.requirementSections).toEqual([])
  })

  it('should keep measuring the corpus when one body has unparseable frontmatter', async () => {
    const dir = conformingSkill('broken')
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\ndescription: "unterminated\n---\n\n# Body\n',
    )
    conformingSkill('git-commit')

    const report = await auditSkills(root)

    expect(report.skills).toBe(2)
    expect(report.missingDescription).toEqual([
      join('claude', 'skills', 'broken'),
    ])
  })

  it('should ignore a nested SKILL.md below the skill folder level', async () => {
    conformingSkill('git-commit')
    const nested = join(root, 'claude', 'skills', 'git-commit', 'references')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'SKILL.md'), frontmatter('nested', 'Nested'))

    const report = await auditSkills(root)

    expect(report.skills).toBe(1)
  })

  it('should return an empty scope when neither corpus exists', async () => {
    const report = await auditSkills(root)

    expect(report.corpora).toEqual([])
    expect(report.skills).toBe(0)
  })
})

describe('auditSkills dated provenance', () => {
  function skillWithBody(body: string): string {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'SKILL.md'),
      `${frontmatter('git-commit', 'Commits')}\n${body}`,
    )
    return dir
  }

  const skillPath = join('claude', 'skills', 'git-commit', 'SKILL.md')

  it('should report a date in body prose', async () => {
    skillWithBody('A worker lost its branch on 2026-08-27.\n')

    const report = await auditSkills(root)

    expect(report.datedProvenance).toEqual([
      { rel: skillPath, detail: 'line 8: 2026-08-27' },
    ])
  })

  it('should report a date after a measurement stamp', async () => {
    skillWithBody('Measured on 2026-09-01 across the corpus.\n')

    const report = await auditSkills(root)

    expect(report.datedProvenance).toEqual([
      { rel: skillPath, detail: 'line 8: 2026-09-01' },
    ])
  })

  it('should stay silent on a date inside a fenced block', async () => {
    skillWithBody('```yaml\n---\ncreated: 2026-08-27\n---\n```\n')

    const report = await auditSkills(root)

    expect(report.datedProvenance).toEqual([])
  })

  it('should stay silent on a date inside a code span', async () => {
    skillWithBody('Write the date as `2026-08-27` in the header.\n')

    const report = await auditSkills(root)

    expect(report.datedProvenance).toEqual([])
  })

  it('should stay silent on a date in the skill frontmatter', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\nname: git-commit\ndescription: Commits\nupdated: 2026-08-27\n---\n\n# Body\n',
    )

    const report = await auditSkills(root)

    expect(report.datedProvenance).toEqual([])
  })

  it('should report a date in a nested reference with its path', async () => {
    const dir = conformingSkill('git-commit')
    mkdirSync(join(dir, 'references', 'deep'), { recursive: true })
    writeFileSync(
      join(dir, 'references', 'deep', 'notes.md'),
      '# Notes\n\nLearned from a target, 2026-07-04.\n',
    )

    const report = await auditSkills(root)

    expect(report.datedProvenance).toEqual([
      {
        rel: join(
          'claude',
          'skills',
          'git-commit',
          'references',
          'deep',
          'notes.md',
        ),
        detail: 'line 3: 2026-07-04',
      },
    ])
  })

  it('should stay silent on a date in the requirement', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'REQUIREMENT.md'),
      `${REQUIREMENT}\nObserved on 2026-08-27.\n`,
    )

    const report = await auditSkills(root)

    expect(report.datedProvenance).toEqual([])
  })
})

describe('auditExitCode', () => {
  it('should fail on a missing requirement', async () => {
    const dir = skillDir('git-commit')
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('git-commit', 'Commits'))

    expect(auditExitCode(await auditSkills(root))).toBe(
      EXIT_MISSING_REQUIREMENT,
    )
  })

  it('should pass on reported findings that are not a missing requirement', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('renamed', 'Commits'))
    writeFileSync(join(dir, 'README.md'), '# Readme\n')

    const report = await auditSkills(root)

    expect(report.nameMismatch).toHaveLength(1)
    expect(report.readme).toHaveLength(1)
    expect(auditExitCode(report)).toBe(0)
  })

  it('should pass when only dated provenance is reported', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'SKILL.md'),
      `${frontmatter('git-commit', 'Commits')}\nFixed on 2026-08-27.\n`,
    )

    const report = await auditSkills(root)

    expect(report.datedProvenance).toHaveLength(1)
    expect(auditExitCode(report)).toBe(0)
  })

  it('should pass on a conforming corpus', async () => {
    conformingSkill('git-commit')

    expect(auditExitCode(await auditSkills(root))).toBe(0)
  })
})
