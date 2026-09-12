import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { linesOutsideFences } from '@/markdown/scan'
import {
  checkItems,
  checkMemory,
  checkPlan,
  checkStandard,
  type Finding,
  type FindingKind,
  hasStagedBatches,
  isRecordKind,
  isSharedScratch,
  pathWords,
  readQuestions,
  type RecordKind,
  recordDirs,
  recordsDir,
  preferredMarker,
  splitPlanSections,
  validateRecords,
} from '@/records/validate'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-records-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function kinds(findings: readonly Finding[]): FindingKind[] {
  return findings.map((found) => found.kind)
}

function conformingPlan(): string {
  return [
    '# Feature: A standard owns the plan format',
    '',
    'One paragraph on what is being built.',
    '',
    '## Summary',
    '',
    '- The goal',
    '',
    '**Files to touch:**',
    '',
    '- `standards/plan.md`: the sections and the answer contract',
    '',
    '**Risks:**',
    '',
    'None identified.',
    '',
    '**Questions:**',
    '',
    '1. Which check reaches a gitignored folder?',
    '   - Suggested: a validate verb, since it reports without writing',
    '   - Answer:',
    '',
  ].join('\n')
}

async function seedPlan(name: string, body: string): Promise<void> {
  const dir = recordsDir(ROOT, 'plans')
  mkdirSync(dir, { recursive: true })
  await writeFile(join(dir, name), body)
}

async function seedFolder(
  kind: Exclude<RecordKind, 'plans'>,
  slug: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  const dir = join(recordsDir(ROOT, kind), slug)
  mkdirSync(dir, { recursive: true })

  await Promise.all(
    Object.entries(files).map(([name, body]) =>
      writeFile(join(dir, name), body),
    ),
  )
}

function frontmatter(fields: string): string {
  return ['---', fields, '---', '', '# Heading', ''].join('\n')
}

function conformingStandard(governs: string): string {
  return [
    '---',
    'title: Plan reference',
    'description: One line naming what this standard covers',
    '---',
    '',
    '# Plan reference',
    '',
    '## Scope',
    '',
    `Governs a feature plan under \`${governs}\`: the filename and the sections.`,
    '',
    'Does not govern:',
    '',
    '- The voice it is written in: `prose.md`',
    '',
    '## Frontmatter',
    '',
    '- `title` (required): names the doc type',
    '',
  ].join('\n')
}

async function seedStandard(name: string, body: string): Promise<void> {
  const dir = recordsDir(ROOT, 'standards')
  mkdirSync(dir, { recursive: true })
  await writeFile(join(dir, name), body)
}

describe('isRecordKind', () => {
  it('should accept every published kind and reject anything else', () => {
    expect(isRecordKind('plans')).toBe(true)
    expect(isRecordKind('groundwork')).toBe(true)
    expect(isRecordKind('intake')).toBe(true)
    expect(isRecordKind('memory')).toBe(true)
    expect(isRecordKind('standards')).toBe(true)
    expect(isRecordKind('teach')).toBe(true)
    expect(isRecordKind('review')).toBe(false)
  })
})

describe('isSharedScratch', () => {
  it('should hold for every gitignored record folder', () => {
    expect(isSharedScratch('plans')).toBe(true)
    expect(isSharedScratch('groundwork')).toBe(true)
    expect(isSharedScratch('intake')).toBe(true)
    expect(isSharedScratch('memory')).toBe(true)
    expect(isSharedScratch('teach')).toBe(true)
  })

  it('should not hold for the tracked corpus', () => {
    expect(isSharedScratch('standards')).toBe(false)
  })
})

describe('recordsDir', () => {
  it('should prefer the authoring root over the installed copy for standards', () => {
    mkdirSync(join(ROOT, '.claude', 'standards'), { recursive: true })
    mkdirSync(join(ROOT, 'standards'), { recursive: true })

    expect(recordsDir(ROOT, 'standards')).toBe(join(ROOT, 'standards'))
  })

  it('should fall through to the installed copy when no authoring root exists', () => {
    mkdirSync(join(ROOT, '.claude', 'standards'), { recursive: true })

    expect(recordsDir(ROOT, 'standards')).toBe(
      join(ROOT, '.claude', 'standards'),
    )
  })

  it('should name both candidate folders for standards', () => {
    expect(recordDirs(ROOT, 'standards')).toEqual([
      join(ROOT, 'standards'),
      join(ROOT, '.claude', 'standards'),
    ])
  })

  it('should read a record kind at the new root when it carries the folder', () => {
    mkdirSync(join(ROOT, '.canon', 'plans'), { recursive: true })

    expect(recordsDir(ROOT, 'plans')).toBe(join(ROOT, '.canon', 'plans'))
  })

  it('should read a record kind at the old root when the new one is absent', () => {
    mkdirSync(join(ROOT, '.claude', 'plans'), { recursive: true })

    expect(recordsDir(ROOT, 'plans')).toBe(join(ROOT, '.claude', 'plans'))
  })

  it('should stand the creation default in for a record kind neither root carries', () => {
    expect(recordsDir(ROOT, 'plans')).toBe(join(ROOT, '.canon', 'plans'))
  })

  it('should name both record roots for a record kind', () => {
    expect(recordDirs(ROOT, 'memory')).toEqual([
      join(ROOT, '.canon', 'memory'),
      join(ROOT, '.claude', 'memory'),
    ])
  })
})

describe('pathWords', () => {
  it('should offer the prefix of a placeholder filename', () => {
    expect(pathWords('.claude/tasks/session-<slug>.md')).toEqual([
      'tasks',
      'session',
    ])
  })

  it('should offer nothing from a dotted container segment', () => {
    expect(pathWords('.claude/rules/')).toEqual(['rules'])
  })
})

describe('checkStandard', () => {
  it('should report nothing on a standard named for its governed path', () => {
    expect(
      checkStandard(
        'plan.md',
        conformingStandard('.claude/plans/feature-<slug>.md'),
      ),
    ).toEqual([])
  })

  it('should accept the singular of a plural path segment', () => {
    expect(
      checkStandard('standard.md', conformingStandard('standards/')),
    ).toEqual([])
  })

  it('should report a filename naming no part of the governed path', () => {
    const findings = checkStandard(
      'session-map.md',
      conformingStandard('.claude/tasks/session-<slug>.md'),
    )

    expect(kinds(findings)).toEqual(['name-malformed'])
  })

  it('should exempt an attribute standard from the filename derivation', () => {
    const body = [
      '---',
      'title: Slug reference',
      'description: One line naming what this standard covers',
      '---',
      '',
      '## Scope',
      '',
      'Governs the transform from a branch name to a slug. It is an attribute standard rather than a document-type one.',
      '',
      'Does not govern:',
      '',
      '- The format of the branch name: `branch.md`',
      '',
    ].join('\n')

    expect(checkStandard('slug.md', body)).toEqual([])
  })

  it('should report a statement backticking no path and claiming no attribute', () => {
    const body = [
      '---',
      'title: Plan reference',
      'description: One line naming what this standard covers',
      '---',
      '',
      '## Scope',
      '',
      'Governs the feature plans a session writes.',
      '',
      'Does not govern:',
      '',
      '- The voice it is written in: `prose.md`',
      '',
    ].join('\n')

    expect(kinds(checkStandard('plan.md', body))).toEqual(['scope-unanchored'])
  })

  it('should report an absent scope section without also reporting the name', () => {
    const body = [
      '---',
      'title: Plan reference',
      'description: One line naming what this standard covers',
      '---',
      '',
      '## Frontmatter',
      '',
      '- `title` (required): names the doc type',
      '',
    ].join('\n')
    const findings = checkStandard('anything.md', body)

    expect(findings).toEqual([
      {
        kind: 'section-missing',
        record: 'anything.md',
        subject: '## Scope',
        message:
          'is absent, so the standard claims no jurisdiction and can refuse no rule.',
      },
    ])
  })

  it('should report a scope section carrying no handoff list', () => {
    const body = conformingStandard('.claude/plans/feature-<slug>.md').replace(
      'Does not govern:',
      'Nothing else applies:',
    )
    const findings = checkStandard('plan.md', body)

    expect(findings[0]).toMatchObject({
      kind: 'section-missing',
      subject: 'Does not govern:',
    })
  })

  it('should report a standard missing both frontmatter fields', () => {
    const body = conformingStandard('.claude/plans/feature-<slug>.md').replace(
      'title: Plan reference\ndescription: One line naming what this standard covers',
      'subtitle: Plan',
    )

    expect(checkStandard('plan.md', body)[0]).toMatchObject({
      kind: 'frontmatter-incomplete',
      message: 'carries no title and no description.',
    })
  })

  it('should read the scope section outside a fenced template carrying one', () => {
    const body = [
      conformingStandard('.claude/plans/feature-<slug>.md'),
      '## Template',
      '',
      '````markdown',
      '## Scope',
      '',
      'Governs `<path/to/document>`: <the aspects this standard sets>.',
      '````',
      '',
    ].join('\n')

    expect(checkStandard('plan.md', body)).toEqual([])
  })
})

describe('splitPlanSections', () => {
  it('should key each section on its whole marker line', () => {
    const sections = splitPlanSections(conformingPlan())

    expect([...sections.keys()]).toEqual([
      'Summary',
      'Files to touch',
      'Risks',
      'Questions',
    ])
  })

  it('should key the heading and bold spellings to one section', () => {
    const bold = splitPlanSections('**Risks:**\n\n- one\n')
    const heading = splitPlanSections('## Risks\n\n- one\n')

    expect([...bold.keys()]).toEqual(['Risks'])
    expect([...heading.keys()]).toEqual(['Risks'])
  })

  it('should close a section on a label it does not recognize', () => {
    const sections = splitPlanSections(
      [
        '**Files to touch:**',
        '',
        '- `a.ts`: a reason',
        '',
        '**Decisions to record:**',
        '',
        '- a bullet that belongs to no section',
        '',
      ].join('\n'),
    )

    expect(sections.get('Files to touch')).toEqual([
      '',
      '- `a.ts`: a reason',
      '',
    ])
  })

  it('should not open a section on a deeper heading of the same name', () => {
    const sections = splitPlanSections(
      ['## Summary', '', '### Risks', '', '- nested', ''].join('\n'),
    )

    expect(sections.has('Risks')).toBe(false)
  })

  it('should not open a section on a bold phrase inside a bullet', () => {
    const sections = splitPlanSections(
      ['## Summary', '', '- carries a **Risks:** mention inline', ''].join(
        '\n',
      ),
    )

    expect(sections.has('Risks')).toBe(false)
  })
})

describe('linesOutsideFences', () => {
  it('should drop a fenced block and keep what surrounds it', () => {
    const kept = linesOutsideFences(
      ['before', '```markdown', '- `a.ts`', '```', 'after'].join('\n'),
    )

    expect(kept).toEqual(['before', 'after'])
  })

  it('should not close a longer fence on a shorter one inside it', () => {
    const kept = linesOutsideFences(
      ['````markdown', '```md', 'inner', '```', '````', 'after'].join('\n'),
    )

    expect(kept).toEqual(['after'])
  })
})

describe('preferredMarker', () => {
  it('should name Summary as a heading and the rest as bold labels', () => {
    expect(preferredMarker('Summary')).toBe('## Summary')
    expect(preferredMarker('Files to touch')).toBe('**Files to touch:**')
  })
})

describe('readQuestions', () => {
  it('should collect a lettered sub-question as its own item', () => {
    const questions = readQuestions([
      '1. First',
      '   - Suggested: a',
      '   - Answer:',
      '1a. Second',
      '   - Suggested: b',
      '   - Answer:',
    ])

    expect(questions).toHaveLength(2)
    expect(questions[1].label).toBe('1a. Second')
  })
})

describe('hasStagedBatches', () => {
  it('should read a plain **Batch N** label as staged', () => {
    expect(hasStagedBatches('**Batch 1**\n\n**Files to touch:**\n')).toBe(true)
  })

  it('should read a colon-bearing **Batch N:** label as staged', () => {
    expect(hasStagedBatches('**Batch 1: The verb change**\n')).toBe(true)
  })

  it('should read a plan carrying no batch label as not staged', () => {
    expect(hasStagedBatches(conformingPlan())).toBe(false)
  })
})

describe('checkPlan', () => {
  it('should report nothing on a conforming plan', () => {
    expect(checkPlan('feature-plan-standards.md', conformingPlan())).toEqual([])
  })

  it('should report a filename that is not feature-<slug>.md', () => {
    const findings = checkPlan('Plan For Standards.md', conformingPlan())

    expect(kinds(findings)).toEqual(['name-malformed'])
  })

  it('should report a missing required section', () => {
    const body = conformingPlan().replace(
      '**Risks:**\n\nNone identified.\n',
      '',
    )
    const findings = checkPlan('feature-a-b.md', body)

    expect(kinds(findings)).toEqual(['section-missing'])
    expect(findings[0].subject).toBe('**Risks:**')
  })

  it('should report a missing Feature heading', () => {
    const body = conformingPlan().replace(
      '# Feature: A standard owns the plan format',
      '# A standard owns the plan format',
    )

    expect(kinds(checkPlan('feature-a-b.md', body))).toEqual(['title-missing'])
  })

  it('should report a question carrying no suggestion', () => {
    const body = conformingPlan().replace(
      '   - Suggested: a validate verb, since it reports without writing\n',
      '',
    )

    expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
      'suggestion-missing',
    ])
  })

  it('should report a question carrying no answer slot', () => {
    const body = conformingPlan().replace('   - Answer:\n', '')

    expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
      'question-unanswerable',
    ])
  })

  it('should accept None identified in place of the question list', () => {
    const body = conformingPlan().replace(
      [
        '1. Which check reaches a gitignored folder?',
        '   - Suggested: a validate verb, since it reports without writing',
        '   - Answer:',
      ].join('\n'),
      'None identified.',
    )

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })

  it('should report a plan staging a batch as a plain **Batch N** label', () => {
    const body = conformingPlan().replace(
      '**Files to touch:**',
      '**Batch 1**\n\n**Files to touch:**',
    )

    expect(kinds(checkPlan('feature-a-b.md', body))).toEqual(['batch-unsplit'])
  })

  it('should report a plan staging a batch as a colon-bearing **Batch N:** label', () => {
    const body = conformingPlan().replace(
      '**Files to touch:**',
      '**Batch 1: The verb change**\n\n**Files to touch:**',
    )

    expect(kinds(checkPlan('feature-a-b.md', body))).toEqual(['batch-unsplit'])
  })

  it('should accept an entry naming two files before one shared reason', () => {
    const body = conformingPlan().replace(
      '- `standards/plan.md`: the sections and the answer contract',
      '- `a/SKILL.md` and `b/SKILL.md`: the same citation',
    )

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })

  it('should accept a reason carrying the path rather than leading with it', () => {
    const body = conformingPlan().replace(
      '- `standards/plan.md`: the sections and the answer contract',
      '- Context assembly: the tier table in `.claude/context/model.md`',
    )

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })

  it('should accept a terse numeric annotation as a reason', () => {
    const body = conformingPlan().replace(
      '- `standards/plan.md`: the sections and the answer contract',
      '- `standards/plan.md`: 73',
    )

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })

  it('should not report bullets under a label the plan invented', () => {
    const body = conformingPlan().replace(
      '- `standards/plan.md`: the sections and the answer contract',
      [
        '- `standards/plan.md`: the sections and the answer contract',
        '',
        '**Decisions to record:**',
        '',
        '- Two delivery paths, copy through the CLI and load through the plugin',
      ].join('\n'),
    )

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })

  it('should not report bullets inside a fenced example', () => {
    const body = conformingPlan().replace(
      '- `standards/plan.md`: the sections and the answer contract',
      [
        '- `standards/plan.md`: the sections and the answer contract',
        '',
        '```markdown',
        '- Outcome: what will be true when this is done',
        '- Silence is agreement',
        '```',
      ].join('\n'),
    )

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })

  it('should report an entry naming a file and saying nothing about it', () => {
    const body = conformingPlan().replace(
      '- `standards/plan.md`: the sections and the answer contract',
      '- `standards/plan.md`',
    )

    expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
      'entry-unreasoned',
    ])
  })

  it('should report a files-to-touch entry with no reason', () => {
    const body = conformingPlan().replace(
      '- `standards/plan.md`: the sections and the answer contract',
      '- `standards/plan.md`',
    )

    expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
      'entry-unreasoned',
    ])
  })

  it('should report a blank-Answer Suggested line paraphrasing the operator call', () => {
    const body = conformingPlan().replace(
      '   - Suggested: a validate verb, since it reports without writing',
      "   - Suggested: needs operator's call, the phrasing this task measured",
    )

    expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
      'operator-call-phrasing',
    ])
  })

  it('should not report the canonical phrase over a blank Answer', () => {
    const body = conformingPlan().replace(
      '   - Suggested: a validate verb, since it reports without writing',
      '   - Suggested: needs your call, the phrasing already matches',
    )

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })

  it('should not report an ordinary suggestion naming neither operator nor call', () => {
    expect(checkPlan('feature-a-b.md', conformingPlan())).toEqual([])
  })

  it('should not report a paraphrase once the Answer is filled', () => {
    const body = conformingPlan()
      .replace(
        '   - Suggested: a validate verb, since it reports without writing',
        "   - Suggested: needs operator's call, the phrasing this task measured",
      )
      .replace('   - Answer:\n', '   - Answer: Take the verb.\n')

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })
})

describe('checkItems', () => {
  const item = [
    '### 1. The format sits in three places',
    '',
    '- **Problem:** three surfaces state it',
    '- **Fix:** one standard owns it',
    '- **Worth it:** yes',
    '- **You:**',
    '',
  ].join('\n')

  it('should report nothing on an item carrying all four bullets', () => {
    expect(checkItems('dump', '01-standards.md', item)).toEqual([])
  })

  it('should name every missing bullet in one finding', () => {
    const body = item
      .replace('- **Fix:** one standard owns it\n', '')
      .replace('- **You:**\n', '')
    const findings = checkItems('dump', '01-standards.md', body)

    expect(kinds(findings)).toEqual(['item-incomplete'])
    expect(findings[0].message).toBe('states no Fix, no You.')
  })

  it('should report an open question carrying no suggestion', () => {
    const body = item.replace(
      '- **You:**',
      '- **Open:** which folder\n- **You:**',
    )

    expect(kinds(checkItems('dump', '01-standards.md', body))).toEqual([
      'suggestion-missing',
    ])
  })
})

describe('checkMemory', () => {
  function entry(fields: string, body: string): string {
    return ['---', fields, '---', '', body, ''].join('\n')
  }

  const RULE = [
    'Name the wrong run a bounding key would catch before declaring it.',
    '',
    '**Why:** The widest glob admitting a correct run was `**`, so the count no',
    'wrong run could have moved read green.',
    '',
    '**How to apply:** When no wrong run falls outside the key, the honest form',
    'is its absence plus a stated reason. See [[project-declaration-binds]].',
  ].join('\n')

  const FIELDS = [
    'title: Name the wrong run a bounding key would catch',
    'description: Omit a key whose only passing value admits the whole tree',
    'category: Project',
  ].join('\n')

  it('should report nothing on a conforming project entry', () => {
    expect(checkMemory('project-scope-glob.md', entry(FIELDS, RULE))).toEqual(
      [],
    )
  })

  it('should report nothing on a body running the three parts together', () => {
    const body = RULE.split('\n')
      .filter((line) => line.trim().length > 0)
      .join('\n')

    expect(checkMemory('project-scope-glob.md', entry(FIELDS, body))).toEqual(
      [],
    )
  })

  it('should report a filename prefix outside the four types', () => {
    const findings = checkMemory('verify-scope-glob.md', entry(FIELDS, RULE))

    expect(kinds(findings)).toEqual(['name-malformed'])
  })

  it('should not report a category mismatch on top of a malformed name', () => {
    const findings = checkMemory('verify-scope-glob.md', entry(FIELDS, RULE))

    expect(kinds(findings)).not.toContain('category-mismatch')
  })

  it('should report a category disagreeing with the filename prefix', () => {
    const fields = FIELDS.replace('category: Project', 'category: Feedback')
    const findings = checkMemory('project-scope-glob.md', entry(fields, RULE))

    expect(kinds(findings)).toEqual(['category-mismatch'])
    expect(findings[0].message).toBe(
      'is not Project, which the filename prefix declares.',
    )
  })

  it('should report a category carrying the wrong casing', () => {
    const fields = FIELDS.replace('category: Project', 'category: project')
    const findings = checkMemory('project-scope-glob.md', entry(fields, RULE))

    expect(kinds(findings)).toEqual(['category-mismatch'])
  })

  it('should name every missing frontmatter field in one finding', () => {
    const fields = 'title: Name the wrong run a bounding key would catch'
    const findings = checkMemory('project-scope-glob.md', entry(fields, RULE))

    expect(findings[0]).toMatchObject({
      kind: 'frontmatter-incomplete',
      message: 'carries no description and no category.',
    })
  })

  it('should report a title repeating the filename stem', () => {
    const fields = FIELDS.replace(
      'title: Name the wrong run a bounding key would catch',
      'title: project-scope-glob',
    )
    const findings = checkMemory('project-scope-glob.md', entry(fields, RULE))

    expect(kinds(findings)).toEqual(['title-is-slug'])
  })

  it('should report a rule-bearing body carrying no How to apply line', () => {
    const body = RULE.split('\n\n').slice(0, 2).join('\n\n')
    const findings = checkMemory('project-scope-glob.md', entry(FIELDS, body))

    expect(kinds(findings)).toEqual(['section-missing'])
    expect(findings[0].subject).toBe('**How to apply:**')
  })

  it('should report a body opening with a marker rather than a rule', () => {
    const body = RULE.split('\n\n').slice(1).join('\n\n')
    const findings = checkMemory('project-scope-glob.md', entry(FIELDS, body))

    expect(findings[0]).toMatchObject({
      kind: 'section-missing',
      subject: 'the rule line',
    })
  })

  it('should not require the markers on a reference entry', () => {
    const fields = [
      'title: Diction is a live target project',
      'description: The repo whose real use surfaces toolkit gaps',
      'category: Reference',
    ].join('\n')
    const body = 'The `diction` repo is a react and python target project.'

    expect(checkMemory('reference-diction.md', entry(fields, body))).toEqual([])
  })

  it('should not read a marker inside a fenced block as the body shape', () => {
    const body = [
      'Name the wrong run a bounding key would catch before declaring it.',
      '',
      '```markdown',
      '**Why:** the template a session copies',
      '**How to apply:** the template a session copies',
      '```',
    ].join('\n')
    const findings = checkMemory('project-scope-glob.md', entry(FIELDS, body))

    expect(kinds(findings)).toEqual(['section-missing', 'section-missing'])
  })
})

describe('validateRecords', () => {
  it('should refuse when the folder does not exist', async () => {
    const outcome = await validateRecords(ROOT, 'plans')

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('no-folder')
  })

  it('should report a clean folder of conforming plans', async () => {
    await seedPlan('feature-plan-standards.md', conformingPlan())
    const outcome = await validateRecords(ROOT, 'plans')

    expect(outcome).toMatchObject({ ok: true, records: 1, findings: [] })
  })

  it('should carry the record name on every plan finding', async () => {
    await seedPlan('feature-broken.md', '# Broken\n')
    const outcome = await validateRecords(ROOT, 'plans')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(
      outcome.findings.every((f) => f.record === 'feature-broken.md'),
    ).toBe(true)
  })

  it('should report a groundwork track missing its README and state file', async () => {
    await seedFolder('groundwork', 'skew', {
      '02-topic.md': frontmatter('title: Topic\ndescription: One line'),
    })
    const outcome = await validateRecords(ROOT, 'groundwork')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual(['index-missing', 'state-missing'])
  })

  it('should report a track holding a decision with no handoff', async () => {
    await seedFolder('groundwork', 'skew', {
      'README.md': frontmatter(
        'title: Skew\ndescription: One line\ndate: 2026-08-04',
      ),
      '01-current-state.md': frontmatter('title: State\ndescription: One line'),
      '06-decision.md': frontmatter('title: Decision\ndescription: One line'),
    })
    const outcome = await validateRecords(ROOT, 'groundwork')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual(['closing-partial'])
  })

  it('should report nothing on a closed conforming track', async () => {
    await seedFolder('groundwork', 'skew', {
      'README.md': frontmatter(
        'title: Skew\ndescription: One line\ndate: 2026-08-04',
      ),
      '01-current-state.md': frontmatter('title: State\ndescription: One line'),
      '06-decision.md': frontmatter('title: Decision\ndescription: One line'),
      '07-next-session.md': frontmatter(
        'title: Handoff\ndescription: One line',
      ),
    })

    expect(await validateRecords(ROOT, 'groundwork')).toMatchObject({
      ok: true,
      records: 1,
      findings: [],
    })
  })

  it('should report an index file carrying no opening date', async () => {
    await seedFolder('groundwork', 'skew', {
      'README.md': frontmatter('title: Skew\ndescription: One line'),
      '01-current-state.md': frontmatter('title: State\ndescription: One line'),
    })
    const outcome = await validateRecords(ROOT, 'groundwork')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual(['date-malformed'])
  })

  it('should report a file missing frontmatter fields', async () => {
    await seedFolder('groundwork', 'skew', {
      'README.md': frontmatter(
        'title: Skew\ndescription: One line\ndate: 2026-08-04',
      ),
      '01-current-state.md': '# State\n',
    })
    const outcome = await validateRecords(ROOT, 'groundwork')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.findings[0]).toMatchObject({
      kind: 'frontmatter-incomplete',
      message: 'carries no title and no description.',
    })
  })

  it('should skip the item check on the intake handoff file', async () => {
    await seedFolder('intake', 'overview', {
      '00-overview.md': frontmatter(
        'title: Dump\ndescription: One line\ndate: 2026-08-04',
      ),
      '99-next-session.md': [
        '---',
        'title: Handoff',
        'description: One line',
        '---',
        '',
        '### A heading that is not an item',
        '',
      ].join('\n'),
    })

    expect(await validateRecords(ROOT, 'intake')).toMatchObject({
      ok: true,
      findings: [],
    })
  })

  it('should report a malformed item inside an intake cluster', async () => {
    await seedFolder('intake', 'overview', {
      '00-overview.md': frontmatter(
        'title: Dump\ndescription: One line\ndate: 2026-08-04',
      ),
      '01-standards.md': [
        '---',
        'title: Standards',
        'description: One line',
        '---',
        '',
        '### 1. The format sits in three places',
        '',
        '- **Problem:** three surfaces state it',
        '',
      ].join('\n'),
    })
    const outcome = await validateRecords(ROOT, 'intake')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.findings[0]).toMatchObject({
      kind: 'item-incomplete',
      record: 'overview',
    })
  })

  it('should skip the generated catalog when counting memory entries', async () => {
    const dir = recordsDir(ROOT, 'memory')
    mkdirSync(dir, { recursive: true })
    await writeFile(
      join(dir, 'index.md'),
      frontmatter('title: Memory\nsubtitle: One line'),
    )
    await writeFile(
      join(dir, 'feedback-answer-first.md'),
      [
        '---',
        'title: Close with an answer',
        'description: State the pick before the reasoning',
        'category: Feedback',
        '---',
        '',
        'Close with answers and a recommendation, never a list of questions.',
        '',
        '**Why:** Two handoffs this session returned open questions.',
        '',
        '**How to apply:** State the pick first, then the reason.',
        '',
      ].join('\n'),
    )

    expect(await validateRecords(ROOT, 'memory')).toMatchObject({
      ok: true,
      records: 1,
      findings: [],
    })
  })

  it('should skip the generated catalog when counting standards', async () => {
    await seedStandard('index.md', frontmatter('title: Standards'))
    await seedStandard(
      'plan.md',
      conformingStandard('.claude/plans/feature-<slug>.md'),
    )

    expect(await validateRecords(ROOT, 'standards')).toMatchObject({
      ok: true,
      records: 1,
      findings: [],
    })
  })

  it('should read the installed copy when no authoring root exists', async () => {
    const dir = join(ROOT, '.claude', 'standards')
    mkdirSync(dir, { recursive: true })
    await writeFile(
      join(dir, 'wrong-name.md'),
      conformingStandard('.claude/plans/feature-<slug>.md'),
    )
    const outcome = await validateRecords(ROOT, 'standards')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual(['name-malformed'])
  })

  it('should name both candidate folders when neither standards folder exists', async () => {
    expect(await validateRecords(ROOT, 'standards')).toMatchObject({
      ok: false,
      reason: 'no-folder',
      message: `No standards folder at ${join(ROOT, 'standards')} or ${join(ROOT, '.claude', 'standards')}.`,
    })
  })

  it('should count folders rather than the files inside them', async () => {
    await seedFolder('intake', 'first', {
      '00-overview.md': frontmatter(
        'title: One\ndescription: One line\ndate: 2026-08-04',
      ),
    })
    await seedFolder('intake', 'second', {
      '00-overview.md': frontmatter(
        'title: Two\ndescription: One line\ndate: 2026-08-04',
      ),
    })
    const outcome = await validateRecords(ROOT, 'intake')

    expect(outcome).toMatchObject({ ok: true, records: 2, findings: [] })
  })
})

function mission(fields: string): string {
  return [
    '---',
    fields,
    '---',
    '',
    '# Regular expressions',
    '',
    '## Success looks like',
    '',
    '- Rewrite a nested quantifier so it cannot backtrack',
    '',
  ].join('\n')
}

const MISSION_FIELDS =
  'title: Regular expressions\ndescription: One line\ndate: 2026-08-19'

async function seedWorkspace(
  slug: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  const dir = join(recordsDir(ROOT, 'teach'), slug)

  await Promise.all(
    Object.entries(files).map(async ([name, body]) => {
      const path = join(dir, name)
      mkdirSync(dirname(path), { recursive: true })
      await writeFile(path, body)
    }),
  )
}

function conformingWorkspace(): Record<string, string> {
  return {
    'MISSION.md': mission(MISSION_FIELDS),
    'RESOURCES.md': frontmatter('title: Resources\ndescription: One line'),
    'GLOSSARY.md': frontmatter('title: Glossary\ndescription: One line'),
  }
}

describe('validateRecords over a teaching workspace', () => {
  it('should report nothing on a conforming workspace', async () => {
    await seedWorkspace('01-regex', {
      ...conformingWorkspace(),
      'reference/backtracking.md': frontmatter(
        'title: Backtracking\ndescription: One line',
      ),
      'learning-records/0001-first-pass.md': frontmatter(
        'title: First pass\ndescription: One line',
      ),
    })

    expect(await validateRecords(ROOT, 'teach')).toMatchObject({
      ok: true,
      records: 1,
      findings: [],
    })
  })

  it('should report a workspace missing each required file', async () => {
    await seedWorkspace('01-regex', {
      'NOTES.md': frontmatter('title: Notes\ndescription: One line'),
    })
    const outcome = await validateRecords(ROOT, 'teach')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual([
      'index-missing',
      'section-missing',
      'section-missing',
    ])
  })

  it('should report a folder carrying no ordinal ahead of its topic', async () => {
    await seedWorkspace('regex', conformingWorkspace())
    const outcome = await validateRecords(ROOT, 'teach')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual(['name-malformed'])
  })

  it('should report a mission carrying no opening date and no success list', async () => {
    await seedWorkspace('01-regex', {
      ...conformingWorkspace(),
      'MISSION.md': frontmatter(
        'title: Regular expressions\ndescription: One line',
      ),
    })
    const outcome = await validateRecords(ROOT, 'teach')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual([
      'date-malformed',
      'section-missing',
    ])
  })

  it('should report a learning record carrying no four-digit number', async () => {
    await seedWorkspace('01-regex', {
      ...conformingWorkspace(),
      'learning-records/first-pass.md': frontmatter(
        'title: First pass\ndescription: One line',
      ),
    })
    const outcome = await validateRecords(ROOT, 'teach')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual(['name-malformed'])
    expect(outcome.findings[0].subject).toBe('learning-records/first-pass.md')
  })

  it('should report a reference page carrying a number no reader follows', async () => {
    await seedWorkspace('01-regex', {
      ...conformingWorkspace(),
      'reference/0001-backtracking.md': frontmatter(
        'title: Backtracking\ndescription: One line',
      ),
    })
    const outcome = await validateRecords(ROOT, 'teach')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(kinds(outcome.findings)).toEqual(['name-malformed'])
  })

  it('should walk neither the lessons nor the assets folder', async () => {
    await seedWorkspace('01-regex', {
      ...conformingWorkspace(),
      'lessons/0001-backtracking.html': '<p>No frontmatter here</p>',
      'lessons/notes.md': '# A stray markdown file carrying no frontmatter\n',
      'assets/course.css': 'body { margin: 0 }',
    })

    expect(await validateRecords(ROOT, 'teach')).toMatchObject({
      ok: true,
      records: 1,
      findings: [],
    })
  })

  it('should skip a subfolder name held by a plain file rather than throwing', async () => {
    await seedWorkspace('01-regex', {
      ...conformingWorkspace(),
      reference: 'A file sitting where the folder belongs\n',
    })

    expect(await validateRecords(ROOT, 'teach')).toMatchObject({
      ok: true,
      records: 1,
      findings: [],
    })
  })

  it('should name both record roots when no teach directory exists', async () => {
    expect(await validateRecords(ROOT, 'teach')).toMatchObject({
      ok: false,
      reason: 'no-folder',
      message: `No teach folder at ${join(ROOT, '.canon', 'teach')} or ${join(ROOT, '.claude', 'teach')}.`,
    })
  })
})
