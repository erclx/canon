import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RULE_DIRS } from '@/gov/citations'

/** The always-loaded file whose bullets are the subjects this sweep matches. */
export const INSTRUCTIONS_REL = 'CLAUDE.md'

/** The seed a target receives, authored from the file above. */
export const SEED_REL = join('tooling', 'claude', 'seeds', 'CLAUDE.md')

/** The shipped plugin bodies, which is where a rule restated in prose lands. */
export const SHIPPED_SKILLS_REL = join('claude', 'skills')

/**
 * The project's own skill bodies. Here that is the toolkit's internal skills,
 * and in a target it is that project's own, which is equally a place a rule
 * gets restated in prose.
 */
export const PROJECT_SKILLS_REL = join('.claude', 'skills')

/** Every root a candidate body is read from, each reported under its own path. */
const SKILL_ROOTS: readonly string[] = [SHIPPED_SKILLS_REL, PROJECT_SKILLS_REL]

/*
 * Path-scoped rules are read from every root in `RULE_DIRS`, the authoring
 * roots rather than the consumed copy under `.claude/rules/`. A stack takes a
 * whole rule folder, so a bullet landing anywhere under `governance/rules/`
 * ships to every target the stack reaches, the same way a bullet in the
 * always-loaded file or the seed does, and `internal/rules/` loads the same
 * way for every session in this repository. That is what makes a rule an
 * instruction surface rather than a place a rule is merely quoted, and it is
 * why a bullet moved into either root from the seed still belongs to the
 * corpus this sweep reads rather than leaving it.
 */

/**
 * Path pairs whose duplication is deliberate and already recorded.
 *
 * The seed is authored from the always-loaded file and `seed-sync`
 * exists to reconcile the two, so a bullet appearing in both is the design
 * rather than a defect. Excluding by pair rather than by content is what the
 * plan settled on: the duplication is a location fact this repository already
 * records, and a content test would have to rediscover it on every run.
 *
 * The exclusion reaches a repetition alone. A mirror that disagrees is the one
 * shape the pairing cannot absorb, since the two files are meant to agree, so
 * a polarity split on a declared pair stays a finding.
 */
const MIRRORS: readonly (readonly [string, string])[] = [
  [INSTRUCTIONS_REL, SEED_REL],
]

/**
 * A token appearing in more than this many statements carries no signal.
 *
 * Under one percent of the 2750 statements this repository offers. Tuned
 * against that corpus rather than reasoned to, which is what the plan asked of
 * the first run: `.canon/plans/` sits at 14 and is the anchor the motivating
 * case turns on, while `file` sits at 371 and matches most of the tree.
 */
export const COMMON_CEILING = 20

/** Weight two statements must share before they are read as one rule. */
export const ANCHOR_FLOOR = 3

/**
 * What a backticked token is worth against a plain word.
 *
 * An author marking a span as code named an identifier rather than describing
 * one, so `.canon/plans/archive/` says more about what a statement governs
 * than any two prose words do. Weighting it is what lets the floor rise high
 * enough to drop a coincidental word pair without losing a rule two surfaces
 * spelled entirely differently around one shared path.
 */
const SPAN_WEIGHT = 2

/**
 * Weight a match needs before a polarity split is called a contradiction.
 *
 * Above the match floor on purpose. A thin match says two statements touch the
 * same subject, which is not enough to claim one forbids what the other
 * prescribes, so a weak pair reports as a repetition and the loudest class is
 * reserved for a pair sharing real identity.
 */
export const CONTRADICTION_FLOOR = 5

/**
 * Words carrying no subject, dropped before anchors are counted.
 *
 * Short rather than exhaustive. The document-frequency ceiling above removes
 * the rest on its own, and a hand-written list long enough to do that job
 * would be a second corpus nobody maintains.
 */
const STOPWORDS = new Set([
  'about',
  'after',
  'against',
  'already',
  'also',
  'and',
  'any',
  'are',
  'because',
  'been',
  'before',
  'being',
  'both',
  'but',
  'can',
  'each',
  'either',
  'else',
  'every',
  'for',
  'from',
  'has',
  'have',
  'her',
  'here',
  'his',
  'how',
  'into',
  'its',
  'itself',
  'more',
  'most',
  'much',
  'must',
  'once',
  'one',
  'only',
  'other',
  'our',
  'out',
  'over',
  'own',
  'per',
  'rather',
  'same',
  'she',
  'should',
  'since',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'too',
  'under',
  'until',
  'upon',
  'very',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whose',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
])

/**
 * Markers reading as a prohibition, which is the one polarity signal available
 * without understanding the sentence.
 *
 * Deliberately narrow. `no` and `not` are excluded because both appear inside
 * ordinary qualifying clauses, and widening the set turns most of the corpus
 * into a suspected contradiction.
 */
const PROHIBITIONS = ['never', 'do not', "don't", 'avoid', 'refuse']

/**
 * A `no` opening a clause or a comma-set phrase directly on a code span, as in
 * `pinned to major tags, no `@latest``.
 *
 * `no` is admitted here and only here, since sitting on a backticked
 * identifier it names the thing ruled out rather than qualifying a verb. The
 * phrase boundary is what keeps description out: `returns no `jq` output` puts
 * the marker after a verb and reports what happens.
 *
 * `not` and `never` stay out. Admitting them turned two agreeing pairs into
 * contradictions, `, not `pwd`` and `, never `@latest``, because the subject
 * each matched spelled its own negation on plain words or in a clause the
 * anchors tied against, so the reading flipped on one side alone.
 */
const NEGATED_SPAN = /(?:^|[,;:(])\s*no\s+`/

export type RestatedRefusal = 'no-instructions' | 'no-surfaces'

export type Restatement = 'mirror' | 'repetition' | 'contradiction'

/** Which surface a restatement was found on, before any class is assigned. */
export type SurfaceKind = 'seed' | 'skill' | 'rule'

/**
 * Which surface a later edit starts from.
 *
 * `unknown` is a first-class answer rather than a gap. The content-ownership
 * table assigns a cross-domain rule and a domain-triggered one, and reaches
 * nothing stated in a skill body the always-loaded file never names, so
 * guessing there would put a reader on a surface nobody decided.
 */
export type Authority = 'claude-md' | 'skill-body' | 'unknown'

export interface Statement {
  /** Repository-relative, so a record reads the same from any working root. */
  readonly file: string
  /** One-based, matching the `file:line` form a reader clicks. */
  readonly line: number
  readonly text: string
}

export interface Surface extends Statement {
  readonly kind: SurfaceKind
  readonly restatement: Restatement
  /** The distinctive tokens this match rested on, so a finding is auditable. */
  readonly anchors: readonly string[]
  /** Those anchors scored, with a backticked one counting double. */
  readonly weight: number
  readonly authority: Authority
  /** Why the class and the authority read the way they do. */
  readonly reason: string
}

export interface RestatedEntry {
  readonly subject: Statement
  readonly surfaces: readonly Surface[]
}

export interface RestatedCounts {
  readonly contradictions: number
  readonly repetitions: number
  readonly mirrors: number
  /** Duplicate clusters reaching three statements or more, the title's count. */
  readonly threeSurface: number
}

export type RestatedReport =
  | {
      readonly kind: 'measured'
      readonly corpus: {
        readonly instructions: number
        readonly seed: number
        readonly bodies: number
        /** Distinct rule files a bullet was read from, counted like `bodies`. */
        readonly rules: number
        /** Statements the three further surfaces offered, which bounds recall. */
        readonly candidates: number
      }
      readonly matcher: {
        readonly anchors: number
        readonly common: number
        readonly contradiction: number
      }
      readonly restatements: readonly RestatedEntry[]
      readonly counts: RestatedCounts
    }
  | { readonly kind: 'unreadable'; readonly reason: RestatedRefusal }

interface Candidate extends Statement {
  readonly kind: SurfaceKind
  /** The skill folder this statement sits in, present on a body alone. */
  readonly skill?: string
}

export interface Analysis {
  readonly tokens: ReadonlySet<string>
  /** The subset an author backticked, which weighs more than a plain word. */
  readonly spans: ReadonlySet<string>
}

/** A statement paired with the tokens it carries. */
interface Indexed<T extends Statement> {
  readonly statement: T
  readonly analysis: Analysis
}

/**
 * Splits text into the tokens an anchor can be drawn from.
 *
 * A code span keeps its inner text whole, since `.canon/plans/archive/` is the
 * strongest anchor this corpus offers and splitting it on the punctuation would
 * leave three words every second bullet also carries.
 */
export function analyze(text: string): Analysis {
  const spans: string[] = []
  const withoutSpans = text.replace(/`([^`]+)`/g, (_match, inner: string) => {
    spans.push(inner.toLowerCase())
    return ' '
  })

  const words = withoutSpans
    .toLowerCase()
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2')
    .split(/[^a-z0-9/._<>-]+/)
    .map((word) => word.replace(/^[-._/]+|[-._/,;:]+$/g, ''))

  const keep = (token: string): boolean =>
    token.length >= 3 && !STOPWORDS.has(token)

  return {
    tokens: new Set([...spans, ...words].filter(keep)),
    spans: new Set(spans.filter(keep)),
  }
}

/**
 * Whether a clause instructs against something, rather than merely describing
 * something that does not happen.
 *
 * The marker has to open the clause. A prohibition is an instruction, and an
 * instruction leads with its verb, so `Never delete a task file` prohibits
 * where `a fallback never fires` reports. Reading the marker anywhere in the
 * clause cannot separate those two, and this corpus writes both: the third
 * false contradiction found here was `so a || fallback never fires` against a
 * seed clause saying the same thing in other words.
 *
 * What it costs is a prohibition written mid-clause, as in `edit with the tool,
 * never a stream editor`, which now reads as description. That miss lands the
 * pair in the repetition class rather than dropping it, so both surfaces still
 * reach the report and only the label is weaker.
 */
function prohibits(text: string): boolean {
  const opening = text
    .toLowerCase()
    .replace(/^[^a-z]*/, '')
    .replace(/^(and|but|so|then|also|however)[\s,]+/, '')

  return (
    PROHIBITIONS.some((marker) => opening.startsWith(marker)) ||
    NEGATED_SPAN.test(opening)
  )
}

/**
 * The clauses a statement's polarity is read against.
 *
 * The trailing span is kept, where `splitSentences` in `src/markdown/structure.ts`
 * drops one no punctuation closes. A bullet routinely ends without a period and
 * its last clause is routinely the one carrying the prohibition, so dropping it
 * would lose exactly the half this reads. The two contracts differ, which is why
 * this is a second splitter rather than a shared one.
 */
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause !== '')
}

/**
 * The clause a match landed in, which is where a prohibition has to sit before
 * it says anything about the rule the two statements share.
 *
 * The densest clause rather than every clause carrying an anchor. A statement
 * states one rule across several clauses, and a union answers true whenever any
 * clause anywhere carries a marker, which is the whole statement again under
 * another name.
 *
 * Both contradictions this repository reported were that defect. The
 * always-loaded file splits the stream-editor rule across two bullets and the
 * seed folds them into one, so the subject was the exception half alone while
 * the seed's bullet carried the `never` from a clause the anchors never
 * touched, and the two agreed completely.
 */
function anchoredClause(text: string, anchors: ReadonlySet<string>): string {
  const parts = clauses(text)
  if (parts.length <= 1) return text

  let best = text
  let bestHits = 0

  for (const part of parts) {
    const tokens = analyze(part).tokens
    let hits = 0
    for (const anchor of anchors) if (tokens.has(anchor)) hits += 1

    if (hits > bestHits) {
      bestHits = hits
      best = part
    }
  }

  // No clause carries an anchor, which a boundary landing inside a code span
  // can produce. Reading the whole statement is what this did before the clause
  // scope, so it degrades to that rather than to no polarity at all.
  return bestHits === 0 ? text : best
}

function isMirrorPair(subject: string, surface: string): boolean {
  return MIRRORS.some(
    ([left, right]) =>
      (subject === left && surface === right) ||
      (subject === right && surface === left),
  )
}

function find(parent: Map<string, string>, node: string): string {
  const above = parent.get(node)
  if (above === undefined || above === node) return node
  const root = find(parent, above)
  parent.set(node, root)
  return root
}

function union(parent: Map<string, string>, a: string, b: string): void {
  if (!parent.has(a)) parent.set(a, a)
  if (!parent.has(b)) parent.set(b, b)
  const rootA = find(parent, a)
  const rootB = find(parent, b)
  if (rootA !== rootB) parent.set(rootA, rootB)
}

/**
 * How many duplicate clusters reach three member statements or more.
 *
 * A rule sitting on both sides lets a cluster of mutually restating
 * statements fragment across several `RestatedEntry` records, one per member
 * that happens to lead the subject loop, so counting an entry whose own
 * `surfaces.length >= 2` counts the same cluster more than once. Union over
 * every reported pair instead: two statements in one component are one
 * duplicated instruction wherever it was found from, and the entries a
 * reader sees are one view into that same union, never a second source for
 * its total.
 */
function countThreeSurfaceClusters(pairs: ReadonlySet<string>): number {
  const parent = new Map<string, string>()

  for (const key of pairs) {
    const [left, right] = key.split('|')
    union(parent, left, right)
  }

  const sizes = new Map<string, number>()
  for (const node of parent.keys()) {
    const root = find(parent, node)
    sizes.set(root, (sizes.get(root) ?? 0) + 1)
  }

  let clusters = 0
  for (const size of sizes.values()) if (size >= 3) clusters += 1
  return clusters
}

/**
 * Bullets at the top level of a markdown file, which is the unit an instruction
 * takes in the always-loaded file and in the seed.
 */
function readBullets(root: string, relative: string): Statement[] {
  const full = join(root, relative)
  if (!existsSync(full)) return []

  const statements: Statement[] = []
  let fenced = false

  readFileSync(full, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (line.trimStart().startsWith('```')) {
        fenced = !fenced
        return
      }
      if (fenced || !line.startsWith('- ')) return

      statements.push({
        file: relative.replaceAll('\\', '/'),
        line: index + 1,
        text: line.slice(2).trim(),
      })
    })

  return statements
}

/**
 * Every top-level bullet across every rule file, keyed to the file it came
 * from rather than folded into one corpus. A rule reads as bullets under the
 * same convention the always-loaded file and the seed use, so `readBullets`
 * is reused per file rather than rebuilt for prose, and frontmatter is read
 * past for the same reason it is: no line there starts with `- `.
 */
function readRuleFiles(root: string, rulesRel: string): Statement[] {
  const rulesRoot = join(root, rulesRel)
  if (!existsSync(rulesRoot)) return []

  const files = [
    ...new Bun.Glob('**/*.md').scanSync({ cwd: rulesRoot, onlyFiles: true }),
  ].sort()

  return files.flatMap((file) =>
    readBullets(
      root,
      `${rulesRel.replaceAll('\\', '/')}/${file.replaceAll('\\', '/')}`,
    ),
  )
}

/**
 * Every prose line and bullet in a skill body under one skills root.
 *
 * Wider than the bullet rule above because the motivating case was stated in a
 * body as a paragraph, so a bullet-only read would miss the one instance this
 * sweep exists for. Headings, tables, and fenced blocks are read past: a
 * heading names a section rather than stating a rule, and a fenced block is an
 * example whose words are the surrounding prose's by construction.
 */
function readBodyLines(root: string, skillsRel: string): Candidate[] {
  const skillsRoot = join(root, skillsRel)
  if (!existsSync(skillsRoot)) return []

  const candidates: Candidate[] = []

  const files = [
    ...new Bun.Glob('*/SKILL.md').scanSync({
      cwd: skillsRoot,
      onlyFiles: true,
    }),
  ].sort()

  for (const file of files) {
    const posix = file.replaceAll('\\', '/')
    const skill = posix.split('/')[0]
    const relative = `${skillsRel.replaceAll('\\', '/')}/${posix}`

    const lines = readFileSync(join(root, relative), 'utf8').split('\n')
    let fenced = false
    let frontmatter = lines[0]?.trim() === '---'

    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim()

      // Frontmatter is metadata rather than instruction, and every body's
      // `description` restates that skill's own purpose, so sweeping it makes
      // each skill match any subject naming its domain.
      if (frontmatter) {
        if (index > 0 && trimmed === '---') frontmatter = false
        continue
      }

      if (trimmed.startsWith('```')) {
        fenced = !fenced
        continue
      }
      if (fenced || trimmed === '') continue
      if (trimmed.startsWith('#') || trimmed.startsWith('|')) continue
      if (trimmed.startsWith('---')) continue

      candidates.push({
        file: relative,
        line: index + 1,
        text: trimmed.replace(/^[-*>]\s+/, ''),
        kind: 'skill',
        skill,
      })
    }
  }

  return candidates
}

/** How many statements each token appears in, which is what rarity is read off. */
function documentFrequency(
  groups: readonly (readonly Indexed<Statement>[])[],
): Map<string, number> {
  const frequency = new Map<string, number>()

  for (const group of groups) {
    for (const entry of group) {
      for (const token of entry.analysis.tokens) {
        frequency.set(token, (frequency.get(token) ?? 0) + 1)
      }
    }
  }

  return frequency
}

function index<T extends Statement>(statement: T): Indexed<T> {
  return { statement, analysis: analyze(statement.text) }
}

/**
 * Which surface a later edit starts from, and why.
 *
 * A skill body earns authority only where the subject names that skill, which
 * is the content-ownership table's rule that behavior triggered when editing
 * domain X belongs to X's skill. Everything else the table does not reach is
 * reported as unknown.
 */
function authorityFor(
  subject: Statement,
  candidate: Candidate,
): { authority: Authority; reason: string } {
  if (candidate.kind === 'seed') {
    return {
      authority: 'claude-md',
      reason: `${INSTRUCTIONS_REL} is authored first and the seed carries it to a target, so an edit starts there and reaches the seed through seed-sync`,
    }
  }

  if (
    candidate.skill !== undefined &&
    subject.text.toLowerCase().includes(candidate.skill.toLowerCase())
  ) {
    return {
      authority: 'skill-body',
      reason: `the subject names ${candidate.skill}, and behavior triggered only when editing one domain belongs to that domain's skill`,
    }
  }

  return {
    authority: 'unknown',
    reason:
      'the content-ownership table assigns a cross-domain rule and a domain-triggered one, and reaches neither from here',
  }
}

function classify(
  subject: Statement,
  candidate: Candidate,
  weight: number,
  anchors: ReadonlySet<string>,
): { restatement: Restatement; reason: string } {
  const split =
    prohibits(anchoredClause(subject.text, anchors)) !==
    prohibits(anchoredClause(candidate.text, anchors))

  if (split && weight >= CONTRADICTION_FLOOR) {
    return {
      restatement: 'contradiction',
      reason:
        'the clause each surface was matched on states this as a prohibition on one side alone, which is a polarity reading rather than a judgment about meaning',
    }
  }

  if (isMirrorPair(subject.file, candidate.file)) {
    return {
      restatement: 'mirror',
      reason:
        'both files sit on a declared mirror pair, where repeating the rule is the design',
    }
  }

  return {
    restatement: 'repetition',
    reason: split
      ? 'the matched clause carries a prohibition on one surface alone, on a match too thin to read that as a disagreement'
      : 'two surfaces state one rule and neither is declared a copy of the other',
  }
}

/**
 * Every instruction the always-loaded file or a path-scoped rule states that a
 * further surface also states.
 *
 * Matching is recall-first, keyed on distinctive tokens two statements share
 * rather than on a phrase they spell the same way. The motivating case was one
 * rule written three different ways, so a near-exact matcher would miss the
 * defect the sweep exists for, and a recall-first reading can be narrowed from
 * real output where the reverse cannot.
 *
 * The always-loaded file and every rule under either rule root each open the
 * search as a subject, and the seed, the skill bodies under both skill roots,
 * and every rule again close it as a candidate.
 * A rule sits on both sides because a stack ships a whole rule folder, so a
 * bullet duplicated between two rules reaches a target exactly as a bullet
 * duplicated between the always-loaded file and a rule does, and neither shape
 * is visible from one side alone.
 *
 * It reports and never gates. A restatement is legitimate more often than not,
 * so a push failing on one would fail on the ordinary case.
 */
export function readRestated(root: string): RestatedReport {
  const instructions = readBullets(root, INSTRUCTIONS_REL)
  if (instructions.length === 0) {
    return { kind: 'unreadable', reason: 'no-instructions' }
  }

  const seed: Candidate[] = readBullets(root, SEED_REL).map((statement) => ({
    ...statement,
    kind: 'seed' as const,
  }))

  const bodies = SKILL_ROOTS.flatMap((skillsRel) =>
    readBodyLines(root, skillsRel),
  )
  const bodyFiles = new Set(bodies.map((candidate) => candidate.file)).size

  const ruleStatements = RULE_DIRS.flatMap((rulesRel) =>
    readRuleFiles(root, rulesRel),
  )
  const rules: Candidate[] = ruleStatements.map((statement) => ({
    ...statement,
    kind: 'rule' as const,
  }))
  const ruleFiles = new Set(ruleStatements.map((statement) => statement.file))
    .size

  if (seed.length === 0 && bodies.length === 0 && rules.length === 0) {
    return { kind: 'unreadable', reason: 'no-surfaces' }
  }

  // A rule states a directive directly, the same as the always-loaded file, so
  // it joins the subjects a match is searched from rather than sitting only on
  // the candidate side. Without this, an instruction that moved out of the
  // always-loaded file and into two rules has no subject left carrying it, and
  // the pair the seed move produced would stay invisible to this sweep the
  // same way it did before this corpus widened.
  const subjects = [...instructions, ...rules].map(index)
  const candidates = [...seed, ...bodies, ...rules].map(index)
  const frequency = documentFrequency([subjects, candidates])

  const distinctive = (analysis: Analysis): Set<string> =>
    new Set(
      [...analysis.tokens].filter(
        (token) => (frequency.get(token) ?? 0) <= COMMON_CEILING,
      ),
    )

  // Every candidate's rare set is invariant across the subject loop, so it is
  // built once here rather than per pair. The corpora multiply out to hundreds
  // of thousands of pairings, and rebuilding a set inside that would dominate
  // the run.
  const rareCandidates = candidates.map((candidate) => ({
    ...candidate,
    rare: distinctive(candidate.analysis),
  }))

  const restatements: RestatedEntry[] = []
  let contradictions = 0
  let repetitions = 0
  let mirrors = 0

  // A rule bullet sits on both sides now, so the pair it forms with another
  // rule bullet would otherwise surface twice: once with each end read as the
  // subject. Recording the pair the first time it is found and skipping it
  // the second keeps one entry per duplicate regardless of which side a
  // reader lands on, the way a seed-versus-body pair never could collide,
  // since only a rule occupies both roles. The same skip is what fragments a
  // cluster of mutually restating rules across several entries, which is why
  // `countThreeSurfaceClusters` reads this set again below rather than the
  // per-entry `surfaces.length` the loop produces.
  const reportedPairs = new Set<string>()
  const pairKey = (a: Statement, b: Statement): string => {
    const left = `${a.file}:${a.line}`
    const right = `${b.file}:${b.line}`
    return left < right ? `${left}|${right}` : `${right}|${left}`
  }

  for (const subject of subjects) {
    const rare = distinctive(subject.analysis)
    const surfaces: Surface[] = []

    for (const candidate of rareCandidates) {
      // A second surface is a second file. Two bullets sharing anchors inside
      // one rule are adjacent instructions on one topic rather than the same
      // rule shipped twice, and only a rule can reach this branch at all,
      // since it is the one kind read as both a subject and a candidate.
      if (candidate.statement.file === subject.statement.file) continue

      const key = pairKey(subject.statement, candidate.statement)
      if (reportedPairs.has(key)) continue

      const shared = [...candidate.rare]
        .filter((token) => rare.has(token))
        .sort()

      const weight = shared.reduce(
        (total, token) =>
          total +
          (subject.analysis.spans.has(token) &&
          candidate.analysis.spans.has(token)
            ? SPAN_WEIGHT
            : 1),
        0,
      )

      if (weight < ANCHOR_FLOOR) continue
      reportedPairs.add(key)

      const { restatement, reason } = classify(
        subject.statement,
        candidate.statement,
        weight,
        new Set(shared),
      )
      const { authority, reason: why } = authorityFor(
        subject.statement,
        candidate.statement,
      )

      surfaces.push({
        file: candidate.statement.file,
        line: candidate.statement.line,
        text: candidate.statement.text,
        kind: candidate.statement.kind,
        restatement,
        anchors: shared,
        weight,
        authority,
        reason: `${reason}; ${why}`,
      })
    }

    if (surfaces.length === 0) continue

    for (const surface of surfaces) {
      if (surface.restatement === 'contradiction') contradictions += 1
      else if (surface.restatement === 'mirror') mirrors += 1
      else repetitions += 1
    }

    restatements.push({ subject: subject.statement, surfaces })
  }

  const threeSurface = countThreeSurfaceClusters(reportedPairs)

  return {
    kind: 'measured',
    corpus: {
      instructions: instructions.length,
      seed: seed.length,
      bodies: bodyFiles,
      rules: ruleFiles,
      candidates: candidates.length,
    },
    matcher: {
      anchors: ANCHOR_FLOOR,
      common: COMMON_CEILING,
      contradiction: CONTRADICTION_FLOOR,
    },
    restatements,
    counts: { contradictions, repetitions, mirrors, threeSurface },
  }
}
