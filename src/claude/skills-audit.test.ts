import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  auditExitCode,
  auditSkills,
  BULLET_LEDGER_SKILLS,
  DESCRIPTION_LIMIT,
  EXIT_MISSING_REQUIREMENT,
  LEDGER_SKILLS,
  PRACTICE_SECTIONS,
  PRACTICE_SKILLS,
  SKILL_LEDGERS,
  skillLedgerPath,
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

describe('auditSkills requirement limits', () => {
  const requirementPath = join(
    'claude',
    'skills',
    'git-commit',
    'REQUIREMENT.md',
  )

  function skillWithRequirement(requirement: string): void {
    const dir = conformingSkill('git-commit')
    writeFileSync(join(dir, 'REQUIREMENT.md'), requirement)
  }

  function bullets(count: number): string {
    return Array.from(
      { length: count },
      (_, index) => `- Item ${index}\n`,
    ).join('')
  }

  it('should pass the worked example in the standard', async () => {
    const standard = readFileSync(
      join(
        import.meta.dirname,
        '..',
        '..',
        'claude',
        'skills',
        'create-skill',
        'references',
        'skill-requirement.md',
      ),
      'utf8',
    )
    const example =
      /### Worked example[\s\S]*?```markdown\n([\s\S]*?)\n```/.exec(
        standard,
      )?.[1]
    expect(example).toContain('## Must')
    skillWithRequirement(`${example}\n`)

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([])
    expect(report.requirementSections).toEqual([])
  })

  it('should stay silent when Must not and Out of scope are absent', async () => {
    skillWithRequirement(
      '# Requirement\n\n## Gap\n\nFails.\n\n## Must\n\n- Do\n',
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([])
  })

  it('should report a list past 5 bullets', async () => {
    skillWithRequirement(
      `# Requirement\n\n## Gap\n\nFails.\n\n## Must\n\n${bullets(6)}`,
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([
      { rel: requirementPath, detail: '## Must: 6 bullets, cap 5' },
    ])
  })

  it('should pass a list of exactly 5 bullets', async () => {
    skillWithRequirement(
      `# Requirement\n\n## Gap\n\nFails.\n\n## Must\n\n${bullets(5)}`,
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([])
  })

  it('should leave a nested bullet out of the count', async () => {
    skillWithRequirement(
      `# Requirement\n\n## Gap\n\nFails.\n\n## Must\n\n${bullets(5)}  - Nested\n`,
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([])
  })

  it('should report a body past 400 words', async () => {
    skillWithRequirement(
      `# Requirement\n\n## Gap\n\n${'word '.repeat(400)}\n\n## Must\n\n- Do\n`,
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([
      { rel: requirementPath, detail: '404 words, cap 400' },
    ])
  })

  it('should leave frontmatter out of the word count', async () => {
    skillWithRequirement(
      `---\nname: git-commit\ndescription: ${'word '.repeat(50)}\n---\n\n# Requirement\n\n## Gap\n\n${'word '.repeat(380)}\n\n## Must\n\n- Do\n`,
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([])
  })

  it('should report a date in Gap', async () => {
    skillWithRequirement(
      '# Requirement\n\n## Gap\n\nA worker lost its branch on 2026-08-27.\n\n## Must\n\n- Do\n',
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([
      { rel: requirementPath, detail: 'line 5: 2026-08-27 in Gap' },
    ])
  })

  it('should report an issue number in Gap', async () => {
    skillWithRequirement(
      '# Requirement\n\n## Gap\n\nThe worker in #2412 lost its branch.\n\n## Must\n\n- Do\n',
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([
      { rel: requirementPath, detail: 'line 5: #2412 in Gap' },
    ])
  })

  it('should stay silent on a date inside a code span in Gap', async () => {
    skillWithRequirement(
      '# Requirement\n\n## Gap\n\nA session writes `2026-08-27` where `#12` belongs.\n\n## Must\n\n- Do\n',
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([])
  })

  it('should stay silent on a date outside Gap', async () => {
    skillWithRequirement(
      '# Requirement\n\n## Gap\n\nFails.\n\n## Must\n\n- Dates read as 2026-08-27 and cite #12\n',
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([])
  })

  it('should report a Guards section', async () => {
    skillWithRequirement(
      '# Requirement\n\n## Gap\n\nFails.\n\n## Must\n\n- Do\n\n## Guards\n\n- Refuse\n',
    )

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([
      {
        rel: requirementPath,
        detail: '## Guards: retired, fold it into Must not',
      },
    ])
  })

  it('should stay silent when the requirement is absent', async () => {
    const dir = skillDir('git-commit')
    writeFileSync(join(dir, 'SKILL.md'), frontmatter('git-commit', 'Commits'))

    const report = await auditSkills(root)

    expect(report.requirementLimits).toEqual([])
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

describe('auditSkills reference contents', () => {
  /** A reference of exactly `lines` lines, its body padded below `head`. */
  function referenceOf(lines: number, head = '# Reference\n'): string {
    const headLines = head.replace(/\n$/, '').split('\n').length
    return `${head}${'- Line\n'.repeat(lines - headLines)}`
  }

  function skillWithReference(text: string): string {
    const dir = conformingSkill('git-commit')
    mkdirSync(join(dir, 'references'), { recursive: true })
    writeFileSync(join(dir, 'references', 'long.md'), text)
    return dir
  }

  const referenceRel = join(
    'claude',
    'skills',
    'git-commit',
    'references',
    'long.md',
  )

  it('should report a reference over 100 lines carrying no contents list', async () => {
    skillWithReference(referenceOf(101))

    const report = await auditSkills(root)

    expect(report.referenceContents).toEqual([
      { rel: referenceRel, detail: '101 lines, no ## Contents' },
    ])
  })

  it('should stay silent on a long reference opening with a contents list', async () => {
    skillWithReference(
      referenceOf(101, '# Reference\n\n## Contents\n\n- [Part](#part)\n'),
    )

    const report = await auditSkills(root)

    expect(report.referenceContents).toEqual([])
  })

  it('should stay silent on a reference of exactly 100 lines', async () => {
    skillWithReference(referenceOf(100))

    const report = await auditSkills(root)

    expect(report.referenceContents).toEqual([])
  })

  it('should read a contents heading under H3 as absent', async () => {
    skillWithReference(referenceOf(101, '# Reference\n\n### Contents\n'))

    const report = await auditSkills(root)

    expect(report.referenceContents).toHaveLength(1)
  })

  it('should read a contents heading inside a fenced block as absent', async () => {
    skillWithReference(
      referenceOf(101, '# Reference\n\n```markdown\n## Contents\n```\n'),
    )

    const report = await auditSkills(root)

    expect(report.referenceContents).toHaveLength(1)
  })

  it('should stay silent on a long SKILL.md', async () => {
    const dir = conformingSkill('git-commit')
    writeFileSync(
      join(dir, 'SKILL.md'),
      `${frontmatter('git-commit', 'Commits')}${'- Line\n'.repeat(120)}`,
    )

    const report = await auditSkills(root)

    expect(report.referenceContents).toEqual([])
  })
})

const CLOSING = PRACTICE_SECTIONS.map((section) => `## ${section}\n\n- Do\n`)

// A skill on the per-bullet list owes ledgers its fixture never writes, so the
// varied skill is the first practice skill off that list.
const varied =
  PRACTICE_SKILLS.find((rel) => !(rel in BULLET_LEDGER_SKILLS)) ?? ''

const LINKED_LEDGER =
  '# Adopted\n\n[A source](https://example.com/source) states the rule.\n'

function practiceSkill(
  sections: readonly string[],
  {
    name = basename(varied),
    corpus = 'claude',
    hasLedger = true,
    ledger = LINKED_LEDGER,
  } = {},
): string {
  const dir = conformingSkill(name, corpus)
  writeFileSync(
    join(dir, 'SKILL.md'),
    `${frontmatter(name, 'Applies a practice')}\n${sections.join('\n')}`,
  )
  if (hasLedger) {
    mkdirSync(join(dir, 'references'), { recursive: true })
    writeFileSync(join(dir, 'references', 'adopted.md'), ledger)
  }
  return dir
}

/**
 * Writes a conforming fixture for every listed skill but the one a test
 * varies, so an append to the list needs no edit here. Each exempted reference
 * is written so its exemption names a real file, and a listed body gets a
 * row-free ledger.
 */
function listedPracticeSkillsExcept(omitted: string): void {
  for (const rel of LEDGER_SKILLS.filter((rel) => rel !== omitted)) {
    const name = basename(rel)
    const dir = practiceSkill(CLOSING, { name })
    const scope = BULLET_LEDGER_SKILLS[rel]
    for (const file of scope?.exempt ?? []) {
      mkdirSync(dirname(join(dir, file)), { recursive: true })
      writeFileSync(join(dir, file), '# Reference\n')
    }
    if (scope?.body) {
      const ledger = join(root, skillLedgerPath(name, 'SKILL.md'))
      mkdirSync(dirname(ledger), { recursive: true })
      writeFileSync(ledger, '# Ledger\n')
    }
  }
}

describe('auditSkills ledger list', () => {
  // A per-bullet scope with no body and no exemption owes no ledger a bare
  // fixture lacks, so it varies as cleanly as an unlisted skill once every
  // ledger-only skill has moved onto the per-bullet list.
  const ledgerOnly =
    LEDGER_SKILLS.find((rel) => {
      if (PRACTICE_SKILLS.includes(rel)) return false
      const scope = BULLET_LEDGER_SKILLS[rel]
      return scope === undefined || (!scope.body && scope.exempt.length === 0)
    }) ?? ''

  beforeEach(() => {
    listedPracticeSkillsExcept(ledgerOnly)
  })

  it('should report a ledger-listed skill carrying no ledger', async () => {
    practiceSkill([], { name: basename(ledgerOnly), hasLedger: false })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      {
        rel: ledgerOnly,
        detail: `missing ledger: ${join('references', 'adopted.md')}`,
      },
    ])
    expect(report.referenceContents).toEqual([])
  })

  it('should not read the closing sections on a ledger-listed skill', async () => {
    practiceSkill([], { name: basename(ledgerOnly) })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should report a ledger-listed skill whose folder the shipped corpus lacks', async () => {
    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      {
        rel: ledgerOnly,
        detail: 'missing skill: no folder under the shipped corpus',
      },
    ])
  })
})

describe('auditSkills practice list', () => {
  it('should report a listed skill whose folder the shipped corpus lacks', async () => {
    conformingSkill('git-commit')
    listedPracticeSkillsExcept(varied)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      {
        rel: varied,
        detail: 'missing skill: no folder under the shipped corpus',
      },
    ])
  })

  it('should stay silent on a same-named skill outside the shipped corpus', async () => {
    practiceSkill([], { corpus: '.claude', hasLedger: false })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })
})

describe('auditSkills practice shape', () => {
  const [excuses = '', redFlags = '', handover = ''] = CLOSING

  beforeEach(() => {
    listedPracticeSkillsExcept(varied)
  })

  const skillRel = varied

  it('should report nothing on a listed skill carrying every section and a ledger', async () => {
    practiceSkill(CLOSING)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it.each([
    ['Excuses and rebuttals', [redFlags, handover]],
    ['Red flags', [excuses, handover]],
    ['Before handing over', [excuses, redFlags]],
  ])('should name the missing %s section', async (section, present) => {
    practiceSkill(present)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: skillRel, detail: `missing section: ${section}` },
    ])
  })

  it('should report a listed skill carrying no ledger', async () => {
    practiceSkill(CLOSING, { hasLedger: false })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      {
        rel: skillRel,
        detail: `missing ledger: ${join('references', 'adopted.md')}`,
      },
    ])
  })

  it('should read a section under H3 as missing', async () => {
    practiceSkill([excuses, redFlags, '### Before handing over\n'])

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: skillRel, detail: 'missing section: Before handing over' },
    ])
  })

  it('should read a heading carrying trailing text as missing', async () => {
    practiceSkill([excuses, '## Red flags that mean start over\n', handover])

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: skillRel, detail: 'missing section: Red flags' },
    ])
  })

  it('should read a heading inside a fenced block as missing', async () => {
    practiceSkill([
      excuses,
      redFlags,
      '```markdown\n## Before handing over\n```\n',
    ])

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: skillRel, detail: 'missing section: Before handing over' },
    ])
  })

  it('should stay silent on an unlisted skill missing every section', async () => {
    practiceSkill(CLOSING)
    conformingSkill('git-commit')

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })
})

describe('auditSkills reference ledgers', () => {
  const [[bulletLedgered] = ['']] = Object.entries(BULLET_LEDGER_SKILLS)
  const [
    [
      exempting,
      {
        exempt: [exempted = ''],
      },
    ] = ['', { exempt: [] }],
  ] = Object.entries(BULLET_LEDGER_SKILLS).filter(
    ([, scope]) => scope.exempt.length > 0,
  )
  const name = basename(bulletLedgered)
  const added = join('references', 'added-later.md')
  const reference = join(bulletLedgered, added)
  const ledgerRel = skillLedgerPath(name, added)

  const TABLE = '| Bullet | Source |\n| --- | --- |\n'
  const MATCHED = `# Ledger\n\n## Semantics\n\n${TABLE}| One | x |\n| Two | y |\n`

  function writeReference(text: string, skill = bulletLedgered): void {
    const path = join(root, skill, added)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }

  function writeLedger(text: string): void {
    mkdirSync(join(root, SKILL_LEDGERS, name), { recursive: true })
    writeFileSync(join(root, ledgerRel), text)
  }

  beforeEach(() => {
    listedPracticeSkillsExcept('')
    writeReference('# Accessibility\n\n## Semantics\n\n- One.\n- Two.\n')
  })

  it('should report a reference no list names carrying no ledger', async () => {
    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: reference, detail: `missing ledger: ${ledgerRel}` },
    ])
  })

  it('should report a ledger one row short under a heading', async () => {
    writeLedger(`# Ledger\n\n## Semantics\n\n${TABLE}| One | x |\n`)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: reference, detail: '## Semantics: 2 bullets, 1 ledger row' },
    ])
  })

  it('should pass a ledger matching every heading', async () => {
    writeLedger(MATCHED)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should ask no rows of a contents list', async () => {
    writeReference(
      '# Accessibility\n\n## Contents\n\n- [Semantics](#semantics)\n\n## Semantics\n\n- One.\n- Two.\n',
    )
    writeLedger(MATCHED)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should report an ordered step carrying no row', async () => {
    writeReference(
      '# Accessibility\n\n## Semantics\n\n- One.\n- Two.\n1. Three.\n',
    )
    writeLedger(MATCHED)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: reference, detail: '## Semantics: 3 bullets, 2 ledger rows' },
    ])
  })

  it('should ask a table of a heading holding only ordered steps', async () => {
    writeReference(
      '# Accessibility\n\n## Semantics\n\n- One.\n- Two.\n\n## Steps\n\n1. Expand.\n   - A nested note.\n2. Contract.\n',
    )
    writeLedger(MATCHED)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: reference, detail: '## Steps: 2 bullets, 0 ledger rows' },
    ])
  })

  it('should ask no per-bullet ledger of the source record', async () => {
    writeLedger(MATCHED)
    writeFileSync(
      join(root, bulletLedgered, 'references', 'adopted.md'),
      `${LINKED_LEDGER}\n## Sources\n\n- A row.\n`,
    )

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should ask no ledger of an exempted reference', async () => {
    writeLedger(MATCHED)
    writeFileSync(
      join(root, exempting, exempted),
      '# Checklist\n\n## Before handing over\n\n- [ ] One.\n',
    )

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should report an exemption naming a file the skill lacks', async () => {
    writeLedger(MATCHED)
    rmSync(join(root, exempting, exempted))

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      {
        rel: join(exempting, exempted),
        detail: 'missing file: exempt from a ledger',
      },
    ])
  })
})

describe('auditSkills body ledgers', () => {
  const [[bodyListed] = ['']] = Object.entries(BULLET_LEDGER_SKILLS).filter(
    ([, scope]) => scope.body,
  )
  const name = basename(bodyListed)
  const body = join(bodyListed, 'SKILL.md')

  const TABLE = '| Bullet | Source |\n| --- | --- |\n'
  const DELEGATES = '## What this delegates\n\n- Layout: `codebase-layout`\n'

  function writeBody(groups: string): void {
    practiceSkill([groups, ...CLOSING, DELEGATES], { name })
  }

  function writeLedger(text: string): void {
    writeFileSync(join(root, skillLedgerPath(name, 'SKILL.md')), text)
  }

  beforeEach(() => {
    listedPracticeSkillsExcept('')
    writeBody('## Contract\n\n- One.\n- Two.\n')
  })

  it('should ask no rows of the closing sections or the delegates section', async () => {
    writeLedger(`# Ledger\n\n## Contract\n\n${TABLE}| One | x |\n| Two | y |\n`)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should report a concern group one row short', async () => {
    writeLedger(`# Ledger\n\n## Contract\n\n${TABLE}| One | x |\n`)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: body, detail: '## Contract: 2 bullets, 1 ledger row' },
    ])
  })

  it('should report a table under a closing section', async () => {
    writeLedger(
      `# Ledger\n\n## Contract\n\n${TABLE}| One | x |\n| Two | y |\n\n## Red flags\n\n${TABLE}| Do | z |\n`,
    )

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: body, detail: '## Red flags: 0 bullets, 1 ledger row' },
    ])
  })

  it('should count a bullet under an H3 toward its H2', async () => {
    writeBody('## Contract\n\n- One.\n\n### Errors\n\n- Two.\n- Three.\n')
    writeLedger(`# Ledger\n\n## Contract\n\n${TABLE}| One | x |\n| Two | y |\n`)

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      { rel: body, detail: '## Contract: 3 bullets, 2 ledger rows' },
    ])
  })
})

describe('auditSkills duplicate sources', () => {
  const [[bulletLedgered] = ['']] = Object.entries(BULLET_LEDGER_SKILLS)
  const name = basename(bulletLedgered)
  const added = join('references', 'added-later.md')
  const ledgerRel = skillLedgerPath(name, added)
  const adopted = join(bulletLedgered, 'references', 'adopted.md')

  const TABLE = '| Bullet | Source |\n| --- | --- |\n'

  function writeLedger(source: string): void {
    mkdirSync(join(root, SKILL_LEDGERS, name), { recursive: true })
    writeFileSync(
      join(root, ledgerRel),
      `# Ledger\n\n## Semantics\n\n${TABLE}| One | ${source} |\n`,
    )
  }

  function writeAdopted(text: string): void {
    writeFileSync(join(root, adopted), text)
  }

  beforeEach(() => {
    listedPracticeSkillsExcept('')
    const path = join(root, bulletLedgered, added)
    writeFileSync(path, '# Reference\n\n## Semantics\n\n- One.\n')
  })

  it('should report a source both the record and a ledger link', async () => {
    writeLedger('[A source](https://example.com/source)')

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      {
        rel: adopted,
        detail: `duplicate source: https://example.com/source in ${ledgerRel}`,
      },
    ])
  })

  it('should read a trailing slash and an anchor as the same source', async () => {
    writeLedger('[A source](https://example.com/source/#rule)')

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      {
        rel: adopted,
        detail: `duplicate source: https://example.com/source in ${ledgerRel}`,
      },
    ])
  })

  it('should read two commit pins as two sources', async () => {
    writeAdopted('# Adopted\n\n[Pinned](https://example.com/blob/aaa/a.md).\n')
    writeLedger('[Pinned](https://example.com/blob/bbb/a.md)')

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should pass a declined source no ledger cites', async () => {
    writeAdopted(
      '# Adopted\n\n## Declined\n\n[Declined](https://example.com/declined) was read and left out.\n',
    )
    writeLedger('[A source](https://example.com/source)')

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should pass a deduped record pointing at its ledger folder', async () => {
    writeAdopted(
      `# Adopted\n\nPer-bullet sources sit in \`${join(SKILL_LEDGERS, name)}/\`.\n`,
    )
    writeLedger('[A source](https://example.com/source)')

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should report a deduped record pointing at another skill’s ledger', async () => {
    writeAdopted(
      `# Adopted\n\nPer-bullet sources sit in \`${join(SKILL_LEDGERS, 'other-skill')}/\`.\n`,
    )
    writeLedger('[A source](https://example.com/source)')

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([
      {
        rel: bulletLedgered,
        detail: `ledger cites nothing: ${join('references', 'adopted.md')}`,
      },
    ])
  })
})

describe('skillLedgerPath', () => {
  it('should drop the references segment from a reference', () => {
    expect(
      skillLedgerPath('design-taste', join('references', 'craft.md')),
    ).toBe(join('governance', 'ledger', 'skills', 'design-taste', 'craft.md'))
  })

  it('should keep the name of a listed skill body', () => {
    expect(skillLedgerPath('api-design', 'SKILL.md')).toBe(
      join('governance', 'ledger', 'skills', 'api-design', 'SKILL.md'),
    )
  })
})

describe('auditSkills ledger contents', () => {
  const uncited = {
    rel: varied,
    detail: `ledger cites nothing: ${join('references', 'adopted.md')}`,
  }

  beforeEach(() => {
    listedPracticeSkillsExcept(varied)
  })

  it('should report a ledger carrying no link and no house choice', async () => {
    practiceSkill(CLOSING, { ledger: '# Adopted\n\nRead and filtered.\n' })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([uncited])
  })

  it('should pass a ledger carrying one link', async () => {
    practiceSkill(CLOSING, { ledger: LINKED_LEDGER })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should pass a ledger whose only row is a house choice', async () => {
    practiceSkill(CLOSING, {
      ledger:
        '# Adopted\n\n| Rule | Source |\n| --- | --- |\n| One ring | House choice: picked so it counts |\n',
    })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([])
  })

  it('should read a link inside a fenced block as no citation', async () => {
    practiceSkill(CLOSING, {
      ledger:
        '# Adopted\n\n```markdown\n[A source](https://example.com)\n```\n',
    })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([uncited])
  })

  it('should read a house choice inside a fenced block as no citation', async () => {
    practiceSkill(CLOSING, {
      ledger: '# Adopted\n\n```markdown\n| One ring | House choice: x |\n```\n',
    })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([uncited])
  })

  it('should read a link inside a code span as no citation', async () => {
    practiceSkill(CLOSING, {
      ledger: '# Adopted\n\nWrite `[label](https://example.com)` as a row.\n',
    })

    const report = await auditSkills(root)

    expect(report.practiceShape).toEqual([uncited])
  })
})

/** A conforming skill whose frontmatter carries `metadata` followed by `value`. */
function skillWithMetadata(value: string, corpus = 'claude'): void {
  const dir = conformingSkill('git-commit', corpus)
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---\nname: git-commit\ndescription: Commits\nmetadata:${value}\n---\n\n# Body\n`,
  )
}

describe('auditSkills family', () => {
  it('should report a shipped skill declaring no family', async () => {
    conformingSkill('git-commit')

    const report = await auditSkills(root)

    expect(report.family).toEqual([
      {
        rel: join('claude', 'skills', 'git-commit'),
        detail: 'frontmatter declares no metadata.family',
      },
    ])
  })

  it('should report a shipped skill whose family is not a vocabulary key', async () => {
    skillWithMetadata('\n  family: shipping')

    const report = await auditSkills(root)

    expect(report.family).toEqual([
      {
        rel: join('claude', 'skills', 'git-commit'),
        detail: 'unknown family: shipping',
      },
    ])
  })

  it('should report a shipped skill whose metadata is a string', async () => {
    skillWithMetadata(' ship')

    const report = await auditSkills(root)

    expect(report.family).toHaveLength(1)
  })

  it('should stay silent on a shipped skill declaring a vocabulary key', async () => {
    skillWithMetadata('\n  family: ship')

    const report = await auditSkills(root)

    expect(report.family).toEqual([])
  })

  it('should stay silent on an internal skill declaring no family', async () => {
    conformingSkill('internal-scripts', '.claude')

    const report = await auditSkills(root)

    expect(report.family).toEqual([])
  })

  it('should not fail the exit code on a family finding alone', async () => {
    conformingSkill('git-commit')

    expect(auditExitCode(await auditSkills(root))).toBe(0)
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

  it('should pass when only practice shape is reported', async () => {
    listedPracticeSkillsExcept(varied)
    conformingSkill(basename(varied))

    const report = await auditSkills(root)

    expect(report.practiceShape).toHaveLength(PRACTICE_SECTIONS.length + 1)
    expect(auditExitCode(report)).toBe(0)
  })

  it('should pass when only reference contents is reported', async () => {
    const dir = conformingSkill('git-commit')
    mkdirSync(join(dir, 'references'), { recursive: true })
    writeFileSync(
      join(dir, 'references', 'long.md'),
      `# Reference\n${'- Line\n'.repeat(120)}`,
    )

    const report = await auditSkills(root)

    expect(report.referenceContents).toHaveLength(1)
    expect(auditExitCode(report)).toBe(0)
  })

  it('should pass on a conforming corpus', async () => {
    conformingSkill('git-commit')

    expect(auditExitCode(await auditSkills(root))).toBe(0)
  })
})
