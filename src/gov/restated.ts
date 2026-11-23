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
 * Path-scoped rules are read from every root in `RULE_DIRS`, the authoring roots
 * rather than the consumed copy, since a bullet anywhere under `governance/rules/`
 * or `internal/rules/` loads like one in the always-loaded file or the seed.
 */

/**
 * Path pairs whose duplication is deliberate and already recorded. The seed is
 * authored from the always-loaded file, so a bullet in both is the design. The
 * exclusion covers repetition alone, so a polarity split on a pair stays a finding.
 */
const MIRRORS: readonly (readonly [string, string])[] = [
  [INSTRUCTIONS_REL, SEED_REL],
]

/**
 * A token appearing in more than this many statements carries no signal.
 * Tuned against this repository's corpus, where `.canon/plans/` sits at 14 and
 * anchors the motivating case, while `file` sits at 371 and matches most of the tree.
 */
export const COMMON_CEILING = 20

/** Weight two statements must share before they are read as one rule. */
export const ANCHOR_FLOOR = 3

/**
 * What a backticked token is worth against a plain word. An author marking a
 * span as code named an identifier, so weighting it lets the floor rise enough
 * to drop a coincidental word pair without losing a rule spelled differently.
 */
const SPAN_WEIGHT = 2

/**
 * Weight a match needs before a polarity split is called a contradiction. It is
 * above the match floor, since a thin match shows only a shared subject and a
 * weak pair reports as a repetition.
 */
export const CONTRADICTION_FLOOR = 5

/**
 * Words carrying no subject, dropped before anchors are counted. Short rather
 * than exhaustive, since the document-frequency ceiling removes the rest and a
 * longer hand-written list would be a corpus nobody maintains.
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
 * Markers reading as a prohibition, the one polarity signal available without
 * understanding the sentence. `no` and `not` are excluded, since both appear in
 * ordinary qualifying clauses and widening turns the corpus into contradictions.
 */
const PROHIBITIONS = ['never', 'do not', "don't", 'avoid', 'refuse']

/**
 * A `no` opening a clause or a comma-set phrase directly on a code span, which
 * names the thing ruled out, where `no` after a verb describes. `not` and
 * `never` stay out, since admitting them flipped agreeing pairs into contradictions.
 */
const NEGATED_SPAN = /(?:^|[,;:(])\s*no\s+`/

export type RestatedRefusal = 'no-instructions' | 'no-surfaces'

export type Restatement = 'mirror' | 'repetition' | 'contradiction'

/** Which surface a restatement was found on, before any class is assigned. */
export type SurfaceKind = 'seed' | 'skill' | 'rule'

/**
 * Which surface a later edit starts from. `unknown` is a first-class answer,
 * since the content-ownership table reaches nothing stated in a skill body the
 * always-loaded file never names, and guessing would put a reader on an undecided surface.
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
        /** Distinct `references/*.md` files read beside the bodies. */
        readonly references: number
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
 * Splits text into the tokens an anchor can be drawn from. A code span keeps its
 * inner text whole, since a path is the strongest anchor this corpus offers and
 * splitting it on punctuation would leave words every second bullet carries.
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
 * Whether a clause instructs against something rather than describing what does
 * not happen. The marker has to open the clause, since an instruction leads with
 * its verb, and a mid-clause prohibition lands in the repetition class.
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
 * The clauses a statement's polarity is read against. The trailing span is kept,
 * unlike `splitSentences` in `src/markdown/structure.ts`, since a bullet often
 * ends without a period and its last clause often carries the prohibition.
 */
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause !== '')
}

/**
 * The clause a match landed in, where a prohibition has to sit to say anything
 * about the shared rule. The densest clause, not every one with an anchor, since
 * a union reads a rule split across two bullets as a contradiction.
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

  // No clause carries an anchor, as a boundary inside a code span can cause, so read the whole statement.
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
 * How many duplicate clusters reach three member statements or more. A rule on
 * both sides fragments a cluster across several `RestatedEntry` records, so this
 * unions every reported pair rather than counting entries more than once.
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
 * Every top-level bullet across every rule file, keyed to its file rather than
 * folded into one corpus. A rule reads as bullets under the same convention the
 * always-loaded file uses, so `readBullets` is reused per file.
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
 * Every prose line and bullet in a skill body under one skills root. It is wider
 * than the bullet rule, since the motivating case was a paragraph, and headings,
 * tables, and fenced blocks are read past as names or examples.
 */
function readBodyLines(root: string, skillsRel: string): Candidate[] {
  const skillsRoot = join(root, skillsRel)
  if (!existsSync(skillsRoot)) return []

  const candidates: Candidate[] = []

  // Practice lives in `references/`, so a restatement there counts beside one in a body.
  const files = ['*/SKILL.md', '*/references/*.md']
    .flatMap((pattern) => [
      ...new Bun.Glob(pattern).scanSync({ cwd: skillsRoot, onlyFiles: true }),
    ])
    .sort()

  for (const file of files) {
    const posix = file.replaceAll('\\', '/')
    const skill = posix.split('/')[0]
    const relative = `${skillsRel.replaceAll('\\', '/')}/${posix}`

    const lines = readFileSync(join(root, relative), 'utf8').split('\n')
    let fenced = false
    let frontmatter = lines[0]?.trim() === '---'

    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim()

      // Frontmatter is metadata and each `description` restates its skill, so sweeping it would over-match.
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
 * Which surface a later edit starts from, and why. A skill body earns authority
 * only where the subject names that skill, per the content-ownership table, and
 * everything the table does not reach is reported as unknown.
 */
function authorityFor(
  subject: Statement,
  candidate: Candidate,
): { authority: Authority; reason: string } {
  if (candidate.kind === 'seed') {
    return {
      authority: 'claude-md',
      reason: `${INSTRUCTIONS_REL} is authored first and the seed carries it to a target, so an edit starts there and reaches the seed through a hand merge`,
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
 * further surface also states. Matching is recall-first on distinctive shared
 * tokens, rules sit on both sides, and it reports and never gates.
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
  const bodyPaths = new Set(bodies.map((candidate) => candidate.file))
  const referenceFiles = [...bodyPaths].filter((file) =>
    file.includes('/references/'),
  ).length
  const bodyFiles = bodyPaths.size - referenceFiles

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

  // Rules join the subjects, so an instruction moved into two rules still has a subject.
  const subjects = [...instructions, ...rules].map(index)
  const candidates = [...seed, ...bodies, ...rules].map(index)
  const frequency = documentFrequency([subjects, candidates])

  const distinctive = (analysis: Analysis): Set<string> =>
    new Set(
      [...analysis.tokens].filter(
        (token) => (frequency.get(token) ?? 0) <= COMMON_CEILING,
      ),
    )

  // A candidate's rare set is invariant across the subject loop, so build it once.
  const rareCandidates = candidates.map((candidate) => ({
    ...candidate,
    rare: distinctive(candidate.analysis),
  }))

  const restatements: RestatedEntry[] = []
  let contradictions = 0
  let repetitions = 0
  let mirrors = 0

  // A rule pair would surface once per side, so the mirror is skipped, and `countThreeSurfaceClusters` reads this set.
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
      // A second surface is a second file, since two bullets in one rule are adjacent instructions.
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
      references: referenceFiles,
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
