import type { SkillsAuditRefusal } from '@/claude/skills-audit'
import type { RankRefusal } from '@/claude/skills-rank'
import type { ReachRefusal } from '@/claude/skills-reach'
import type { ContextAuditRefusal } from '@/context/audit'
import type { AuditRefusal } from '@/deps/audit'
import type { RestatedRefusal } from '@/gov/restated'
import type { LabelAuditRefusal } from '@/labels/audit'
import type { ValidateRefusal as RecordRefusal } from '@/records/validate'
import type { ScanRefusal } from '@/secrets/scan'
import type { ValidateRefusal as BoardRefusal } from '@/tasks/validate'

/**
 * The audits this repository already owns, and how to read each one's record.
 *
 * Every verb here ships its own `--json` shape with its own keys, and this
 * module reads each shape rather than forcing a common envelope on them. Each
 * record already has consumers, so an envelope would be a breaking change to
 * every one of them bought for tidiness.
 */

/** How far a finding from this audit reaches. */
export type Corpus =
  /** Committed, so every clone measures the same files and a delta is shared. */
  | 'tracked'
  /** Gitignored session scratch, so the numbers are one machine's alone. */
  | 'per-machine'
  /**
   * Read from an index off this machine, so the count moves when someone
   * publishes rather than when someone edits here.
   *
   * Its own member rather than either of the two above. A baseline would
   * record growth nobody caused, which is what keeps it out of the retained
   * set alongside per-machine scratch, and an index this run could not reach
   * is an ordinary absence rather than the broken checkout a missing tracked
   * tree would be.
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
   * Exit codes this verb sets on a finding that is a fact.
   *
   * Empty for every verb whose findings are judgments. The catalog decides
   * this rather than the exit code, because a reporting verb sets 2 on
   * findings it deliberately does not gate on, so the code alone cannot say
   * whether a finding is a fact.
   */
  readonly gatingExits: readonly number[]
  readonly corpus: Corpus
  /**
   * Refusal reasons that mean this audit has no corpus here rather than that
   * it broke, overriding what the corpus alone would allow.
   *
   * Present only where the corpus answers wrongly. A tracked corpus normally
   * allows nothing, since a tree that ships to targets and cannot be found is
   * a broken checkout, and the secret scan is the exception: a project that
   * publishes nothing has no shipped tree to read, which is an ordinary state
   * rather than a defect.
   */
  readonly absentReasons?: readonly string[]
  /**
   * Pulls the counts worth retaining out of this verb's record.
   *
   * Returns `undefined` when the record does not carry the keys it reads,
   * which is a measure that did not run rather than a corpus with nothing in
   * it. Zero there would read as clean, which is the two-states-look-alike
   * defect this repository has already fixed elsewhere.
   */
  readonly counts: (record: unknown) => Record<string, number> | undefined
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
 * Folds a set of per-key readings into one record, or `undefined` when any of
 * them could not be read. One unreadable key means the record is not the shape
 * the extractor was written against, and reporting the rest would publish a
 * partial count under a name that claims to be whole.
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
 * Reads the architecture record's three measures, or nothing when the project
 * carries no record.
 *
 * Three states rather than two, matching what the verb publishes. The key
 * absent is a run that never opened the record, which the aggregate never asks
 * for and so reads as a shape that moved. Null is a project entitled to carry
 * no record, whose other context counts still stand, so it contributes no key
 * rather than a zero that would read as a conforming record.
 */
function architectureCounts(
  root: Record<string, unknown>,
): Record<string, number> | undefined | 'absent' {
  if (!('architecture' in root)) return undefined
  if (root.architecture === null) return 'absent'

  const record = asObject(root.architecture)
  const decisions = record?.decisions
  if (
    record === undefined ||
    !Array.isArray(decisions) ||
    typeof record.lines !== 'number'
  ) {
    return undefined
  }

  // A record stating no length rule has no ceiling to be past, and reporting
  // zero there would read as one measured and found conforming.
  const ceiling =
    typeof record.ceiling === 'number' ? record.ceiling : undefined
  const entryCap =
    typeof record.entryCap === 'number' ? record.entryCap : undefined

  let unverifiable = 0
  let unchecked = 0
  for (const raw of decisions) {
    const entry = asObject(raw)
    const claim = entry?.claim
    const checks = lengthOf(entry?.checks)
    if (typeof claim !== 'string' || checks === undefined) return undefined

    if (claim === 'neither') unverifiable += 1
    else if (checks === 0) unchecked += 1
  }

  return {
    // A boolean, counted so the aggregate reads it the way it reads every
    // other measure. The verb gates on it separately, and the key is absent
    // rather than zero on a record that declared no ceiling.
    ...(ceiling !== undefined && {
      recordOverLength: record.lines > ceiling ? 1 : 0,
    }),
    // Absent on a record stating no entry cap, for the same reason.
    ...(entryCap !== undefined && {
      recordOverCount: decisions.length > entryCap ? 1 : 0,
    }),
    recordUnverifiable: unverifiable,
    recordUnchecked: unchecked,
  }
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

  const architecture = architectureCounts(root)
  if (architecture === undefined) return undefined

  const counts = allOf({
    unresolvedCitations: lengthOf(asObject(root.citations)?.unresolved),
    longEntries: lengthOf(root.length),
    missingSections: lengthOf(root.missingSections),
    indexDrift: lengthOf(root.indexDrift),
    bareReferences,
  })

  if (counts === undefined) return undefined
  return architecture === 'absent' ? counts : { ...counts, ...architecture }
}

function markdownCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  const entries = root.entries
  if (!Array.isArray(entries)) return undefined

  const depth = asObject(root.checkpoints)?.run
  // A depth reading needs the checkpoint it is measured against. Counting zero
  // without it reports a corpus nobody measured for depth as one with no file
  // past the line.
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

    // A file below the measuring floor carries no cadence key at all, which is
    // a file that was not measured rather than one with no flat paragraph.
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
 * Reads the unqualified citations alone, leaving the qualified ones out.
 *
 * A qualified citation is a repair that already landed, so folding the two
 * together would report a corpus getting worse every time one is fixed. The
 * key is still read rather than assumed present, since a record carrying
 * neither array is a shape that moved rather than a catalog with nothing in it.
 */
function reachCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined || !Array.isArray(root.qualified)) return undefined

  return allOf({ unqualifiedCitations: lengthOf(root.unqualified) })
}

/**
 * Reads the routing measure's miss and unmeasurable counts, leaving `rank1`
 * and `top3` out. Both move in lockstep with `misses` over a fixed-size
 * corpus, so carrying them would report one movement three times, the same
 * reasoning `restatedCounts` already takes over its own pair of derived
 * totals. `unmeasurable` is retained separately, since it counts a defect in
 * the instrument rather than a collision the catalog itself carries.
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

  // The board keeps its untested rows apart from its findings on purpose, so
  // they move no exit code. Folding them together here would undo that.
  return allOf({
    findings: lengthOf(root.findings),
    untested: lengthOf(root.untested),
  })
}

/**
 * Reads the advisory verb's per-severity object rather than a total.
 *
 * A single count folds a critical advisory into a low one, and the response to
 * the two differs. The keys are read off the record rather than listed here,
 * so a severity the index adds is carried instead of silently dropped.
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
 * Reads the uncovered paths alone, which is the half that is a finding.
 *
 * The declined paths are deliberately not counted. They are whichever declined
 * rows this branch happened to touch rather than a measure of the map, so a
 * clean trunk reads zero while the map declares eight, and the number would
 * describe the branch rather than the decision.
 *
 * Retaining it also broke the verdict. `classify` reads a clean run as quiet
 * only when every count is zero, so a branch touching one declined path exited
 * 0 and still reported as carrying findings.
 */
function labelCoverageCounts(
  record: unknown,
): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  return allOf({ uncovered: lengthOf(root.uncovered) })
}

/**
 * Reads the two classes that are findings, leaving the declared mirrors out.
 *
 * A mirror is an authoring root and its consumed copy, which duplicate on
 * purpose, so folding them in would report a corpus getting worse every time a
 * seed is kept in step with the file it is authored from. Same reasoning the
 * label audit drops its declined rows on.
 *
 * The reach count is left out for a different reason. It counts how many
 * surfaces an instruction reached rather than whether anything is wrong, and it
 * moves in lockstep with the two retained here, so a baseline carrying it would
 * report one movement twice.
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

function findingsOnly(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  return allOf({ findings: lengthOf(root.findings) })
}

function commentCounts(record: unknown): Record<string, number> | undefined {
  const snapshot = asObject(record)?.snapshot
  if (!Array.isArray(snapshot)) return undefined

  let degradationHits = 0
  for (const language of snapshot) {
    const hits = lengthOf(asObject(language)?.degradationHits)
    if (hits === undefined) return undefined
    degradationHits += hits
  }

  return { degradationHits }
}

/**
 * Reads the census's three headline totals, leaving the extension breakdown
 * out. The breakdown is what a caller reads for its own sake, and folding
 * every extension into the retained baseline would grow the recorded key set
 * with every language the tree ever picks up.
 */
function censusCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined || !Array.isArray(root.byExtension)) return undefined

  return allOf({
    files: typeof root.files === 'number' ? root.files : undefined,
    skipped: typeof root.skipped === 'number' ? root.skipped : undefined,
    lines: typeof root.lines === 'number' ? root.lines : undefined,
  })
}

function testOrderCounts(record: unknown): Record<string, number> | undefined {
  const root = asObject(record)
  if (root === undefined) return undefined

  // The unclassified count travels with the findings because it is the honest
  // shape of this measure: a refactor and a new behavior cannot be told apart
  // from history, and a findings count alone claims coverage it does not have.
  return allOf({
    findings: lengthOf(root.findings),
    unclassified: lengthOf(root.unclassified),
  })
}

/** The record kinds `canon records validate` takes, and the corpus each reads. */
const RECORD_KINDS: readonly (readonly [string, Corpus])[] = [
  ['plans', 'per-machine'],
  ['groundwork', 'per-machine'],
  ['intake', 'per-machine'],
  ['memory', 'per-machine'],
  ['standards', 'tracked'],
  ['teach', 'per-machine'],
]

/**
 * Every audit the aggregate runs.
 *
 * `context`, `markdown`, and `skills` gate because the merge gate in
 * `src/gate/stages.ts` already fails a push on each. `secrets` is the one entry that gates without
 * a stage behind it, added deliberately rather than as a side effect, since a
 * credential in the published tree is a fact and the split this repository
 * records gates a fact and reports a judgment. Weigh any further addition
 * against that test rather than against the count.
 *
 * Each verb runs once in its fullest form. Running the gating half separately
 * would walk the same tree twice for a number the full record already carries.
 */
export const AUDITS: readonly AuditSpec[] = [
  {
    id: 'context',
    label: 'Context folders',
    argv: ['context', 'audit', '--json'],
    gatingExits: [EXIT_FINDINGS],
    corpus: 'tracked',
    // The one reason this verb refuses for that is an absence rather than a
    // break, on the same test the reach check and the skill audit take: no
    // target adopts `canon/context/`, `.canon/diagrams/`, and
    // `canon/wireframes/` all at once, so without the allowance every such
    // project reports the verb unmeasured on every run and never changes.
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
    // Reports rather than gates, on the split this file already draws. A body
    // naming a toolkit path is sometimes correct, since the instruction may be
    // meant for a session in this repository, so the verdict is a judgment and
    // a push failing on one teaches a contributor to route around the stage.
    gatingExits: [],
    corpus: 'tracked',
    // The one reason this verb refuses for, and it is an absence rather than a
    // break. A tracked corpus normally allows nothing, since a tree that ships
    // to targets and cannot be found is a broken checkout, and this is the
    // second exception on the same test the secret scan takes: a project
    // carrying neither `claude/skills/` nor `.claude/skills/` has adopted no
    // skill convention, so without the allowance it reports the verb
    // unmeasured on every run and never changes, which is the permanent signal
    // the per-machine allowance exists against.
    absentReasons: ['no-skills'] satisfies ReachRefusal[],
    counts: reachCounts,
  },
  {
    id: 'skills-rank',
    label: 'Skill routing measure',
    argv: ['claude', 'skills', 'rank', '--json'],
    // Reports rather than gates. The corpus is a first run with no baseline to
    // fail a push against, and a lexical ranker bounds a necessary condition
    // rather than reporting real routing behavior, so a push failing on a
    // moved rank would teach a contributor to route around the stage.
    gatingExits: [],
    corpus: 'tracked',
    // The one reason this run refuses for, and it is an absence for the same
    // reason the reach check's is: a project carrying neither `claude/skills/`
    // nor `.claude/skills/` has adopted no skill convention this audit reads.
    // The two case-corpus refusals never reach here, since they need `--cases`
    // and this argv passes none.
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
    // `standards` is the one tracked kind here, so it takes none of the
    // per-machine default the other five inherit from their corpus. A target
    // reads standards through `canon standards` rather than a copy in its own
    // tree, so carrying no standards folder at all is the
    // ordinary state of every project but this repository.
    ...(kind === 'standards' && {
      absentReasons: ['no-folder'] satisfies RecordRefusal[],
    }),
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
    // The fourth gate, and the first added since the note above was written.
    // A credential-shaped value sitting in the tree this repository publishes
    // is a fact rather than a judgment, which is the test that note asks any
    // addition to pass. It is decided here and stated in the context entry
    // rather than arriving as a side effect of registering a measure.
    gatingExits: [EXIT_FINDINGS],
    corpus: 'tracked',
    // The three reasons that mean this tree publishes nothing, which is where
    // most targets installing this CLI sit. Without the allowance the
    // aggregate reports `incomplete` on every run in every such project and
    // never changes, which is the permanent signal the per-machine allowance
    // exists against.
    //
    // Two reasons are deliberately left out, and both are a corpus that exists
    // and went unread. `no-git` is a broken checkout, and `no-files-field` is a
    // publish that would pack the whole tree, so calling either an absence
    // would report a pass over a shipped tree nobody measured.
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
    // Reports rather than gates, on the split this file already draws. Whether
    // an uncovered surface deserves a label is a judgment, and a push failing
    // on one would ask a contributor to answer a question only the person who
    // owns the surface can.
    gatingExits: [],
    // The map is committed, so every clone reads the same rows and a delta is
    // shared. The changed set the rows are read against is the branch's, which
    // is what makes a clean trunk report zero rather than nothing.
    corpus: 'tracked',
    // Only `uncovered` is retained, for the reason its extractor states.
    //
    // The one reason that means this project declares no surfaces to cover,
    // which is the recorded decision that a project without a map is labelled
    // silently. A tracked corpus normally allows nothing absent, and this is
    // the second exception beside the secret scan rather than a default.
    //
    // The other three are deliberately left out. A map that will not parse, a
    // map with no usable row, and a range git could not answer are each a
    // corpus that exists and went unread, so calling any of them an absence
    // would report a pass over a branch nobody measured.
    absentReasons: ['no-map'] satisfies LabelAuditRefusal[],
    counts: labelCoverageCounts,
  },
  {
    id: 'restated',
    label: 'Restated instructions',
    argv: ['gov', 'restated', '--json'],
    // Reports rather than gates, on the split this file already draws. Whether
    // a rule stated on two surfaces should be stated on one is a judgment the
    // person owning the surface takes, and most restatements here are correct,
    // so a push failing on one would fail on the ordinary case.
    gatingExits: [],
    corpus: 'tracked',
    // Both reasons the sweep refuses for, and each is an absence rather than a
    // break. A target holds neither the seed nor a shipped skills tree, so
    // without the allowance every project installing this CLI reports the verb
    // unmeasured on every run and never changes, which is the permanent signal
    // the per-machine allowance exists against. Same shape as the reach verb.
    absentReasons: [
      'no-instructions',
      'no-surfaces',
    ] satisfies RestatedRefusal[],
    counts: restatedCounts,
  },
  {
    id: 'counts',
    label: 'Self-stated catalog counts',
    argv: ['gov', 'counts', '--json'],
    // Reports rather than gates, on the split this file already draws. The
    // false-positive rate is read off the first real run rather than assumed
    // ahead of it, and gating a measure with an unmeasured rate is what teaches
    // a contributor to route around the stage.
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
  },
  {
    id: 'deps',
    label: 'Dependency advisories',
    argv: ['deps', 'audit', '--json'],
    // Reports rather than gates, on the same split. A published advisory is a
    // fact about the index and a judgment about this tree, since the upgrade
    // may not exist yet, and a push failing on one teaches a contributor to
    // route around the stage while nothing about the dependency has changed.
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
 *
 * Typed against the unions those two verbs export rather than spelled as bare
 * strings, so renaming a reason at its source fails this build. A literal here
 * would go on matching nothing and quietly turn every expected absence back
 * into an unmeasured audit.
 */
const ABSENT_REASONS: readonly (RecordRefusal | BoardRefusal)[] = [
  'no-folder',
  'no-board',
]

/**
 * Every reason the advisory verb refuses for, all of which are an absence.
 *
 * An index it could not reach, a project that is not JavaScript, and one whose
 * dependencies were never resolved are three states in which there is nothing
 * to measure rather than something broken. The verb has no fourth reason, so
 * this is its whole union rather than a chosen subset, and typing it that way
 * fails the build if a later reason arrives without this decision being made.
 *
 * Typed against that module's own union for the reason the record reasons are:
 * a literal here would go on matching nothing after a rename and turn every
 * offline run back into an unmeasured audit.
 */
const ADVISORY_ABSENT_REASONS: readonly AuditRefusal[] = [
  'no-record',
  'no-lockfile',
  'no-manifest',
]

/**
 * Whether a refusal is a folder this machine never created rather than a break.
 *
 * Every gitignored record folder is absent on a fresh clone and in CI, so six
 * of the twelve refuse there on every run. Counting those as unmeasured pins
 * the verdict at `incomplete` forever, and a signal that never changes is one
 * nobody reads after the second time they see it.
 *
 * A tracked corpus gets no such allowance. That tree ships to targets, so a
 * checkout that cannot find it is broken, and reading the absence as ordinary
 * would report a pass over a corpus nobody measured.
 *
 * An upstream corpus takes the allowance for a different reason. Its index is
 * off this machine, so an offline run reaches nothing through no fault of the
 * tree, and pinning the verdict at incomplete every time the network is down
 * is the same signal-nobody-reads failure the per-machine case already names.
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
 *
 * Unparseable output is `unmeasured` rather than clean, for the reason the
 * verify pipeline already states about its own skipped stages: a run that does
 * not report is a broken command, and skipping would report the pass the check
 * exists to withhold.
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
