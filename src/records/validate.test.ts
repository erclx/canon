import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { linesOutsideFences } from '@/markdown/scan'
import {
  checkItems,
  checkPlan,
  type Finding,
  type FindingKind,
  hasStagedBatches,
  isRecordKind,
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
    '**Verification:**',
    '',
    '- The validator reports both sections: `bun test src/records`',
    '',
    '**Risks:**',
    '',
    'None identified.',
    '',
    '**Review focus:**',
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

describe('isRecordKind', () => {
  it('should accept every published kind and reject anything else', () => {
    expect(isRecordKind('plans')).toBe(true)
    expect(isRecordKind('groundwork')).toBe(true)
    expect(isRecordKind('intake')).toBe(true)
    expect(isRecordKind('teach')).toBe(false)
    expect(isRecordKind('standards')).toBe(false)
    expect(isRecordKind('review')).toBe(false)
    expect(isRecordKind('memory')).toBe(false)
  })
})

describe('recordsDir', () => {
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
    expect(recordDirs(ROOT, 'plans')).toEqual([
      join(ROOT, '.canon', 'plans'),
      join(ROOT, '.claude', 'plans'),
    ])
  })
})

describe('splitPlanSections', () => {
  it('should key each section on its whole marker line', () => {
    const sections = splitPlanSections(conformingPlan())

    expect([...sections.keys()]).toEqual([
      'Summary',
      'Files to touch',
      'Verification',
      'Risks',
      'Review focus',
      'Questions',
    ])
  })

  it('should close Files to touch at the Verification label', () => {
    const sections = splitPlanSections(conformingPlan())

    expect(sections.get('Files to touch')).toEqual([
      '',
      '- `standards/plan.md`: the sections and the answer contract',
      '',
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
  it('should name every section as the H2 the template ships', () => {
    expect(preferredMarker('Summary')).toBe('## Summary')
    expect(preferredMarker('Files to touch')).toBe('## Files to touch')
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
    expect(findings[0].subject).toBe('## Risks')
  })

  it('should report a missing Verification section', () => {
    const body = conformingPlan().replace(
      '**Verification:**\n\n- The validator reports both sections: `bun test src/records`\n\n',
      '',
    )
    const findings = checkPlan('feature-a-b.md', body)

    expect(kinds(findings)).toEqual(['section-missing'])
    expect(findings[0].subject).toBe('## Verification')
  })

  describe('Design references', () => {
    function uiPlan(designReferences: string[]): string {
      return conformingPlan()
        .replace(
          '- `standards/plan.md`: the sections and the answer contract',
          '- `src/app/button.tsx`: the pressed state',
        )
        .replace(
          '**Verification:**',
          [...designReferences, '**Verification:**'].join('\n'),
        )
    }

    it('should report a plan touching a rendered-surface file with no section', () => {
      const findings = checkPlan('feature-a-b.md', uiPlan([]))

      expect(kinds(findings)).toEqual(['section-missing'])
      expect(findings[0].subject).toBe('## Design references')
    })

    it('should pass a rendered-surface plan citing a reference folder', () => {
      const body = uiPlan([
        '**Design references:**',
        '',
        '- `canon/design/button/`: the pressed state',
        '',
      ])

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })

    it('should pass a rendered-surface plan that writes None identified', () => {
      const body = uiPlan([
        '**Design references:**',
        '',
        'None identified.',
        '',
      ])

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })

    it('should not require the section on a plan touching no rendered-surface file', () => {
      expect(checkPlan('feature-a-b.md', conformingPlan())).toEqual([])
    })

    it('should require the section for a scss entry', () => {
      const body = uiPlan([]).replace('button.tsx', 'theme.scss')

      expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
        'section-missing',
      ])
    })

    it('should require the section for a stylesheet entry', () => {
      const body = uiPlan([]).replace('button.tsx', 'theme.css')

      expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
        'section-missing',
      ])
    })
  })

  it('should report a missing Review focus section', () => {
    const body = conformingPlan().replace(
      '**Review focus:**\n\nNone identified.\n\n',
      '',
    )
    const findings = checkPlan('feature-a-b.md', body)

    expect(kinds(findings)).toEqual(['section-missing'])
    expect(findings[0].subject).toBe('## Review focus')
  })

  it('should accept both new sections written as headings', () => {
    const body = conformingPlan()
      .replace('**Verification:**', '## Verification')
      .replace('**Review focus:**', '## Review focus')

    expect(checkPlan('feature-a-b.md', body)).toEqual([])
  })

  describe('Current behavior', () => {
    const section = [
      '## Current behavior',
      '',
      '- `canon indexes list --json`: lists every context entry',
      '',
    ].join('\n')

    it('should pass a plan carrying the section after Summary', () => {
      const body = conformingPlan().replace(
        '**Files to touch:**',
        `${section}\n**Files to touch:**`,
      )

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })

    it('should key the section so its bullets stay out of Summary', () => {
      const sections = splitPlanSections(
        ['## Summary', '', '- goal', '', section].join('\n'),
      )

      const bullets = (name: string) =>
        sections.get(name)?.filter((line) => line.trim() !== '')

      expect(bullets('Summary')).toEqual(['- goal'])
      expect(bullets('Current behavior')).toEqual([
        '- `canon indexes list --json`: lists every context entry',
      ])
    })

    it('should still pass a plan without the section', () => {
      expect(checkPlan('feature-a-b.md', conformingPlan())).toEqual([])
    })
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
      '- Context assembly: the tier table in `canon/context/model.md`',
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

  describe('Sources', () => {
    const link = '[Docs](https://example.com/docs)'

    function withSources(...entries: string[]): string {
      return conformingPlan().replace(
        '**Questions:**',
        ['**Sources:**', '', ...entries, '', '**Questions:**'].join('\n'),
      )
    }

    it('should accept an entry with a link and a quoted passage', () => {
      const body = withSources(`- ${link}, backing the pick: "the exact words"`)

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })

    it('should accept an unverified entry carrying no quote', () => {
      const body = withSources(`- ${link}, backing the pick. unverified`)

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })

    it('should report an entry with a link and no quote', () => {
      const body = withSources(`- ${link}, backing the pick`)

      expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
        'source-unquoted',
      ])
    })

    it('should report an entry carrying no link', () => {
      const body = withSources('- Recalled from memory: "a passage"')

      expect(kinds(checkPlan('feature-a-b.md', body))).toEqual([
        'source-unquoted',
      ])
    })

    it('should pass a plan with no Sources section', () => {
      expect(checkPlan('feature-a-b.md', conformingPlan())).toEqual([])
    })

    it('should close Sources at the next marker so a question is not read as a source', () => {
      const body = withSources(`- ${link}: "the exact words"`)

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })

    it('should keep a question out of Sources when Sources closes the plan', () => {
      const body = `${conformingPlan()}\n**Sources:**\n\n- ${link}: "the exact words"\n`

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })

    it('should read a nested bullet as part of the entry above it', () => {
      const body = withSources(`- ${link}, backing the pick`, '  - "the words"')

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })

    it('should count a quoted passage wrapped across lines', () => {
      const body = withSources(`- ${link}: "the exact`, '  words wrapped"')

      expect(checkPlan('feature-a-b.md', body)).toEqual([])
    })
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

  it('should validate an old bold-label plan and report S1 under structure alone', async () => {
    await seedPlan('feature-plan-standards.md', conformingPlan())
    const outcome = await validateRecords(ROOT, 'plans')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.findings).toEqual([])
    expect(outcome.structure.map((entry) => entry.criterion)).toEqual([
      'S1',
      'S1',
      'S1',
      'S1',
      'S1',
    ])
    expect(outcome.structure[0]).toMatchObject({
      record: 'feature-plan-standards.md',
      subject: 'feature-plan-standards.md',
      line: 9,
    })
  })

  it('should read only the plan a record names, by its stem', async () => {
    await seedPlan('feature-plan-standards.md', conformingPlan())
    await seedPlan('feature-broken.md', '# Broken\n')
    const outcome = await validateRecords(ROOT, 'plans', 'feature-broken')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.records).toBe(1)
    expect(outcome.structure).toEqual([])
    expect(
      outcome.findings.every((f) => f.record === 'feature-broken.md'),
    ).toBe(true)
  })

  it('should refuse a record the folder does not hold', async () => {
    await seedPlan('feature-plan-standards.md', conformingPlan())
    const outcome = await validateRecords(ROOT, 'plans', 'feature-absent')

    expect(outcome).toMatchObject({ ok: false, reason: 'no-record' })
  })

  it('should read the numbered files of a track and never its evidence', async () => {
    await seedFolder('groundwork', 'skew', {
      'README.md': frontmatter(
        'title: Skew\ndescription: One line\ndate: 2026-08-04',
      ),
      '01-current-state.md': [
        '---',
        'title: State',
        'description: One line',
        '---',
        '',
        '**Measured:**',
        '',
      ].join('\n'),
    })
    mkdirSync(join(recordsDir(ROOT, 'groundwork'), 'skew', 'evidence'))
    await writeFile(
      join(recordsDir(ROOT, 'groundwork'), 'skew', 'evidence', 'rewrite.md'),
      '**Files to touch:**\n',
    )
    const outcome = await validateRecords(ROOT, 'groundwork', 'skew')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.structure).toMatchObject([
      { criterion: 'S1', record: 'skew', subject: '01-current-state.md' },
    ])
  })

  it('should report an intake field spilling past its line', async () => {
    await seedFolder('intake', 'dump', {
      '00-overview.md': frontmatter(
        'title: Dump\ndescription: One line\ndate: 2026-08-04',
      ),
      '01-cluster.md': [
        '---',
        'title: Cluster',
        'description: One line',
        '---',
        '',
        '### 1. Item',
        '',
        '- **Problem:** Each kind:',
        '  - one',
        '- **Fix:** one change',
        '- **Worth it:** Yes.',
        '- **You:**',
        '',
      ].join('\n'),
    })
    const outcome = await validateRecords(ROOT, 'intake', 'dump')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.findings).toEqual([])
    expect(outcome.structure).toMatchObject([
      { criterion: 'intake-spill', subject: '01-cluster.md', line: 9 },
    ])
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

  it('should report an intake item whose frontmatter will not parse', async () => {
    await seedFolder('intake', 'overview', {
      '00-overview.md': frontmatter(
        'title: Dump\ndescription: One line\ndate: 2026-08-04',
      ),
      '05-groundwork.md': frontmatter(
        'title: Groundwork\ndescription: Demo: a colon',
      ),
    })
    const outcome = await validateRecords(ROOT, 'intake')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.findings[0]).toMatchObject({
      kind: 'frontmatter-incomplete',
      record: 'overview',
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
