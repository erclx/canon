import type { SkillsAuditRefusal } from '@/claude/skills-audit'
import type { RankRefusal } from '@/claude/skills-rank'
import type { ReachRefusal } from '@/claude/skills-reach'
import type { ContextAuditRefusal } from '@/context/audit'
import type { AuditRefusal } from '@/deps/audit'
import type { RuleAuditRefusal } from '@/gov/audit'
import type { RestatedRefusal } from '@/gov/restated'
import type { LabelAuditRefusal } from '@/labels/audit'
import type { ValidateRefusal as RecordRefusal } from '@/records/validate'
import type { ScanRefusal } from '@/secrets/scan'
import type { ValidateRefusal as BoardRefusal } from '@/tasks/validate'

/**
 * The audits this repository already owns, and how to read each one's record.
 * Each verb keeps its own `--json` shape, since an envelope would break every
 * existing consumer of those records.
 */

/** How far a finding from this audit reaches. */
export type Corpus =
  /** Committed, so every clone measures the same files and a delta is shared. */
  | 'tracked'
  /** Gitignored session scratch, so the numbers are one machine's alone. */
  | 'per-machine'
  /**
   * Read from an index off this machine, so the count moves when someone
   * publishes. A baseline would record growth nobody caused, and an unreachable
   * index is an ordinary absence rather than a broken checkout.
   */
  | 'upstream'

export type AuditStatus =
  /** The audit reported and every count it produced is zero. */
  | 'clean'
  /** The audit reported findings it does not gate on. */
  | 'reported'
  /** The audit reported a finding that is a fact, which fails the aggregate. */
  | 'finding'
  /**
   * The per-machine corpus this audit reads is not on this disk, which is the
   * ordinary state of a gitignored folder on a fresh clone and in CI.
   */
  | 'absent'
  /** The audit did not report, so the aggregate measured less than the set. */
  | 'unmeasured'

export interface AuditSpec {
  readonly id: string
  readonly label: string
  /** Arguments after `canon`, always ending in `--json`. */
  readonly argv: readonly string[]
  /**
   * Exit codes this verb sets on a finding that is a fact, empty for a judgment.
   * The catalog decides this, since a reporting verb sets 2 on findings it does
   * not gate on and the code alone cannot say whether one is a fact.
   */
  readonly gatingExits: readonly number[]
  readonly corpus: Corpus
  /**
   * Refusal reasons that mean this audit has no corpus here rather than that
   * it broke. A tracked corpus normally allows none, and the secret scan is
   * the exception, since a project that publishes nothing ships no tree.
   */
  readonly absentReasons?: readonly string[]
  /**
   * Pulls the counts worth retaining out of this verb's record, or `undefined`
   * when the record lacks the keys it reads. Zero there would read as clean
   * for a measure that did not run.
   */
  readonly counts: (record: unknown) => Record<string, number> | undefined
  /**
   * Growth fractions by count key, of the recorded value, that move a key
   * without counting toward `summary.grown`. A fraction scales to each
   * project's baseline, and a key with none compares exactly.
   */
  readonly tolerance?: Readonly<Record<string, number>>
}

export interface AuditResult {
  readonly id: string
  readonly label: string
  readonly status: AuditStatus
  /** Retained by the baseline, which is `tracked` alone. */
  readonly tracked: boolean
  /** Why it is or is not retained, which `tracked` alone cannot say. */
  readonly corpus: Corpus
  readonly exitCode: number
  readonly counts?: Record<string, number>
  /** Why the audit did not report, present only on `unmeasured`. */
  readonly reason?: string
  /** Wall time the spawn took, from the aggregate's own clock. */
  readonly ms: number
}

/** The exit code every command here sets when it refuses. */
const EXIT_REFUSED = 1

/** The exit code every command here sets when it carries findings. */
const EXIT_FINDINGS = 2

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

function lengthOf(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined
}

/**
 * Folds per-key readings into one record, or `undefined` when any could not be
 * read, since a partial count under a whole-sounding name would be published
 * from a shape the extractor was not written against.
 */
function allOf(
  readings: Record<string, number | undefined>,
): Record<string, number> | undefined {
  const counts: Record<string, number> = {}
  for (const [key, value] of Object.entries(readings)) {
    if (value === undefined) return undefined
    counts[key] = value
  }
  return counts
}

/**
 * Reads the requirements record's one cap, or nothing when the record is
 * absent, states no cap, or the run never opened it. The key is optional, so a
 * record from an older binary still counts its other findings.
 */
function requirementsCounts(
  root: Record<string, unknown>,
): Record<string, number> {
  const record = asObject(root.requirements)
  if (
    record === undefined ||
    typeof record.words !== 'number' ||
    typeof record.wordCap !== 'number'
  ) {
    return {}
  }
  return { requirementsOverWords: record.words > record.wordCap ? 1 : 0 }
}

function contextCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  const entries = root.entries
  if (!Array.isArray(entries)) return undefined

  let bareReferences = 0
  for (const entry of entries) {
    const bare = lengthOf(asObject(entry)?.bareReferences)
    if (bare === undefined) return undefined
    bareReferences += bare
  }

  const requirements = requirementsCounts(root)

  const counts = allOf({
    unresolvedCitations: lengthOf(asObject(root.citations)?.unresolved),
    longEntries: lengthOf(root.length),
    missingSections: lengthOf(root.missingSections),
    indexDrift: lengthOf(root.indexDrift),
    bareReferences,
  })

  if (counts === undefined) return undefined
  return { ...counts, ...requirements }
}

function markdownCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  const entries = root.entries
  if (!Array.isArray(entries)) return undefined

  const depth = asObject(root.checkpoints)?.run
  // A depth reading needs its checkpoint, or zero would report an unmeasured corpus as clean.
  if (entries.length > 0 && typeof depth !== 'number') return undefined

  let bans = 0
  let heavyBullets = 0
  let heavyParagraphs = 0
  let filesPastDepth = 0
  let flatParagraphs = 0

  for (const raw of entries) {
    const entry = asObject(raw)
    if (entry === undefined) return undefined

    const entryBans = lengthOf(entry.bans)
    const bullets = lengthOf(entry.heavyBullets)
    const paragraphs = lengthOf(entry.heavyParagraphs)
    const run = entry.longestRun
    if (
      entryBans === undefined ||
      bullets === undefined ||
      paragraphs === undefined ||
      typeof run !== 'number'
    ) {
      return undefined
    }

    bans += entryBans
    heavyBullets += bullets
    heavyParagraphs += paragraphs
    if (typeof depth === 'number' && run > depth) filesPastDepth += 1

    // A file below the measuring floor carries no cadence key, so it was not measured.
    const flat = asObject(entry.cadence)?.flat
    if (typeof flat === 'number') flatParagraphs += flat
  }

  return { bans, heavyBullets, heavyParagraphs, filesPastDepth, flatParagraphs }
}

/** The finding arrays `canon claude skills audit` publishes, in its own order. */
const SKILL_FINDINGS = [
  'missingRequirement',
  'nameMismatch',
  'missingDescription',
  'longDescription',
  'readme',
  'folderName',
  'requirementSections',
] as const

function skillCounts(record: unknown): Record<string, number> | undefined {
  const findings = asObject(asObject(record)?.findings)
  if (findings === undefined) return undefined

  return allOf(
    Object.fromEntries(
      SKILL_FINDINGS.map((key) => [key, lengthOf(findings[key])]),
    ),
  )
}

/**
 * Reads the unqualified citations alone, since a qualified one is a repair
 * that landed and folding it in would report a corpus worsening as it is fixed.
 * A record carrying neither array is a shape that moved, not an empty catalog.
 */
function reachCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined || !Array.isArray(root.qualified)) return undefined

  return allOf({ unqualifiedCitations: lengthOf(root.unqualified) })
}

/**
 * Reads the routing measure's miss and unmeasurable counts, leaving `rank1`
 * and `top3` out, since both move in lockstep with `misses`. `unmeasurable`
 * stays, as it counts a defect in the instrument rather than a collision.
 */
function rankCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  return allOf({
    misses: lengthOf(root.misses),
    unmeasurable: lengthOf(root.unmeasurable),
  })
}

function boardCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  // The board keeps untested rows apart from findings so they move no exit code.
  return allOf({
    findings: lengthOf(root.findings),
    untested: lengthOf(root.untested),
  })
}

/**
 * Reads the advisory verb's per-severity object rather than a total, since a
 * critical advisory folds into a low one and the responses differ. Keys come
 * off the record, so a severity the index adds is carried rather than dropped.
 */
function advisoryCounts(record: unknown): Record<string, number> | undefined {
  const severities = asObject(asObject(record)?.severities)
  if (severities === undefined) return undefined

  const counts: Record<string, number> = {}
  for (const [severity, value] of Object.entries(severities)) {
    if (typeof value !== 'number') return undefined
    counts[`advisories-${severity}`] = value
  }

  return counts
}

/**
 * Reads the uncovered paths alone, which is the half that is a finding. The
 * declined paths are whichever rows this branch touched, so a clean trunk reads
 * zero and retaining them would make a quiet exit 0 report as carrying findings.
 */
function labelCoverageCounts(
  record: unknown,
): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  return allOf({ uncovered: lengthOf(root.uncovered) })
}

/**
 * Reads the two classes that are findings, leaving the declared mirrors out,
 * since an authoring root and its consumed copy duplicate on purpose. The reach
 * count is left out too, as it moves in lockstep with the two retained here.
 */
function restatedCounts(record: unknown): Record<string, number> | undefined {
  const counts = asObject(asObject(record)?.counts)
  if (counts === undefined) return undefined

  return allOf({
    contradictions:
      typeof counts.contradictions === 'number'
        ? counts.contradictions
        : undefined,
    repetitions:
      typeof counts.repetitions === 'number' ? counts.repetitions : undefined,
  })
}

/**
 * Counts rules rather than findings, since a rule past four limits is one
 * rewrite, and keeps the two ledger findings apart because a missing ledger and
 * a short one are fixed by different passes.
 */
function ruleCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  const rules = root?.rules
  if (!Array.isArray(rules)) return undefined

  let shapeRules = 0
  let missingLedgers = 0
  let ledgerMismatches = 0

  for (const raw of rules) {
    const rule = asObject(raw)
    const findings = lengthOf(rule?.findings)
    const ledger = asObject(rule?.ledger)
    if (findings === undefined || ledger === undefined) return undefined

    if (findings > 0) shapeRules += 1
    if (ledger.status === 'missing') missingLedgers += 1
    if ((lengthOf(ledger.mismatches) ?? 0) > 0) ledgerMismatches += 1
  }

  // A target ledger with no rule sits beside `rules`, and an older binary's missing `orphans` reads as none.
  const orphanLedgers = lengthOf(root?.orphans) ?? 0

  return { shapeRules, missingLedgers, ledgerMismatches, orphanLedgers }
}

function findingsOnly(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  return allOf({ findings: lengthOf(root.findings) })
}

function commentCounts(record: unknown): Record<string, number> | undefined {
  const snapshot = asObject(record)?.snapshot
  if (!Array.isArray(snapshot)) return undefined

  let degradationHits = 0
  let longBlocks = 0
  let hasLongBlocks = true
  for (const language of snapshot) {
    const hits = lengthOf(asObject(language)?.degradationHits)
    if (hits === undefined) return undefined
    degradationHits += hits

    // A record from a binary older than the long-block measure carries no array, so the key is left out.
    const blocks = lengthOf(asObject(language)?.longBlocks)
    if (blocks === undefined) hasLongBlocks = false
    else longBlocks += blocks
  }

  return hasLongBlocks ? { degradationHits, longBlocks } : { degradationHits }
}

/**
 * Reads the census's three headline totals and the count of large folders,
 * leaving the extension breakdown and folder list out, since folding those in
 * would grow the recorded key set with every language and path the tree adds.
 */
function censusCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined || !Array.isArray(root.byExtension)) return undefined

  return allOf({
    files: typeof root.files === 'number' ? root.files : undefined,
    skipped: typeof root.skipped === 'number' ? root.skipped : undefined,
    lines: typeof root.lines === 'number' ? root.lines : undefined,
    largeFolders: lengthOf(root.folders),
  })
}

/**
 * Reads the long file and function counts, leaving embedded blocks out, since
 * the `embedded-programs` stage already fails a push on those. The unread file
 * count travels along, since a function count alone claims files never followed.
 */
function codeCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  return allOf({
    longFiles: lengthOf(root.longFiles),
    longFunctions: lengthOf(root.longFunctions),
    unreadFiles: lengthOf(root.unreadFiles),
  })
}

function testOrderCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  // The unclassified count travels with the findings, since a findings count alone overclaims.
  return allOf({
    findings: lengthOf(root.findings),
    unclassified: lengthOf(root.unclassified),
  })
}

/**
 * The record kinds whose findings the aggregate counts, and the corpus each
 * reads. `sessions` is left out because it reports length alone and never a
 * finding, so a row for it would always count zero.
 */
const RECORD_KINDS: readonly (readonly [string, Corpus])[] = [
  ['plans', 'per-machine'],
  ['groundwork', 'per-machine'],
  ['intake', 'per-machine'],
]

/**
 * Every audit the aggregate runs. `context`, `markdown`, and `skills` gate
 * because the merge gate already fails a push on each, and `secrets` gates with
 * no stage behind it, since a credential in the published tree is a fact.
 */
export const AUDITS: readonly AuditSpec[] = [
  {
    id: 'context',
    label: 'Context folders',
    argv: ['context', 'audit', '--json'],
    gatingExits: [EXIT_FINDINGS],
    corpus: 'tracked',
    // The one refusal that is an absence, since no target adopts both context folders.
    absentReasons: ['no-folders'] satisfies ContextAuditRefusal[],
    counts: contextCounts,
  },
  {
    id: 'markdown',
    label: 'Markdown corpus',
    argv: ['markdown', 'audit', '--json'],
    // 3 is the empty ban set, which is the corpus walked with nothing looked
    // for. That is a broken check rather than a clean tree, so it fails here
    // the way it already fails the push.
    gatingExits: [EXIT_FINDINGS, 3],
    corpus: 'tracked',
    counts: markdownCounts,
  },
  {
    id: 'skills',
    label: 'Skill corpora',
    argv: ['claude', 'skills', 'audit', '--json'],
    gatingExits: [EXIT_FINDINGS],
    corpus: 'tracked',
    // The one reason this verb refuses for, and it is an absence for the same
    // reason the reach check's is: a project carrying neither `claude/skills/`
    // nor `.claude/skills/` has adopted no skill convention this audit reads.
    absentReasons: ['no-corpus'] satisfies SkillsAuditRefusal[],
    counts: skillCounts,
  },
  {
    id: 'skills-reach',
    label: 'Shipped citation reach',
    argv: ['claude', 'skills', 'reach', '--json'],
    // Reports rather than gates, since a toolkit path in a body may be meant for this repository.
    gatingExits: [],
    corpus: 'tracked',
    // The one refusal that is an absence, since a project with no skill folder adopted no convention.
    absentReasons: ['no-skills'] satisfies ReachRefusal[],
    counts: reachCounts,
  },
  {
    id: 'skills-rank',
    label: 'Skill routing measure',
    argv: ['claude', 'skills', 'rank', '--json'],
    // Reports rather than gates, since a lexical ranker bounds a necessary condition only.
    gatingExits: [],
    corpus: 'tracked',
    // An absence for the same reason as the reach check, and the case-corpus refusals never arise here.
    absentReasons: ['no-skills'] satisfies RankRefusal[],
    counts: rankCounts,
  },
  {
    id: 'tasks',
    label: 'Task board',
    argv: ['tasks', 'validate', '--json'],
    gatingExits: [],
    corpus: 'per-machine',
    counts: boardCounts,
  },
  ...RECORD_KINDS.map(([kind, corpus]) => ({
    id: `records-${kind}`,
    label: `Records: ${kind}`,
    argv: ['records', 'validate', kind, '--json'],
    gatingExits: [],
    corpus,
    counts: findingsOnly,
  })),
  {
    id: 'comments',
    label: 'Comment census',
    argv: ['comments', 'scan', '--json'],
    gatingExits: [],
    corpus: 'tracked',
    counts: commentCounts,
  },
  {
    id: 'test-order',
    label: 'Test order',
    argv: ['gov', 'test-order', '--json'],
    gatingExits: [],
    corpus: 'tracked',
    counts: testOrderCounts,
  },
  {
    id: 'secrets',
    label: 'Shipped tree secrets',
    argv: ['secrets', 'scan', '--json'],
    // The fourth gate, since a credential-shaped value in the published tree is a fact.
    gatingExits: [EXIT_FINDINGS],
    corpus: 'tracked',
    // These reasons mean the tree publishes nothing, and `no-git` and `no-files-field` stay out, as the corpus went unread.
    absentReasons: [
      'no-manifest',
      'no-publish',
      'no-shipped-files',
    ] satisfies ScanRefusal[],
    counts: findingsOnly,
  },
  {
    id: 'labels',
    label: 'Pull request label coverage',
    argv: ['labels', 'audit', '--json'],
    // Reports rather than gates, since whether an uncovered surface deserves a label is a judgment.
    gatingExits: [],
    // The map is committed, so every clone reads the same rows and a delta is
    // shared. The changed set the rows are read against is the branch's, which
    // is what makes a clean trunk report zero rather than nothing.
    corpus: 'tracked',
    // Only `uncovered` is retained, and `no-map` is the one absence, since an unparsed map or failed range went unread.
    absentReasons: ['no-map'] satisfies LabelAuditRefusal[],
    counts: labelCoverageCounts,
  },
  {
    id: 'restated',
    label: 'Restated instructions',
    argv: ['gov', 'restated', '--json'],
    // Reports rather than gates, since most restatements are correct and a push failing on one would fail the ordinary case.
    gatingExits: [],
    corpus: 'tracked',
    // Both sweep refusals are absences, since a target holds neither the seed nor a shipped skills tree.
    absentReasons: [
      'no-instructions',
      'no-surfaces',
    ] satisfies RestatedRefusal[],
    counts: restatedCounts,
  },
  {
    id: 'rules',
    label: 'Rule shape and ledgers',
    argv: ['gov', 'audit', '--json'],
    // Reports rather than gates. The corpus starts far from zero, and the
    // `rule-shape` stage already fails a push on each folder once its rewrite
    // lists it as gated, so gating the whole set here would fail every push.
    gatingExits: [],
    corpus: 'tracked',
    // A target that authors no rule of its own has no corpus here, which is an
    // absence rather than a break, on the same test the restated sweep takes.
    absentReasons: ['no-rules'] satisfies RuleAuditRefusal[],
    counts: ruleCounts,
  },
  {
    id: 'counts',
    label: 'Self-stated catalog counts',
    argv: ['gov', 'counts', '--json'],
    // Reports rather than gates, since the false-positive rate is read off the first real run.
    gatingExits: [],
    corpus: 'tracked',
    counts: findingsOnly,
  },
  {
    id: 'census',
    label: 'Codebase census',
    argv: ['census', '--json'],
    // Reports rather than gates. A file count is a measure, not a judgment, so
    // registering it here exists to retain growth against the baseline rather
    // than to fail a push on a number moving.
    gatingExits: [],
    corpus: 'tracked',
    counts: censusCounts,
    // Every merge grows the tree, so the fraction absorbs ordinary growth and re-recording follows when it runs out.
    tolerance: { files: 0.1, skipped: 0.1, lines: 0.1, largeFolders: 0.1 },
  },
  {
    id: 'code',
    label: 'Code length',
    argv: ['code', 'audit', '--json'],
    // Reports rather than gates. The verb exits 2 on an embedded block, which
    // the `embedded-programs` stage already fails a push on, and a long file or
    // function is a measure retained against the baseline rather than a fact.
    gatingExits: [],
    corpus: 'tracked',
    counts: codeCounts,
  },
  {
    id: 'deps',
    label: 'Dependency advisories',
    argv: ['deps', 'audit', '--json'],
    // Reports rather than gates, since a published advisory is a fact about the index and a judgment about this tree.
    gatingExits: [],
    corpus: 'upstream',
    counts: advisoryCounts,
  },
]

export function auditFor(id: string): AuditSpec | undefined {
  return AUDITS.find((audit) => audit.id === id)
}

export function isTracked(spec: AuditSpec): boolean {
  return spec.corpus === 'tracked'
}

export function countsFor(
  spec: AuditSpec,
  record: unknown,
): Record<string, number> | undefined {
  return spec.counts(record)
}

/**
 * Reads the reason a refusing verb published, so the aggregate names the cause
 * rather than only the exit. Every command here puts it in `reason`, and the
 * ones that also carry a sentence put that in `message`.
 */
function refusalReason(record: unknown, exitCode: number): string {
  const root = asObject(record)
  const reason = typeof root?.reason === 'string' ? root.reason : undefined
  const message = typeof root?.message === 'string' ? root.message : undefined

  if (reason !== undefined && message !== undefined) {
    return `${reason}: ${message}`
  }
  return reason ?? message ?? `exited ${exitCode} with no reason on stdout`
}

/**
 * The reasons a verb publishes when the folder it reads is simply not there.
 * Typed against the unions those verbs export, so a rename at the source fails
 * this build rather than quietly turning every expected absence unmeasured.
 */
const ABSENT_REASONS: readonly (RecordRefusal | BoardRefusal)[] = [
  'no-folder',
  'no-board',
]

/**
 * Every reason the advisory verb refuses for, all of which are an absence.
 * Typed against its own module's union, so a later reason or rename fails the
 * build rather than quietly matching nothing.
 */
const ADVISORY_ABSENT_REASONS: readonly AuditRefusal[] = [
  'no-record',
  'no-lockfile',
  'no-manifest',
]

/**
 * Whether a refusal is a folder this machine never created rather than a break.
 * A gitignored record folder is absent in CI, so counting it unmeasured would
 * pin `incomplete`, and a tracked corpus gets no such allowance since it ships.
 */
function absentReasonsFor(spec: AuditSpec): readonly string[] {
  if (spec.absentReasons !== undefined) return spec.absentReasons
  if (spec.corpus === 'per-machine') return ABSENT_REASONS
  if (spec.corpus === 'upstream') return ADVISORY_ABSENT_REASONS
  return []
}

function isExpectedAbsence(spec: AuditSpec, record: unknown): boolean {
  const allowed = absentReasonsFor(spec)
  if (allowed.length === 0) return false

  const reason = asObject(record)?.reason
  return typeof reason === 'string' && allowed.includes(reason)
}

/**
 * Turns one verb's exit code and stdout into a result the aggregate can report.
 * Unparseable output is `unmeasured` rather than clean, since a run that does
 * not report is a broken command and skipping would report the pass withheld.
 */
export function classify(
  spec: AuditSpec,
  exitCode: number,
  stdout: string,
  ms = 0,
): AuditResult {
  const base = {
    id: spec.id,
    label: spec.label,
    tracked: isTracked(spec),
    corpus: spec.corpus,
    exitCode,
    ms,
  }

  let record: unknown
  let parsed = true
  try {
    record = JSON.parse(stdout)
  } catch {
    parsed = false
  }

  if (exitCode === EXIT_REFUSED) {
    return {
      ...base,
      status: isExpectedAbsence(spec, record) ? 'absent' : 'unmeasured',
      reason: parsed
        ? refusalReason(record, exitCode)
        : `refused with no record on stdout`,
    }
  }

  const counts = parsed ? spec.counts(record) : undefined

  if (spec.gatingExits.includes(exitCode)) {
    return { ...base, status: 'finding', ...(counts && { counts }) }
  }

  if (exitCode !== 0 && exitCode !== EXIT_FINDINGS) {
    return {
      ...base,
      status: 'unmeasured',
      reason: `exited ${exitCode}, which this verb does not document`,
    }
  }

  if (counts === undefined) {
    return {
      ...base,
      status: 'unmeasured',
      reason: parsed
        ? 'the record did not carry the keys this audit reads'
        : 'stdout carried no JSON record',
    }
  }

  if (exitCode === EXIT_FINDINGS) {
    return { ...base, status: 'reported', counts }
  }

  const quiet = Object.values(counts).every((value) => value === 0)
  return { ...base, status: quiet ? 'clean' : 'reported', counts }
}
