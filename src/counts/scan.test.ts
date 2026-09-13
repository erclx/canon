import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type CountsReport, scanCounts } from '@/counts/scan'
import { gitEnv } from '@/git-env'

let ROOT: string

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

function measured(
  report: CountsReport,
): Extract<CountsReport, { kind: 'measured' }> {
  if (report.kind !== 'measured') {
    throw new Error(`Expected a measured report, got: ${report.reason}`)
  }
  return report
}

/**
 * `count` skill folders, so the true count `scanCounts` compares every
 * stated figure against is `count`. The plausibility filter reads the
 * distance between a stated figure and this true count, so a case exercising
 * it needs a true count in the same range a real catalog sits in rather than
 * the one or two a minimal fixture would otherwise carry.
 */
function seedSkills(count: number): void {
  for (let index = 0; index < count; index += 1) {
    write(`claude/skills/skill-${index}/SKILL.md`, `# Skill ${index}\n`)
  }
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-counts-scan-'))
  // A git hook exports GIT_DIR into every process it runs, and it takes
  // precedence over `cwd`, so an inherited environment initializes the
  // repository somewhere other than the fixture and every case reads empty.
  execSync('git init --quiet', { cwd: ROOT, env: gitEnv() })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('scanCounts', () => {
  it('should refuse when the tree carries no git history', async () => {
    rmSync(join(ROOT, '.git'), { recursive: true, force: true })

    const report = await scanCounts(ROOT)

    expect(report).toEqual({ kind: 'unreadable', reason: 'no-git' })
  })

  it('should refuse when the tree carries no markdown file', async () => {
    write('src/index.ts', 'export {}\n')

    const report = await scanCounts(ROOT)

    expect(report).toEqual({ kind: 'unreadable', reason: 'no-markdown' })
  })

  it('should name a stale digit count asserted with a whole-catalog verb', async () => {
    seedSkills(63)
    write('docs/plugin.md', 'The full entry loads 59 skills at install time.\n')

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([
      {
        file: 'docs/plugin.md',
        line: 1,
        catalog: 'skills',
        stated: 59,
        actual: 63,
        sentence: 'The full entry loads 59 skills at install time.',
      },
    ])
  })

  it('should name a stale count reached through an article rather than a verb', async () => {
    // The shape a first review found live in the tree: the assertion verb
    // sits after the noun rather than ahead of the number, which the
    // verb-only gate could not reach.
    seedSkills(20)
    write(
      'docs/history.md',
      'Six of the twelve skills read gitignored folders.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([
      expect.objectContaining({
        file: 'docs/history.md',
        catalog: 'skills',
        stated: 12,
        actual: 20,
      }),
    ])
  })

  it('should name a stale spelled-out count reached through one qualifying word', async () => {
    seedSkills(63)
    write(
      'docs/plugin.md',
      'The curated entry loads sixty-one shipped skills.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([
      expect.objectContaining({
        file: 'docs/plugin.md',
        catalog: 'skills',
        stated: 61,
        actual: 63,
      }),
    ])
  })

  it('should name a stale count reached through a whole-catalog quantifier', async () => {
    // `canon/context/sandbox/authoring.md` states `took all 69 rules`,
    // where the trigger the verb gate wants sits five words ahead of the
    // number and `all` is what sits against it.
    seedSkills(63)
    write('docs/sandbox.md', 'The copy it replaced took all 59 skills.\n')

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([
      expect.objectContaining({
        file: 'docs/sandbox.md',
        catalog: 'skills',
        stated: 59,
        actual: 63,
      }),
    ])
  })

  it('should name a stale count reached through a production verb outside the original list', async () => {
    // `canon/context/development/regeneration.md` states `the toolkit
    // authors 69 rules`, the assertion shape this gate was built for with a
    // verb the first list did not carry.
    seedSkills(63)
    write(
      'docs/regeneration.md',
      'It resolves differently because the toolkit authors 59 skills under `claude/skills/`.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([
      expect.objectContaining({
        file: 'docs/regeneration.md',
        catalog: 'skills',
        stated: 59,
        actual: 63,
      }),
    ])
  })

  it('should read past a total reached through an indirect noun, which is the false positive the gap axis would have admitted', async () => {
    // Measured live at `canon/context/claude-plugin/overview.md`: widening
    // the trigger-to-number gap to two words reaches this sentence and reads
    // a domain's own membership as the catalog's total. The trigger
    // vocabulary carried both live misses without it, so the gap stayed shut
    // and this shape stays unread.
    seedSkills(63)
    write(
      'docs/overview.md',
      'It held the per-skill reasoning for a domain of 55 skills, so almost any change wrote it.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should read one figure per catalog per sentence, leaving a second figure in the same sentence unread', async () => {
    // The structural limit `regex.exec` imposes. Both figures are stale, both
    // sit inside the plausibility bound, and both carry a trigger against the
    // number. Only the first is read, so what drops the second is the single
    // match rather than any filter below it.
    seedSkills(63)
    write(
      'docs/regeneration.md',
      'The toolkit authors 59 skills and installs 40 skills into the cache.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([
      expect.objectContaining({ catalog: 'skills', stated: 59, actual: 63 }),
    ])
  })

  it('should report nothing when the stated figure matches the true count', async () => {
    seedSkills(2)
    write('docs/plugin.md', 'The full entry loads 2 skills at install time.\n')

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should read past a sentence carrying a calendar date', async () => {
    seedSkills(63)
    write(
      'docs/history.md',
      'Measured 2026-08-21, the entry loaded 59 skills at install time.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should read past a sentence carrying a commit reference', async () => {
    seedSkills(63)
    write(
      'docs/history.md',
      'At `a24b65ce` the entry loaded 59 skills at install time.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should read past code fences', async () => {
    seedSkills(63)
    write(
      'docs/example.md',
      [
        '```text',
        'The full entry loads 59 skills at install time.',
        '```',
        '',
      ].join('\n'),
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should not match a bare number-noun pair with no assertion verb ahead of it', async () => {
    seedSkills(63)
    write(
      'docs/history.md',
      'Twenty-one skill bodies name the standard most cited across the two catalogs.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should not confuse a delta pair for a match, since that shape is out of scope', async () => {
    seedSkills(63)
    write(
      'docs/history.md',
      'Two branches raised the audit verb count from three to four.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should not match a total reached through an indirect noun, since that shape is out of scope', async () => {
    seedSkills(63)
    write(
      'docs/census.md',
      'The usage census stated a denominator of sixty-one shipped skills.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should drop a verb-gated match whose figure sits nowhere near the true count', async () => {
    // The exact shape a live run against this repository's own tree
    // produced: `standards/standard.md carries two rules about a
    // standard's own lifecycle` reads `rules` as prescriptive statements in
    // one document, not as this tree's governance-rule catalog, and 2 next
    // to a true count of 63 is the signal that tells the two apart.
    seedSkills(63)
    write(
      'docs/standard.md',
      "`standards/standard.md` carries two skills about a standard's own lifecycle.\n",
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
  })

  it('should match a subset qualified by an adjective when the sentence carries no date', async () => {
    // The trade the article gate carries: `flat` fills the same
    // optional-word slot `sixty-one shipped skills` needs to match at all,
    // so a named subset (skills outside some other group) reads the same as
    // a restated whole. No syntactic rule tells the two apart, so the real
    // fix for a case like this is dating the clause as a past state, not
    // narrowing the matcher, which is what the equivalent instance in
    // `canon/context/standards/destinations.md` was repaired with.
    seedSkills(27)
    write(
      'docs/history.md',
      'The fallback already reached the 21 flat skills.\n',
    )

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([
      expect.objectContaining({
        file: 'docs/history.md',
        catalog: 'skills',
        stated: 21,
        actual: 27,
      }),
    ])
  })

  it('should read past a commands claim when the tree carries no CLI entry point', async () => {
    seedSkills(63)
    write('docs/cli.md', 'This CLI ships 31 commands today.\n')

    const report = measured(await scanCounts(ROOT))

    expect(report.findings).toEqual([])
    expect(report.catalogs.commands).toBeUndefined()
  })

  it('should report the true count read for every catalog', async () => {
    seedSkills(2)
    write('docs/plugin.md', '# Plugin\n')

    const report = measured(await scanCounts(ROOT))

    expect(report.catalogs.skills).toBe(2)
  })
})
