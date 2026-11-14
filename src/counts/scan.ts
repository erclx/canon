import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Catalog, CATALOGS } from '@/counts/catalogs'
import { NUMBER_PATTERN, parseNumber } from '@/counts/numbers'
import { resolveMarkdown } from '@/markdown/files'

export interface CountFinding {
  readonly file: string
  readonly line: number
  readonly catalog: string
  readonly stated: number
  readonly actual: number
  readonly sentence: string
}

/**
 * Narrower than `MarkdownAuditRefusal`. This sweep takes no path arguments,
 * so `resolveMarkdown` can never return its `no-match` reason here.
 */
export type CountsRefusal = 'no-git' | 'no-markdown'

export type CountsReport =
  | {
      readonly kind: 'measured'
      readonly filesScanned: number
      /**
       * The true count this run read for every catalog, keyed by id.
       * `undefined` for a catalog this tree carries nothing to count, which
       * `commands` is on every project but this repository.
       */
      readonly catalogs: Readonly<Record<string, number | undefined>>
      readonly findings: readonly CountFinding[]
    }
  | { readonly kind: 'unreadable'; readonly reason: CountsRefusal }

/**
 * A calendar date, which reads a sentence as a historical record rather than
 * a live claim about the tree. The context entries
 * carry a figure this way deliberately, and every one of them stays
 * correct forever, so a sentence carrying one is read past rather than
 * matched.
 */
const DATE = /\b\d{4}-\d{2}-\d{2}\b/

/** A commit-length hex token in a backtick span, the other marker of a dated record. */
const COMMIT = /`[0-9a-f]{7,12}`/

function isDated(sentence: string): boolean {
  return DATE.test(sentence) || COMMIT.test(sentence)
}

/**
 * Splits a rendered line into the sentences a reader sees.
 *
 * A markdown paragraph in this corpus is written as one long line rather than
 * hard-wrapped, so a line is routinely several sentences deep, and a date
 * naming one of them must not excuse a live claim two sentences away in the
 * same line.
 */
function sentencesOf(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '')
}

/**
 * A verb asserting the whole of something, immediately ahead of the number.
 *
 * A bare number beside a catalog noun mostly names a subset, an example, or a
 * different catalog, as in `18 rules citing a standard`. A sentence stating a
 * catalog's own total reads the number as the object of a verb like these, as
 * in `the full entry loads 59 skills`, so the verb gate keeps that shape and
 * drops the rest. The list is closed and grows by corpus evidence, since
 * widening the gap in `buildMatcher` is the alternative it ruled out.
 */
const ASSERTION_VERBS = [
  'loads',
  'ships',
  'carries',
  'holds',
  'counts',
  'totals',
  'documents',
  'declares',
  'installs',
  'lists',
  'contains',
  'comprises',
  'authors',
]

/**
 * A quantifier asserting the whole of a catalog immediately ahead of the
 * number, the one trigger that states a total outright.
 *
 * `all 69 rules` names the catalog entire, where `the 69 rules` leaves a
 * qualifier open, so this class is tighter than the articles below. A
 * quantifier joins only by naming a sentence in the corpus, which `every` and
 * `both` did not.
 */
const QUANTIFIERS = ['all']

/**
 * An article immediately ahead of the number, admitting the shape a verb gate
 * cannot reach: `the twelve audits read gitignored folders` asserts a total
 * with the verb after the noun.
 *
 * It is looser than the verb list. A qualifier that narrows a catalog, such as
 * `the 21 flat standards`, reads the same as one that only restates it, and no
 * syntactic rule tells them apart, so a true past figure is dated as a past
 * state and the date exclusion reads past it.
 */
const ARTICLES = ['the', 'a', 'an']

/**
 * Matches a catalog's stated size: an assertion verb, a quantifier, or an
 * article, the number, an optional single qualifying word, then the noun in
 * either number.
 *
 * One optional word reaches `installs 11 shipped rules` without pairing a
 * number in one clause with a noun in the next. A wider gap between trigger
 * and number reaches more sentences but admits the indirect-noun shape, such
 * as `a domain of 55 skills`, so misses are closed through the trigger
 * vocabulary instead. A total stated through an indirect noun still reads past.
 */
function buildMatcher(catalog: Catalog): RegExp {
  const [singular, plural] = catalog.nouns
  const triggers = [...ASSERTION_VERBS, ...QUANTIFIERS, ...ARTICLES].join('|')
  return new RegExp(
    `\\b(?:${triggers})\\s+(${NUMBER_PATTERN})(?:\\s+[a-z]+)?\\s+(?:${singular}|${plural})\\b`,
    'gi',
  )
}

const MATCHERS: readonly { catalog: Catalog; regex: RegExp }[] = CATALOGS.map(
  (catalog) => ({ catalog, regex: buildMatcher(catalog) }),
)

/**
 * A stated figure within a factor of two of the true count, in either
 * direction.
 *
 * An assertion verb still pairs with a catalog noun used for something else,
 * as in `holds one rule or one fact`. A catalog drifts by a few members
 * between writing and reading, so a genuine staleness claim sits near the
 * true count, and `2` beside `59` is a different `rules` entirely. The bound
 * is tuned to catalogs in the tens rather than universal.
 */
const PLAUSIBLE_RATIO = 0.5

function isPlausibleClaim(stated: number, actual: number): boolean {
  if (actual === 0) return stated === 0
  return (
    stated / actual >= PLAUSIBLE_RATIO && actual / stated >= PLAUSIBLE_RATIO
  )
}

/**
 * Scans every tracked markdown file for a sentence stating how many members
 * one of the closed catalogs holds, and compares it against the tree's count.
 *
 * Known gaps: a transition (`from fourteen to fifteen`), a fraction
 * (`thirteen of sixteen`), and an indirect noun read past, since the widening
 * each needs costs a false positive. `regex.exec` takes one match per catalog
 * per sentence, so a second figure in a sentence whose first already matched
 * goes unread.
 */
export async function scanCounts(root: string): Promise<CountsReport> {
  const scope = await resolveMarkdown(root, [])
  if (scope.kind === 'unavailable') {
    return { kind: 'unreadable', reason: 'no-git' }
  }
  if (scope.files.length === 0) {
    return { kind: 'unreadable', reason: 'no-markdown' }
  }

  const catalogs: Record<string, number | undefined> = {}
  for (const catalog of CATALOGS) catalogs[catalog.id] = catalog.count(root)

  const findings: CountFinding[] = []

  for (const file of scope.files) {
    const text = readFileSync(join(root, file), 'utf8')
    let fenced = false

    text.split('\n').forEach((line, index) => {
      if (line.trimStart().startsWith('```')) {
        fenced = !fenced
        return
      }
      if (fenced) return

      for (const sentence of sentencesOf(line)) {
        if (isDated(sentence)) continue

        for (const { catalog, regex } of MATCHERS) {
          regex.lastIndex = 0
          const match = regex.exec(sentence)
          if (match === null) continue

          const stated = parseNumber(match[1])
          if (stated === undefined) continue

          const actual = catalogs[catalog.id]
          // No true count on this tree, the ordinary state of `commands`
          // outside this repository, so nothing to judge the figure against.
          if (actual === undefined) continue
          if (stated === actual) continue
          if (!isPlausibleClaim(stated, actual)) continue

          findings.push({
            file,
            line: index + 1,
            catalog: catalog.id,
            stated,
            actual,
            sentence,
          })
        }
      }
    })
  }

  return {
    kind: 'measured',
    filesScanned: scope.files.length,
    catalogs,
    findings,
  }
}
