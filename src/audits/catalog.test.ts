import { describe, expect, it } from 'vitest'
import {
  AUDITS,
  auditFor,
  classify,
  countsFor,
  isTracked,
} from '@/audits/catalog'

function specFor(id: string) {
  const spec = auditFor(id)
  if (spec === undefined) throw new Error(`No audit registered as ${id}`)
  return spec
}

describe('the audit catalog', () => {
  it('should register every audit under a unique id', () => {
    const ids = AUDITS.map((audit) => audit.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should give every audit a non-empty argv ending in --json', () => {
    for (const audit of AUDITS) {
      expect(audit.argv.length).toBeGreaterThan(0)
      expect(audit.argv.at(-1)).toBe('--json')
    }
  })

  /**
   * Reads the catalog rather than naming an entry by hand, so a spec added
   * later with an empty or blank `absentReasons` array fails here instead of
   * silently reading every refusal on it as unmeasured.
   */
  it('should give every declared absence reason a non-empty string', () => {
    const declaring = AUDITS.filter((audit) => audit.absentReasons)

    expect(declaring.length).toBeGreaterThan(0)
    expect(
      declaring.every(
        (audit) =>
          (audit.absentReasons?.length ?? 0) > 0 &&
          audit.absentReasons?.every((reason) => reason.length > 0),
      ),
    ).toBe(true)
  })

  /**
   * Three of these are the ones `verify.sh` already runs, and `secrets` is the
   * one entry gating without a stage behind it, added on the recorded test
   * that a fact gates and a judgment reports. The list is asserted whole so a
   * fifth cannot arrive as a side effect of registering a measure, which is
   * the widening this aggregate exists not to do quietly.
   */
  it('should gate on exactly the checks whose findings are facts', () => {
    const gating = AUDITS.filter((audit) => audit.gatingExits.length > 0).map(
      (audit) => audit.id,
    )

    expect(gating.sort()).toEqual(['context', 'markdown', 'secrets', 'skills'])
  })

  /**
   * An advisory is published rather than committed, so recording it would
   * write a floor that moves with no edit here, and an index this run could
   * not reach is an absence rather than a broken checkout.
   */
  it('should treat the advisory index as an upstream corpus', () => {
    expect(specFor('deps').corpus).toBe('upstream')
    expect(isTracked(specFor('deps'))).toBe(false)
    expect(specFor('deps').gatingExits).toEqual([])
  })

  it('should treat a gitignored record folder as a per-machine corpus', () => {
    expect(isTracked(specFor('records-plans'))).toBe(false)
    expect(isTracked(specFor('records-standards'))).toBe(true)
    expect(isTracked(specFor('tasks'))).toBe(false)
    expect(isTracked(specFor('markdown'))).toBe(true)
  })

  /**
   * The regex layer is pinned so the retained tally is the same on every
   * machine, whichever model a clone has configured.
   */
  it('should run the placement sweep on the regex layer without gating', () => {
    const placement = specFor('placement')

    expect(placement.argv).toEqual([
      'context',
      'classify',
      'sweep',
      '--backend',
      'off',
      '--json',
    ])
    expect(placement.gatingExits).toEqual([])
    expect(placement.corpus).toBe('tracked')
  })

  it('should carry the duration the caller measured the spawn at', () => {
    const result = classify(specFor('markdown'), 0, '{}', 42)

    expect(result.ms).toBe(42)
  })

  it('should default the duration to zero for a caller that measured nothing', () => {
    const result = classify(specFor('markdown'), 0, '{}')

    expect(result.ms).toBe(0)
  })
})

describe('reading counts out of each record shape', () => {
  const contextRecord = {
    citations: { scanned: 776, total: 179, unresolved: [{ path: 'a.md' }] },
    length: [{ rel: 'a.md' }, { rel: 'b.md' }],
    missingSections: [],
    indexDrift: [{ rel: 'c.md' }],
    entries: [{ bareReferences: [{ line: 4 }] }, { bareReferences: [] }],
    architecture: {
      rel: 'canon/ARCHITECTURE.md',
      lines: 162,
      ceiling: 178,
      entryCap: 3,
      decisions: [
        { claim: 'countable', checks: [] },
        { claim: 'invariant', checks: ['scripts/core/check.sh'] },
        { claim: 'neither', checks: [] },
      ],
    },
  }

  it('should count the context audit findings by their own arrays', () => {
    expect(countsFor(specFor('context'), contextRecord)).toEqual({
      unresolvedCitations: 1,
      longEntries: 2,
      missingSections: 0,
      indexDrift: 1,
      bareReferences: 1,
      recordOverLength: 0,
      recordOverCount: 0,
      recordUnverifiable: 1,
      recordUnchecked: 1,
    })
  })

  it('should count a record past its own ceiling as over length', () => {
    const record = {
      ...contextRecord,
      architecture: { ...contextRecord.architecture, lines: 179 },
    }

    expect(countsFor(specFor('context'), record)?.recordOverLength).toBe(1)
  })

  it('should count a record holding more entries than its cap as over count', () => {
    const record = {
      ...contextRecord,
      architecture: { ...contextRecord.architecture, entryCap: 2 },
    }

    expect(countsFor(specFor('context'), record)?.recordOverCount).toBe(1)
  })

  it('should omit the count key for a record stating no cap', () => {
    const { entryCap, ...architecture } = contextRecord.architecture
    const counts = countsFor(specFor('context'), {
      ...contextRecord,
      architecture,
    })

    expect(counts).not.toHaveProperty('recordOverCount')
  })

  /**
   * Zero here would read as a record measured against a ceiling and found
   * conforming, where the truth is that it declared none to measure against.
   */
  it('should omit the length key for a record stating no ceiling', () => {
    const { ceiling, ...architecture } = contextRecord.architecture
    const counts = countsFor(specFor('context'), {
      ...contextRecord,
      architecture,
    })

    expect(counts).not.toHaveProperty('recordOverLength')
    expect(counts?.recordUnverifiable).toBe(1)
  })

  /**
   * A project entitled to carry no architecture record still has context
   * folders worth counting, and a zero under the record keys there would read
   * as a conforming record rather than as an absent one.
   */
  it('should count the folders alone when the project carries no record', () => {
    const record = { ...contextRecord, architecture: null }

    expect(countsFor(specFor('context'), record)).toEqual({
      unresolvedCitations: 1,
      longEntries: 2,
      missingSections: 0,
      indexDrift: 1,
      bareReferences: 1,
    })
  })

  it('should return no counts for a context record carrying no architecture key', () => {
    const { architecture, ...record } = contextRecord

    expect(countsFor(specFor('context'), record)).toBeUndefined()
  })

  it('should sum the markdown weights across every measured entry', () => {
    const record = {
      checkpoints: { run: 40 },
      entries: [
        {
          bans: [{ line: 1 }],
          longestRun: 73,
          heavyBullets: [{ line: 2 }, { line: 3 }],
          heavyParagraphs: [{ line: 4 }],
          cadence: { measured: 35, flat: 2 },
        },
        {
          bans: [],
          longestRun: 12,
          heavyBullets: [],
          heavyParagraphs: [{ line: 9 }],
          cadence: { measured: 10, flat: 1 },
        },
      ],
    }

    expect(countsFor(specFor('markdown'), record)).toEqual({
      bans: 1,
      heavyBullets: 2,
      heavyParagraphs: 2,
      filesPastDepth: 1,
      flatParagraphs: 3,
    })
  })

  /**
   * A file the audit measured no cadence on reports no `cadence` key at all,
   * which is a file below the measuring floor rather than a file with no flat
   * paragraph. Reading the absent key as zero would fold those two together.
   */
  it('should skip a markdown entry carrying no cadence reading', () => {
    const record = {
      checkpoints: { run: 40 },
      entries: [
        { bans: [], longestRun: 3, heavyBullets: [], heavyParagraphs: [] },
      ],
    }

    expect(countsFor(specFor('markdown'), record)?.flatParagraphs).toBe(0)
  })

  it('should count each skill finding array under its own name', () => {
    const record = {
      findings: {
        missingRequirement: [{ name: 'a' }],
        nameMismatch: [],
        missingDescription: [],
        longDescription: [{ name: 'b' }],
        readme: [],
        folderName: [],
        requirementSections: [],
      },
    }

    expect(countsFor(specFor('skills'), record)).toEqual({
      missingRequirement: 1,
      nameMismatch: 0,
      missingDescription: 0,
      longDescription: 1,
      readme: 0,
      folderName: 0,
      requirementSections: 0,
    })
  })

  it('should keep the board findings and its untested rows apart', () => {
    const record = { ok: true, findings: [{ kind: 'x' }], untested: [{}, {}] }

    expect(countsFor(specFor('tasks'), record)).toEqual({
      findings: 1,
      untested: 2,
    })
  })

  it('should count the unqualified citations and leave the repaired ones out', () => {
    const record = {
      bodies: 152,
      qualified: [{ path: 'standards/intake.md' }, { path: 'wiki/index.md' }],
      unqualified: [{ path: 'canon/context/transcripts.md' }],
    }

    expect(countsFor(specFor('skills-reach'), record)).toEqual({
      unqualifiedCitations: 1,
    })
  })

  it('should read a reach record carrying neither citation array as a shape that moved', () => {
    expect(countsFor(specFor('skills-reach'), { bodies: 152 })).toBeUndefined()
  })

  it('should count a record kind by its findings alone', () => {
    const record = { ok: true, kind: 'plans', records: 3, findings: [{}, {}] }

    expect(countsFor(specFor('records-plans'), record)).toEqual({ findings: 2 })
  })

  it('should sum the degradation hits across every scanned language', () => {
    const record = {
      snapshot: [
        { language: 'ts', degradationHits: [{}, {}] },
        { language: 'sh', degradationHits: [{}] },
      ],
    }

    expect(countsFor(specFor('comments'), record)).toEqual({
      degradationHits: 3,
    })
  })

  it('should report the test-order findings beside what it could not classify', () => {
    const record = {
      kind: 'measured',
      satisfied: [{}],
      findings: [],
      unclassified: [{}, {}, {}],
    }

    expect(countsFor(specFor('test-order'), record)).toEqual({
      findings: 0,
      unclassified: 3,
    })
  })

  /**
   * Absent rather than zero, for the reason the context audit already states
   * about `--citations-only`. A record the extractor could not read is a
   * measure that did not run, and zero there reads as a clean corpus.
   */
  it('should return no counts for a record missing the keys it reads', () => {
    expect(countsFor(specFor('markdown'), { unrelated: true })).toBeUndefined()
    expect(countsFor(specFor('context'), null)).toBeUndefined()
    expect(countsFor(specFor('tasks'), 'not an object')).toBeUndefined()
  })

  /**
   * The declined paths are whichever declined rows a branch touched rather
   * than a measure of the map, so retaining the count would put a number
   * describing the branch into a baseline that compares trees.
   */
  it('should count the uncovered paths and leave the declined ones out', () => {
    const record = {
      labels: ['cli'],
      declined: [{ path: 'CHANGELOG.md', reason: 'release-managed' }],
      uncovered: ['infra/main.tf'],
    }

    expect(countsFor(specFor('labels'), record)).toEqual({ uncovered: 1 })
  })

  it('should tally the placement sweep findings by verdict', () => {
    const record = {
      decision: 'ok',
      findings: [
        { file: 'a.md', verdict: 'KEEP' },
        { file: 'a.md', verdict: 'KEEP' },
        { file: 'b.md', verdict: 'REWRITE' },
      ],
    }

    expect(countsFor(specFor('placement'), record)).toEqual({
      keep: 2,
      rewrite: 1,
      move: 0,
    })
  })

  it('should read no placement counts from a record carrying no findings', () => {
    expect(countsFor(specFor('placement'), { decision: 'ok' })).toBeUndefined()
  })

  it('should retain the census totals and leave the extension breakdown out', () => {
    const record = {
      files: 1139,
      skipped: 4,
      lines: 42017,
      byExtension: [{ extension: 'md', files: 505, lines: 30000 }],
    }

    expect(countsFor(specFor('census'), record)).toEqual({
      files: 1139,
      skipped: 4,
      lines: 42017,
    })
  })
})

describe('classifying an audit run by its exit code', () => {
  const markdown = specFor('markdown')
  const comments = specFor('comments')

  it('should read a zero exit carrying a parseable record as clean', () => {
    const result = classify(markdown, 0, '{"entries":[],"checkpoints":{}}')

    expect(result.status).toBe('clean')
    expect(result.counts).toEqual({
      bans: 0,
      heavyBullets: 0,
      heavyParagraphs: 0,
      filesPastDepth: 0,
      flatParagraphs: 0,
    })
  })

  /**
   * A declined path moves no count, so a branch touching one and covering
   * everything else is quiet. Counting it read the run as carrying findings
   * while the verb had exited 0 and named none.
   */
  it('should read a branch touching only declined paths as clean', () => {
    const record = JSON.stringify({
      labels: ['cli'],
      declined: [{ path: 'CHANGELOG.md', reason: 'release-managed' }],
      uncovered: [],
    })

    expect(classify(specFor('labels'), 0, record).status).toBe('clean')
  })

  it('should read a gating exit as a finding that fails the aggregate', () => {
    const record = JSON.stringify({
      checkpoints: { run: 40 },
      entries: [
        {
          bans: [{ line: 1 }],
          longestRun: 3,
          heavyBullets: [],
          heavyParagraphs: [],
        },
      ],
    })

    const result = classify(markdown, 2, record)

    expect(result.status).toBe('finding')
    expect(result.counts?.bans).toBe(1)
  })

  it('should read the empty-ban-set exit as a finding rather than a refusal', () => {
    const result = classify(markdown, 3, '{"entries":[],"checkpoints":{}}')

    expect(result.status).toBe('finding')
  })

  /**
   * A judgment verb sets 2 on findings it never gates on, so the exit alone
   * cannot say whether a finding is a fact. The catalog decides, not the code.
   */
  it('should read a findings exit from a reporting verb as reported', () => {
    const result = classify(comments, 2, '{"snapshot":[]}')

    expect(result.status).toBe('reported')
  })

  it('should read a refusal as unmeasured and keep its reason', () => {
    const result = classify(comments, 1, '{"ok":false,"reason":"no-folder"}')

    expect(result.status).toBe('unmeasured')
    expect(result.reason).toContain('no-folder')
  })

  /**
   * Every gitignored record folder is absent on a fresh clone and in CI, so
   * six of the twelve refuse there on every run. Counting those as unmeasured
   * makes the incomplete verdict permanent, which is a signal nobody reads
   * after the second time they see it.
   */
  it('should read an absent per-machine corpus as absent rather than unmeasured', () => {
    const result = classify(
      specFor('records-plans'),
      1,
      '{"ok":false,"reason":"no-folder","message":"No plans folder"}',
    )

    expect(result.status).toBe('absent')
  })

  it('should read an absent board as absent under its own reason', () => {
    const result = classify(
      specFor('tasks'),
      1,
      '{"ok":false,"reason":"no-board","message":"No task board"}',
    )

    expect(result.status).toBe('absent')
  })

  /**
   * An offline run reaches no advisory index through no fault of this tree, so
   * it is the same ordinary absence a gitignored folder is. Reading it as
   * unmeasured would pin the verdict at incomplete on every machine without a
   * network, which is the permanent signal the case above already rejects.
   */
  it('should read an unreachable advisory index as absent', () => {
    const result = classify(
      specFor('deps'),
      1,
      '{"reason":"no-record","message":"lookup failed"}',
    )

    expect(result.status).toBe('absent')
  })

  /**
   * Every reason that verb refuses for is an absence: no index reached, no
   * JavaScript project, no resolved dependency set. A project that is none of
   * those is the ordinary case in a target, so reading any of the three as
   * unmeasured would pin the aggregate at `incomplete` there on every run.
   */
  it.each(['no-record', 'no-lockfile', 'no-manifest'])(
    'should read the advisory refusal %s as absent',
    (reason) => {
      const result = classify(
        specFor('deps'),
        1,
        JSON.stringify({ reason, message: 'nothing to measure' }),
      )

      expect(result.status).toBe('absent')
    },
  )

  it('should read an undocumented advisory refusal as unmeasured', () => {
    const result = classify(
      specFor('deps'),
      1,
      '{"reason":"exploded","message":"something else"}',
    )

    expect(result.status).toBe('unmeasured')
  })

  /**
   * A tree git cannot list is a broken checkout, so the scan reporting nothing
   * over it is a defect in the run rather than a project with no shipped tree.
   */
  it('should read a secret scan over a tree git cannot list as unmeasured', () => {
    const result = classify(
      specFor('secrets'),
      1,
      '{"reason":"no-git","message":"git could not list this tree"}',
    )

    expect(result.status).toBe('unmeasured')
  })

  /**
   * Most projects installing this CLI publish nothing and carry no `files`
   * field, so reading that as a broken corpus would pin every one of them at
   * `incomplete` on every run. The spec names both reasons for that case.
   */
  it('should read a project that publishes nothing as absent', () => {
    const result = classify(
      specFor('secrets'),
      1,
      '{"reason":"no-manifest","message":"No package.json carrying a files field"}',
    )

    expect(result.status).toBe('absent')
  })

  it('should read a files field matching nothing as absent', () => {
    const result = classify(
      specFor('secrets'),
      1,
      '{"reason":"no-shipped-files","message":"matched nothing git lists"}',
    )

    expect(result.status).toBe('absent')
  })

  it('should read a manifest declaring private as absent', () => {
    const result = classify(
      specFor('secrets'),
      1,
      '{"reason":"no-publish","message":"declares private"}',
    )

    expect(result.status).toBe('absent')
  })

  /**
   * A publish with no files field packs the whole tree, so the corpus exists
   * and went unread. Calling that an absence reports a pass over a shipped
   * tree nobody measured, which is the denial this split exists to remove.
   */
  it('should read an undeclared corpus as unmeasured rather than absent', () => {
    const result = classify(
      specFor('secrets'),
      1,
      '{"reason":"no-files-field","message":"a publish would pack the whole tree"}',
    )

    expect(result.status).toBe('unmeasured')
  })

  /**
   * A project carrying neither skill corpus refuses this verb on every run.
   * Reading that as unmeasured pins the whole aggregate at `incomplete` there
   * and never changes, which is the signal nobody reads after the second time
   * they see it.
   */
  it('should read a tree carrying no skill corpus as absent', () => {
    const result = classify(
      specFor('skills-reach'),
      1,
      '{"reason":"no-skills","message":"Neither corpus here"}',
    )

    expect(result.status).toBe('absent')
  })

  /**
   * A project adopting none of `canon/context/`, `.claude/diagrams/`, or
   * `canon/wireframes/` is the ordinary state of a target, the same test the
   * skill corpora take below.
   */
  it('should read a project with no audited context folder as absent', () => {
    const result = classify(
      specFor('context'),
      1,
      '{"root":"x","reason":"no-folders","message":"No audited folder found"}',
    )

    expect(result.status).toBe('absent')
  })

  it('should read a project with no skill corpus as absent', () => {
    const result = classify(
      specFor('skills'),
      1,
      '{"root":"x","reason":"no-corpus","message":"No skill corpus"}',
    )

    expect(result.status).toBe('absent')
  })

  it('should read a found secret as a finding that is a fact', () => {
    const result = classify(
      specFor('secrets'),
      2,
      '{"findings":[{"file":"a"}]}',
    )

    expect(result.status).toBe('finding')
  })

  /**
   * `standards` is the exception among the tracked specs, on the same test the
   * secret scan and the reach check already take: the install channel that
   * would have written `standards/` into a target closed, so a project other
   * than this toolkit's own checkout carries neither root by design rather
   * than by defect.
   */
  it('should read an absent standards corpus as absent', () => {
    const result = classify(
      specFor('records-standards'),
      1,
      '{"ok":false,"reason":"no-folder","message":"No standards folder"}',
    )

    expect(result.status).toBe('absent')
  })

  /**
   * A tracked corpus with no stated exception stays the default: a tree that
   * cannot be found is a defect in the checkout rather than an absence.
   */
  it('should read an absent tracked corpus with no exception as unmeasured', () => {
    const result = classify(
      specFor('context'),
      1,
      '{"root":"x","reason":"no-git","message":"git could not list the tree"}',
    )

    expect(result.status).toBe('unmeasured')
  })

  it('should read a per-machine refusal for any other reason as unmeasured', () => {
    const result = classify(
      specFor('records-plans'),
      1,
      '{"ok":false,"reason":"unknown-kind","message":"Not a record kind"}',
    )

    expect(result.status).toBe('unmeasured')
  })

  it('should read unparseable output as unmeasured rather than as clean', () => {
    const result = classify(markdown, 0, 'not json at all')

    expect(result.status).toBe('unmeasured')
    expect(result.counts).toBeUndefined()
  })

  it('should read an exit the verb never documents as unmeasured', () => {
    const result = classify(comments, 137, '')

    expect(result.status).toBe('unmeasured')
    expect(result.reason).toContain('137')
  })
})
