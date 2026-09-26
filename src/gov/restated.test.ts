import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type RestatedEntry,
  type RestatedReport,
  readRestated,
} from '@/gov/restated'

let ROOT: string

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${body}\n`)
}

function measured(
  report: RestatedReport,
): Extract<RestatedReport, { kind: 'measured' }> {
  if (report.kind !== 'measured') {
    throw new Error(`Expected a measured report, got: ${report.reason}`)
  }
  return report
}

/** The entry whose subject carries `needle`, so a case names what it asserts. */
function entryFor(
  report: Extract<RestatedReport, { kind: 'measured' }>,
  needle: string,
): RestatedEntry {
  const entry = report.restatements.find((candidate) =>
    candidate.subject.text.includes(needle),
  )
  if (entry === undefined) {
    throw new Error(
      `No restatement carries "${needle}". Subjects reported: ${report.restatements
        .map((candidate) => candidate.subject.text)
        .join(' | ')}`,
    )
  }
  return entry
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-gov-restated-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('readRestated', () => {
  it('refuses when the always-loaded file is absent', () => {
    write('tooling/claude/seeds/CLAUDE.md', '- Something the seed states.')

    const report = readRestated(ROOT)

    expect(report.kind).toBe('unreadable')
    if (report.kind === 'unreadable') {
      expect(report.reason).toBe('no-instructions')
    }
  })

  it('refuses when no second surface exists to match against', () => {
    write('CLAUDE.md', '- Archive a shipped plan under the archive folder.')

    const report = readRestated(ROOT)

    expect(report.kind).toBe('unreadable')
    if (report.kind === 'unreadable') {
      expect(report.reason).toBe('no-surfaces')
    }
  })

  it('reports the corpus it read, so a count names its own bound', () => {
    write(
      'CLAUDE.md',
      ['# Toolkit', '', '- First instruction here.', '- Second one here.'].join(
        '\n',
      ),
    )
    write('tooling/claude/seeds/CLAUDE.md', '- Only seed bullet.')
    write('claude/skills/alpha/SKILL.md', '# Alpha\n\nSome prose.')
    write(
      'governance/rules/core/010-example.md',
      '# Example\n\n## Section\n\n- One rule bullet here.',
    )

    const report = measured(readRestated(ROOT))

    expect(report.corpus.instructions).toBe(2)
    expect(report.corpus.seed).toBe(1)
    expect(report.corpus.bodies).toBe(1)
    expect(report.corpus.rules).toBe(1)
  })

  it('classes an agreeing seed restatement as a declared mirror', () => {
    write(
      'CLAUDE.md',
      '- Move the plan to `.claude/plans/archive/` when the task ships. Never delete it.',
    )
    write(
      'tooling/claude/seeds/CLAUDE.md',
      '- When that task ships, move its plan file to `.claude/plans/archive/`. Never delete it.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'Move the plan')

    expect(entry.surfaces).toHaveLength(1)
    expect(entry.surfaces[0].restatement).toBe('mirror')
    expect(entry.surfaces[0].authority).toBe('claude-md')
    expect(report.counts.mirrors).toBe(1)
    expect(report.counts.repetitions).toBe(0)
  })

  it('classes an agreeing skill body restatement as a repetition', () => {
    write(
      'CLAUDE.md',
      '- Write temporary files to `.claude/.tmp/<slug>/<file>.md` in the project root.',
    )
    write('tooling/claude/seeds/CLAUDE.md', '- Unrelated seed guidance.')
    write(
      'claude/skills/alpha/SKILL.md',
      '# Alpha\n\nWrite scratch output to `.claude/.tmp/<slug>/<file>.md` under the project root.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'Write temporary files')

    expect(entry.surfaces).toHaveLength(1)
    expect(entry.surfaces[0].restatement).toBe('repetition')
    expect(entry.surfaces[0].file).toBe('claude/skills/alpha/SKILL.md')
    expect(report.counts.repetitions).toBe(1)
    expect(report.counts.contradictions).toBe(0)
  })

  it('separates a restatement whose prohibition flips from one that repeats', () => {
    write(
      'CLAUDE.md',
      '- Never delete a memory entry. Retire one by moving it to the archive folder instead.',
    )
    write('tooling/claude/seeds/CLAUDE.md', '- Unrelated seed guidance.')
    write(
      'claude/skills/beta/SKILL.md',
      '# Beta\n\nDelete a memory entry once its archive folder copy exists, retiring the original outright.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'Never delete a memory entry')

    expect(entry.surfaces[0].restatement).toBe('contradiction')
    expect(report.counts.contradictions).toBe(1)
  })

  it('reads polarity from the clause the anchors landed in, not the whole statement', () => {
    write(
      'CLAUDE.md',
      '- The ban governs edits you make, not scripts under `scripts/`.',
    )
    write(
      'tooling/claude/seeds/CLAUDE.md',
      '- Edit a file with the file-editing tool, never a shell stream editor. This governs edits you make, not scripts under `scripts/`.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'The ban governs')

    expect(entry.surfaces[0].restatement).toBe('mirror')
    expect(report.counts.contradictions).toBe(0)
  })

  it('reads a mid-clause negation as description rather than as a prohibition', () => {
    write(
      'CLAUDE.md',
      '- An unescaped `&` in a `sed` replacement expands to the whole match, so a fallback never fires.',
    )
    write(
      'tooling/claude/seeds/CLAUDE.md',
      '- An unescaped `&` in a `sed` replacement expands to the whole match, so both fail silently while reporting success.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'An unescaped')

    expect(entry.surfaces[0].restatement).toBe('mirror')
    expect(report.counts.contradictions).toBe(0)
  })

  it('names the anchors a match rested on, so a finding is auditable', () => {
    write(
      'CLAUDE.md',
      '- Route a scratch file to `.claude/.tmp/<slug>/` under the repository root.',
    )
    write('tooling/claude/seeds/CLAUDE.md', '- Unrelated seed guidance.')
    write(
      'claude/skills/alpha/SKILL.md',
      '# Alpha\n\nEvery scratch file lands in `.claude/.tmp/<slug>/` beneath the repository root.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'Route a scratch file')

    expect(entry.surfaces[0].anchors.length).toBeGreaterThanOrEqual(2)
    expect(entry.surfaces[0].anchors).toContain('.claude/.tmp/<slug>/')
  })

  it('assigns a skill body the authority when the subject names that skill', () => {
    write(
      'CLAUDE.md',
      '- The `context-fold` skill archives a shipped plan into the plans archive folder.',
    )
    write('tooling/claude/seeds/CLAUDE.md', '- Unrelated seed guidance.')
    write(
      'claude/skills/context-fold/SKILL.md',
      '# Claude docs\n\nThis skill archives a shipped plan into the plans archive folder.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'context-fold')

    expect(entry.surfaces[0].authority).toBe('skill-body')
  })

  it('leaves authority unknown where the ownership table reaches nothing', () => {
    write(
      'CLAUDE.md',
      '- Prefer a single-path layout over dual-mode toggles and migration shims.',
    )
    write('tooling/claude/seeds/CLAUDE.md', '- Unrelated seed guidance.')
    write(
      'claude/skills/alpha/SKILL.md',
      '# Alpha\n\nChoose a single-path layout rather than dual-mode toggles or migration shims.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'single-path layout')

    expect(entry.surfaces[0].authority).toBe('unknown')
  })

  it('counts a subject carried by two further surfaces as stated three times', () => {
    write(
      'CLAUDE.md',
      '- Move the plan to `.claude/plans/archive/` when the task ships. Never delete it.',
    )
    write(
      'tooling/claude/seeds/CLAUDE.md',
      '- When that task ships, move its plan file to `.claude/plans/archive/`. Never delete it.',
    )
    write(
      'claude/skills/alpha/SKILL.md',
      '# Alpha\n\nMove the plan file into `.claude/plans/archive/` once the task ships.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'Move the plan')

    expect(entry.surfaces).toHaveLength(2)
    expect(report.counts.threeSurface).toBe(1)
  })

  it('counts a rule-only cluster once even after it fragments across several subject entries', () => {
    write('CLAUDE.md', '- Unrelated top-level guidance.')
    write(
      'governance/rules/core/900-example-a.md',
      '# A\n\n## Section\n\n- Never commit a `.env.production` file into the tracked deploy pipeline.',
    )
    write(
      'governance/rules/lib/900-example-b.md',
      '# B\n\n## Section\n\n- Do not commit a `.env.production` file into the tracked deploy pipeline, ever.',
    )
    write(
      'governance/rules/framework/900-example-c.md',
      '# C\n\n## Section\n\n- A `.env.production` file must never reach the tracked deploy pipeline.',
    )
    write(
      'governance/rules/ui/900-example-d.md',
      '# D\n\n## Section\n\n- Keep every `.env.production` file out of the tracked deploy pipeline entirely.',
    )

    const report = measured(readRestated(ROOT))

    expect(report.counts.threeSurface).toBe(1)
  })

  it('reports one instruction stated in two shipping rules as a single pair, with no counterpart in the always-loaded file', () => {
    write('CLAUDE.md', '- Unrelated top-level guidance.')
    write(
      'governance/rules/core/010-secrets.md',
      '# Secrets\n\n## Files\n\n- Never commit a `.env` file into the tracked tree.',
    )
    write(
      'governance/rules/lib/300-secrets.md',
      '# Secrets\n\n## Files\n\n- Do not commit a `.env` file into the tracked tree, ever.',
    )

    const report = measured(readRestated(ROOT))

    expect(report.restatements).toHaveLength(1)
    const [entry] = report.restatements
    expect(entry.subject.file).toBe('governance/rules/core/010-secrets.md')
    expect(entry.surfaces).toHaveLength(1)
    expect(entry.surfaces[0].file).toBe('governance/rules/lib/300-secrets.md')
    expect(entry.surfaces[0].kind).toBe('rule')
    expect(entry.surfaces[0].restatement).toBe('repetition')
    expect(report.counts.repetitions).toBe(1)
  })

  it('classes a skill body quoting a rule as the restatement it already found from the always-loaded file', () => {
    write('CLAUDE.md', '- Unrelated top-level guidance.')
    write(
      'governance/rules/core/055-scratch.md',
      '# Scratch\n\n## Temporary files\n\n- Write temporary files to `.claude/.tmp/<slug>/<file>.md` in the project root.',
    )
    write(
      'claude/skills/alpha/SKILL.md',
      '# Alpha\n\nWrite scratch output to `.claude/.tmp/<slug>/<file>.md` under the project root.',
    )

    const report = measured(readRestated(ROOT))
    const entry = entryFor(report, 'Write temporary files')

    expect(entry.surfaces).toHaveLength(1)
    expect(entry.surfaces[0].restatement).toBe('repetition')
    expect(entry.surfaces[0].file).toBe('claude/skills/alpha/SKILL.md')
    expect(report.counts.repetitions).toBe(1)
  })

  it('reads past a fenced block, so an example is not swept as an instruction', () => {
    write(
      'CLAUDE.md',
      '- Route a scratch file to `.claude/.tmp/<slug>/` under the repository root.',
    )
    write('tooling/claude/seeds/CLAUDE.md', '- Unrelated seed guidance.')
    write(
      'claude/skills/alpha/SKILL.md',
      [
        '# Alpha',
        '',
        '```bash',
        'echo "route a scratch file to .claude/.tmp/<slug>/ under the repository root"',
        '```',
      ].join('\n'),
    )

    const report = measured(readRestated(ROOT))

    expect(report.restatements).toHaveLength(0)
  })

  it('reads past a body frontmatter block, which is metadata rather than a rule', () => {
    write(
      'CLAUDE.md',
      '- Route a scratch file to `.claude/.tmp/<slug>/` under the repository root.',
    )
    write('tooling/claude/seeds/CLAUDE.md', '- Unrelated seed guidance.')
    write(
      'claude/skills/alpha/SKILL.md',
      [
        '---',
        'name: alpha',
        'description: Routes a scratch file to `.claude/.tmp/<slug>/` under the repository root.',
        '---',
        '',
        '# Alpha',
        '',
        'Unrelated prose.',
      ].join('\n'),
    )

    const report = measured(readRestated(ROOT))

    expect(report.restatements).toHaveLength(0)
  })

  it('publishes the matcher settings the reading was taken under', () => {
    write('CLAUDE.md', '- One instruction.')
    write('tooling/claude/seeds/CLAUDE.md', '- One seed bullet.')

    const report = measured(readRestated(ROOT))

    expect(report.matcher.anchors).toBeGreaterThan(0)
    expect(report.matcher.common).toBeGreaterThan(0)
  })
})
