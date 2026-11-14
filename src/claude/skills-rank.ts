import { existsSync, readFileSync } from 'node:fs'
import { listSkillsAt, resolveSkillsCorpus } from '@/claude/skills-list'

/**
 * Whether a prompt reaches the right skill, measured by TF-IDF cosine
 * similarity over the shipped catalog's own frontmatter descriptions. This is
 * a necessary condition rather than a report of real routing behavior: it
 * asks whether the descriptions are separable by the words they use, and
 * Claude Code does not route this way.
 *
 * Ported from `.canon/groundwork/42-ai-blueprint/evidence/rank.ts`, which
 * ran once against this catalog and named the collisions this measure now
 * tracks on a cadence.
 */

const STOP = new Set(
  'a about after again all also and any are as at be before but by can do does for from has have help how in into is it its just make not of on or our so that the then there these this to use used uses using want was what when where which who why with you your run'.split(
    ' ',
  ),
)

export interface RankedSkill {
  readonly name: string
  readonly description: string
}

/** One prompt and the skill it should reach. */
export interface SkillCase {
  readonly prompt: string
  readonly expect: string
}

/** A case whose prompt did not rank its expected skill first. */
export interface Miss {
  readonly prompt: string
  readonly expect: string
  /** The skill the ranker placed first instead. */
  readonly won: string
  /** Where `expect` placed, or 0 when it never appears in the catalog. */
  readonly rank: number
}

/** Why a measure produced no reading, which is never the same as a clean one. */
export type RankRefusal = 'no-skills' | 'no-cases' | 'bad-cases'

/** The refusals a case corpus read produces, which the scan itself cannot raise. */
export type CaseCorpusRefusal = Extract<RankRefusal, 'no-cases' | 'bad-cases'>

export type CaseCorpusReport =
  | { readonly kind: 'cases'; readonly cases: readonly SkillCase[] }
  | {
      readonly kind: 'refused'
      readonly reason: CaseCorpusRefusal
      /** What the caller has to change, which the reason alone never says. */
      readonly detail: string
    }

export type RankReport =
  | {
      readonly kind: 'measured'
      /** The corpus spelling measured, since a root can carry either one. */
      readonly corpus: string
      readonly skills: number
      readonly cases: number
      readonly rank1: number
      readonly top3: number
      readonly misses: readonly Miss[]
      /** Cases whose prompt carried no vocabulary to score. */
      readonly unmeasurable: readonly SkillCase[]
    }
  | { readonly kind: 'refused'; readonly reason: RankRefusal }

/**
 * Reads a project's own case corpus, which is JSON in the shape `SKILL_CASES`
 * already holds. A target authors its own skills and its own vocabulary, so
 * the toolkit corpus answers a question no other project asked.
 *
 * No standard stands behind the shape until a third project needs one, so
 * every way the file fails is reported with what to change rather than
 * measured against a spec. An empty array refuses for the reason a missing
 * file does: a corpus of nothing scores 0 of 0 and reads as a clean pass.
 */
export function loadCaseCorpus(path: string): CaseCorpusReport {
  if (!existsSync(path)) {
    return { kind: 'refused', reason: 'no-cases', detail: path }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { kind: 'refused', reason: 'bad-cases', detail }
  }

  if (!Array.isArray(parsed)) {
    return {
      kind: 'refused',
      reason: 'bad-cases',
      detail: 'the file holds something other than an array of cases',
    }
  }

  const cases: SkillCase[] = []
  for (const [index, entry] of parsed.entries()) {
    const record = entry as Record<string, unknown> | null
    if (
      typeof record !== 'object' ||
      record === null ||
      typeof record.prompt !== 'string' ||
      typeof record.expect !== 'string'
    ) {
      return {
        kind: 'refused',
        reason: 'bad-cases',
        detail: `case ${index} carries no string prompt or expect`,
      }
    }

    cases.push({ prompt: record.prompt, expect: record.expect })
  }

  if (cases.length === 0) {
    return {
      kind: 'refused',
      reason: 'bad-cases',
      detail: 'the file holds no cases at all',
    }
  }

  return { kind: 'cases', cases }
}

/**
 * Every shipped skill's frontmatter description, read the way a prompt is
 * matched against it: whole, including the quoted trigger phrases it states.
 * A skill whose frontmatter carries no description contributes no vocabulary
 * and never wins a rank, so it is dropped rather than scored on nothing.
 */
export function loadCatalog(root: string): RankedSkill[] {
  const corpus = resolveSkillsCorpus(root)
  return corpus === undefined ? [] : loadCatalogAt(corpus.dir)
}

/** The same read against a corpus folder the caller already resolved. */
export function loadCatalogAt(skillsRoot: string): RankedSkill[] {
  return listSkillsAt(skillsRoot)
    .filter((skill) => skill.description !== '')
    .map((skill) => ({ name: skill.name, description: skill.description }))
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP.has(token))
}

function termCounts(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}

function buildIdf(
  docs: readonly Map<string, number>[],
): (term: string) => number {
  const total = docs.length
  const documentFrequency = new Map<string, number>()
  for (const doc of docs) {
    for (const term of doc.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
  }
  return (term) =>
    Math.log((total + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1
}

function tfIdfVector(
  terms: Map<string, number>,
  idf: (term: string) => number,
): Map<string, number> {
  const vec = new Map<string, number>()
  for (const [term, frequency] of terms) vec.set(term, frequency * idf(term))
  return vec
}

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dot = 0
  for (const [term, weight] of a) dot += weight * (b.get(term) ?? 0)
  if (dot === 0) return 0

  const norm = (vec: Map<string, number>) =>
    Math.sqrt(
      [...vec.values()].reduce((sum, weight) => sum + weight * weight, 0),
    )
  const denominator = norm(a) * norm(b)
  return denominator === 0 ? 0 : dot / denominator
}

export interface RankedResult {
  readonly name: string
  readonly score: number
}

/**
 * Every skill's TF-IDF vector over the catalog it was loaded with, and the
 * IDF weighting that both the catalog and a scored prompt read from. A model
 * is built once per catalog and reused across every case, since the IDF
 * weights are the same question asked of the same corpus each time.
 */
export interface RankModel {
  readonly rank: (prompt: string) => readonly RankedResult[]
}

export function buildModel(catalog: readonly RankedSkill[]): RankModel {
  const docs = catalog.map((skill) => termCounts(tokenize(skill.description)))
  const idf = buildIdf(docs)
  const vectors = new Map(
    catalog.map((skill, index) => [skill.name, tfIdfVector(docs[index], idf)]),
  )

  return {
    rank: (prompt: string): readonly RankedResult[] => {
      const promptVector = tfIdfVector(termCounts(tokenize(prompt)), idf)
      // A prompt of only stopwords tokenizes to nothing, and an all-zero sort would
      // hand the alphabetically first skill a win, so no ranking is reported.
      if (promptVector.size === 0) return []

      return [...vectors]
        .map(([name, vector]) => ({
          name,
          score: cosineSimilarity(promptVector, vector),
        }))
        .sort(
          (left, right) =>
            right.score - left.score || left.name.localeCompare(right.name),
        )
    },
  }
}

/**
 * Scores every case against the catalog's own descriptions, which is the
 * production mechanism: Claude Code matches a prompt against the whole
 * description a skill ships, triggers included.
 */
export function measureCases(
  catalog: readonly RankedSkill[],
  cases: readonly SkillCase[],
): {
  readonly rank1: number
  readonly top3: number
  readonly misses: readonly Miss[]
  readonly unmeasurable: readonly SkillCase[]
} {
  const model = buildModel(catalog)
  let rank1 = 0
  let top3 = 0
  const misses: Miss[] = []
  const unmeasurable: SkillCase[] = []

  for (const skillCase of cases) {
    const ranked = model.rank(skillCase.prompt)
    if (ranked.length === 0) {
      unmeasurable.push(skillCase)
      continue
    }

    const at = ranked.findIndex((entry) => entry.name === skillCase.expect) + 1

    if (at === 1) rank1 += 1
    if (at > 0 && at <= 3) top3 += 1
    if (at !== 1) {
      misses.push({
        prompt: skillCase.prompt,
        expect: skillCase.expect,
        won: ranked[0]?.name ?? '',
        rank: at,
      })
    }
  }

  return { rank1, top3, misses, unmeasurable }
}

/**
 * Reads whichever skill corpus the root carries and scores it against the
 * given cases. Measures the cwd's catalog rather than the toolkit root,
 * matching the reach and audit verbs, so a linked worktree reads its own
 * branch and a target reads the skills it wrote itself.
 */
export function scanRank(
  root: string,
  cases: readonly SkillCase[],
): RankReport {
  const corpus = resolveSkillsCorpus(root)
  if (corpus === undefined) return { kind: 'refused', reason: 'no-skills' }

  const catalog = loadCatalogAt(corpus.dir)
  const { rank1, top3, misses, unmeasurable } = measureCases(catalog, cases)

  return {
    kind: 'measured',
    corpus: corpus.rel,
    skills: catalog.length,
    cases: cases.length,
    rank1,
    top3,
    misses,
    unmeasurable,
  }
}
