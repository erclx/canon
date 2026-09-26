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
 * a live claim about the tree. `canon/ARCHITECTURE.md` and the context
 * entries carry a figure this way deliberately, and every one of them stays
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
 * The first design matched a bare number next to a catalog noun anywhere in
 * the tracked corpus, and running it here returned 290 findings against a
 * repository whose Files-to-touch names one live instance. Reading the
 * corpus behind that run showed why: `18 rules citing a standard`, `21 skill
 * bodies`, and `eight internal skills` all pair a number with a catalog noun
 * while naming a subset, an example, or a different catalog than the one
 * matched, and that shape dominates ordinary prose. Every instance this
 * module was written against reads the number as the direct object of a verb
 * asserting the catalog's own total, `the full entry loads 59 skills` being
 * the live one, and gating the match on that verb is what a full re-read of
 * the 290 showed removing all of them while keeping that one.
 *
 * `authors` joined the list on a corpus measurement rather than on the shape
 * argument above. `canon/context/development/regeneration.md` states `the
 * toolkit authors 69 rules under governance/rules/`, which is the assertion
 * shape this list was built for with a verb the list did not carry, and the
 * word costs one further sentence across the whole corpus and no finding.
 * Extending the vocabulary is the narrow half of this fix and it is taken
 * knowingly: a list of thirteen verbs still grows by whatever the next author
 * writes, and the measurement below is what ruled out the general axis that
 * would have replaced it.
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
 * number, which is the one trigger class that states a total outright rather
 * than by implication.
 *
 * `all 69 rules` names the catalog entire, where `the 69 rules` leaves a
 * reader to decide whether a qualifier narrows it. That makes this class
 * tighter than the articles below rather than looser, and the corpus agrees:
 * adding it reached 9 further sentences and produced 2 further findings, both
 * of them real staleness this repository then repaired.
 *
 * `every` and `both` were measured beside `all` and reached nothing, so
 * neither ships. A quantifier earns a place here by naming a sentence in the
 * corpus, not by belonging to the same part of speech.
 */
const QUANTIFIERS = ['all']

/**
 * An article immediately ahead of the number, admitting the shape a bare verb
 * gate cannot reach: `the twelve audits read gitignored folders` asserts the
 * catalog's own total with the verb sitting after the noun rather than ahead
 * of the number.
 *
 * Found on this module's own first review, against a live instance the verb
 * gate alone reported clean: the development gating-stages entry stated
 * `the twelve audits` while the tree held 20, sitting inside the plausibility
 * bound this design already carries, so nothing but the missing shape kept it
 * from reporting.
 *
 * The article is looser than the verb list, and re-running against the tree
 * once it widened produced the class this trades for the miss above: `the 21
 * flat standards` read a real subset (a standard outside the retired
 * `standards/bundled/` fan-out) as a claim about the whole catalog, since
 * `flat` fills the same optional-word slot `sixty-one shipped skills` needs to
 * match at all. No syntactic rule tells a qualifier that narrows a catalog
 * from one that only restates it, and the sentence was true when written, so
 * the fix was not a narrower matcher: the clause was dated as a past state,
 * the way `canon/ARCHITECTURE.md` dates its own figures, which is the class
 * the date exclusion below already reads past.
 */
const ARTICLES = ['the', 'a', 'an']

/**
 * Matches a catalog's stated size: an assertion verb, a quantifier, or an
 * article, the number, an optional single qualifying word, then the noun in
 * either number.
 *
 * The optional word between the number and the noun is what reaches a form
 * like `installs 11 shipped rules` without also reaching past an
 * intervening clause, since a wider gap would start pairing a number in one
 * clause with a noun in the next. Requiring the noun's own plural form to
 * double as its match narrows the corpus this reads without hand-listing
 * every irregular plural, since none of these six is irregular.
 *
 * The gap between the trigger and the number was the second axis this comment
 * used to name as open to widening once the false-positive rate had been
 * measured over more than two runs. It was measured over the whole corpus at
 * 518 files and 31,836 sentences and it is not the axis to take. Widths of
 * one, two, and three optional words reached 77, 104, and 132 sentences
 * against a baseline of 65, and the two live misses that motivated the
 * measurement came back missed at every width but one: no width reaches `took
 * all 69 rules`, whose nearest verb or article is the `The` opening the
 * sentence, with five words standing between it and the number, and the width
 * that does reach `the toolkit authors 69 rules` is the same
 * width that admits `a domain of 55 skills`, which is the indirect-noun shape
 * this module already records as out of scope. Widening the gap buys one of
 * two misses at 60 percent more reach and a false positive of a class already
 * named.
 *
 * The trigger vocabulary carries both misses instead, at 75 sentences reached
 * against 65 and no false positive: `all` reaches the first and `authors` the
 * second. Two of the four findings that shape reports were new, and both were
 * real. Measured at `ffe7e7c6` on 2026-08-28.
 *
 * What this still drops: `denominator of sixty-one shipped skills` states a
 * real catalog total through an indirect noun and reads past, which the gap
 * measurement above is the argument for leaving alone rather than an
 * oversight.
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
 * The verb gate alone still passed a run against this repository at four
 * false positives to one real finding: `carries two rules about a
 * standard's own lifecycle`, `holds one rule or one fact`, and `documents
 * two similar commands` each pair an assertion verb with a catalog noun
 * used for something this tree's `rules` or `commands` catalog does not
 * mean. What tells those apart from the live finding is magnitude. A
 * catalog this sweep tracks drifts by a few members between the day a
 * sentence was written and the day it is read, so a genuine staleness claim
 * sits near the true count, and `2` beside a true count of `59` is not a
 * catalog that shrank, it is a different `rules` entirely.
 *
 * Tuned against the run this module was written against rather than
 * reasoned to from first principles, the way `restated.ts` tunes its own
 * document-frequency ceiling. Every catalog here sits in the tens, and the
 * bound is a property of that scale rather than a universal one.
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
 * one of the closed catalogs holds, and compares the stated figure against
 * what the tree actually counts.
 *
 * What it does not measure: a delta phrased as a transition (`from fourteen
 * to fifteen`), a fraction (`thirteen of sixteen`), and a total reached
 * through an indirect noun (`denominator of sixty-one shipped skills`) are
 * all catalog-size claims this corpus carries, and none matches the trigger
 * shape this reads. Each stays a known gap. The rate that used to gate
 * closing them is measured now, and what it showed is that the widening they
 * would need is the one that costs a false positive rather than the one that
 * does not, which `buildMatcher` records with its numbers.
 *
 * A second figure in a sentence whose first figure already matched is a
 * fourth gap and a structural one: `regex.exec` takes one match per catalog
 * per sentence, so `authors 69 rules under governance/rules/ and consumes 54
 * into .claude/rules/` is read for its 69 alone. Reaching the 54 would be
 * wrong here rather than better, since it counts the consumed mirror rather
 * than the source catalog this sweep tracks, but a sentence stating one
 * catalog twice would go unread the same way.
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
          // No true count on this tree, which is the ordinary state of the
          // `commands` catalog outside this repository. A stated figure has
          // nothing to be judged stale against.
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
