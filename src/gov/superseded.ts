import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isBinary } from '@/sweep/binary'
import { isMarked } from '@/sweep/exempt-marker'
import { listRepositoryFiles } from '@/git-files'

/**
 * The inline token exempting one line from this sweep, shaped on the
 * `canon-allow-secret` precedent and read by the same two-line rule.
 *
 * A declaration disagreeing with a convention for a stated reason is the case
 * question 3 of the plan settled against gating on, and the marker is where
 * that reason goes. A bare token names nothing a later reader can weigh, so it
 * mutes nothing.
 */
export const SUPERSEDED_MARKER = 'canon-allow-superseded'

/**
 * What matched at one column.
 *
 * `literal` is the superseded value itself. The other three are the stem
 * followed by a glob, by an angle-bracket placeholder, or by nothing that
 * continues a name, which are the three forms this corpus writes a family in.
 * A literal comparison reaches none of them, which is why a rename running the
 * verb once per name reported clean over seven stale citations.
 */
export type SupersededMatch = 'literal' | 'glob' | 'placeholder' | 'prefix'

export interface SupersededHit {
  readonly file: string
  /** One-based, matching the `file:line` form a reader clicks. */
  readonly line: number
  readonly column: number
  readonly match: SupersededMatch
  /**
   * The nearest heading above the hit in a markdown file, absent elsewhere and
   * above the first heading.
   *
   * A line reads differently under the section holding it. `Use the canon-*
   * prefix on an internal skill` is a prohibition under `## Must not` and an
   * instruction anywhere else, and a reviewer reading the line alone made
   * exactly that misreading against this tree.
   */
  readonly heading: string | undefined
  /**
   * Whether the replacement sits on the same line, outside the superseded
   * occurrences themselves.
   *
   * Read outside them because the replacement is routinely a substring of the
   * value it replaced, which is what a convention dropping a segment produces.
   * A plain containment test answers true for every line under that shape and
   * separates nothing.
   *
   * A reading aid rather than a filter. The line stating the change carries
   * both values and so does a fixture halfway through a repair, and nothing
   * here can tell those apart. Suppressing on it would hide the second case,
   * which is the whole class this sweep exists to reach.
   */
  readonly carriesReplacement: boolean
  readonly preview: string
}

export interface SupersededOptions {
  /** The value the convention used to produce, matched as a literal substring. */
  readonly superseded: string
  /** What it produces now, reported so a finding names what to write instead. */
  readonly replacement: string
}

/**
 * The segment pair a templated citation is matched on, reported so a run states
 * the net it cast rather than only what the net caught.
 */
export interface SupersededStems {
  readonly superseded: string
  readonly replacement: string
}

export type SupersededReport =
  | {
      readonly kind: 'measured'
      readonly superseded: string
      readonly replacement: string
      /** Absent when the two values yield no bounded stem to match on. */
      readonly stems: SupersededStems | undefined
      /** Everything git listed, so the report states its own bound. */
      readonly listed: number
      /** Files opened, which is what the verdict actually covers. */
      readonly files: number
      /** Binary or unreadable, counted so a pass is not claimed over them. */
      readonly skipped: number
      readonly findings: readonly SupersededHit[]
      readonly exempt: readonly SupersededHit[]
    }
  | { readonly kind: 'unreadable'; readonly reason: string }

/**
 * The longest preview a hit carries. A generated or minified line is one line
 * to git and a screen of noise to a reader, and the report prints one hit per
 * line found.
 */
const PREVIEW_LIMIT = 200

/** The separator a family name is built from across this corpus. */
const SEGMENT_SEPARATOR = '-'

/**
 * A character that continues a name, so `canon-` inside `canon-cli` is read as
 * one name rather than as the family prefix written bare.
 */
const NAME_CHARACTER = /[A-Za-z0-9]/

/**
 * A character that puts the stem mid-name when it sits directly before it, so
 * a stem is only read where a name starts.
 *
 * The separator is here and not in `NAME_CHARACTER` because it decides one side
 * only. `canon-check-toolkit-` is a temp-directory prefix and matched the stem
 * `toolkit` on four fixtures before this, where `claude/skills/toolkit-*` is a
 * path and has to keep matching.
 */
const SEGMENT_CONTINUATION = /[A-Za-z0-9_-]/

const HEADING = /^#{1,6}\s+\S/

/**
 * A fence opening or closing a code block, tracked so a shell comment inside
 * one is not read as the section a hit below it sits under. A `# Install` line
 * in a bash block is the ordinary shape of that.
 */
const FENCE = /^\s*(?:```|~~~)/

/**
 * The segment the two values differ on, carried with everything they share
 * ahead of it.
 *
 * The shared prefix alone is what this exists against. `canon-cli` and
 * `canon-feedback-file` share `canon`, so a stem cut there matches every sibling
 * and reports the whole family on a rename of one folder. Including the
 * differing segment bounds the net to what actually changed, which leaves
 * `canon-cli` to `canon-shell` matching neither sibling and `toolkit-operator` to
 * `canon-operator` matching the family prefix that did move.
 *
 * An empty replacement yields nothing. Retiring a value outright leaves no
 * second value to diverge from, so every stem would run to the first segment
 * and match the family the retirement never touched.
 */
export function deriveStems(
  options: SupersededOptions,
): SupersededStems | undefined {
  if (options.replacement === '') return undefined

  const supersededSegments = options.superseded.split(SEGMENT_SEPARATOR)
  const replacementSegments = options.replacement.split(SEGMENT_SEPARATOR)

  let index = 0
  while (
    index < supersededSegments.length &&
    index < replacementSegments.length &&
    supersededSegments[index] === replacementSegments[index]
  ) {
    index += 1
  }

  const superseded = trimSeparators(
    supersededSegments.slice(0, index + 1).join(SEGMENT_SEPARATOR),
  )
  const replacement = trimSeparators(
    replacementSegments.slice(0, index + 1).join(SEGMENT_SEPARATOR),
  )

  if (superseded === '' || replacement === '') return undefined
  if (superseded === replacement) return undefined

  return { superseded, replacement }
}

function trimSeparators(value: string): string {
  let end = value.length
  while (end > 0 && value[end - 1] === SEGMENT_SEPARATOR) end -= 1
  return value.slice(0, end)
}

/**
 * Which templated form sits at `column`, or nothing when the stem there
 * continues into an ordinary name.
 *
 * The character after `<stem>-` decides all three, so one scan reads every
 * form. A name character means a sibling spelled out, which the literal
 * comparison already answers for or correctly ignores.
 */
function classifyStem(
  line: string,
  column: number,
  stem: string,
): SupersededMatch | undefined {
  const before = column === 0 ? '' : line[column - 1]
  if (before !== '' && SEGMENT_CONTINUATION.test(before)) return undefined

  const after = line[column + stem.length + 1] ?? ''
  if (after === '*') return 'glob'
  if (after === '<') return 'placeholder'
  if (after !== '' && NAME_CHARACTER.test(after)) return undefined
  return 'prefix'
}

/**
 * Whether the value replacing whatever matched appears on the line somewhere
 * other than inside the matched occurrences, which is what makes the flag mean
 * anything when one value contains the other.
 *
 * An empty replacement carries nothing, so it answers false rather than the
 * true every line returns from a containment test against the empty string.
 * Retiring a value outright is what passes one, and reporting every finding as
 * carrying its replacement there says the opposite of what happened.
 *
 * A templated hit reads the stem pair instead, since the line repairing
 * `toolkit-*` carries `canon-*` and never the full name either value spells.
 */
function carriesReplacement(
  line: string,
  options: SupersededOptions,
  stems: SupersededStems | undefined,
  match: SupersededMatch,
): boolean {
  if (match === 'literal') {
    if (options.replacement === '') return false
    return line.split(options.superseded).join('').includes(options.replacement)
  }

  if (stems === undefined) return false
  const matched = `${stems.superseded}${SEGMENT_SEPARATOR}`
  return line
    .split(matched)
    .join('')
    .includes(`${stems.replacement}${SEGMENT_SEPARATOR}`)
}

/**
 * Every column in one line carrying the superseded value or its family stem,
 * ordered left to right.
 *
 * A stem occurrence sharing a column with a literal one is dropped. The stem is
 * a prefix of the value it derives from whenever only the last segment moved,
 * so the same text would otherwise report twice under two kinds.
 */
function matchLine(
  line: string,
  options: SupersededOptions,
  stems: SupersededStems | undefined,
): { column: number; match: SupersededMatch }[] {
  const matches: { column: number; match: SupersededMatch }[] = []

  let column = line.indexOf(options.superseded)
  while (column !== -1) {
    matches.push({ column, match: 'literal' })
    column = line.indexOf(options.superseded, column + 1)
  }

  if (stems !== undefined) {
    const pattern = `${stems.superseded}${SEGMENT_SEPARATOR}`
    let at = line.indexOf(pattern)
    while (at !== -1) {
      const form = classifyStem(line, at, stems.superseded)
      if (form !== undefined && !matches.some((hit) => hit.column === at)) {
        matches.push({ column: at, match: form })
      }
      at = line.indexOf(pattern, at + 1)
    }
  }

  return matches.sort((first, second) => first.column - second.column)
}

/**
 * Every occurrence of `superseded` or of its family stem in one file's text,
 * exemptions separated.
 */
export function sweepText(
  file: string,
  text: string,
  options: SupersededOptions,
): { findings: SupersededHit[]; exempt: SupersededHit[] } {
  const lines = text.split('\n')
  const findings: SupersededHit[] = []
  const exempt: SupersededHit[] = []
  const stems = deriveStems(options)
  const sectioned = file.endsWith('.md')
  let heading: string | undefined
  let fenced = false

  for (const [index, line] of lines.entries()) {
    if (sectioned) {
      if (FENCE.test(line)) fenced = !fenced
      else if (!fenced && HEADING.test(line)) heading = line.trim()
    }

    const matches = matchLine(line, options, stems)
    if (matches.length === 0) continue

    const muted = isMarked(lines, index, SUPERSEDED_MARKER)
    const bucket = muted ? exempt : findings
    const trimmed = line.trim()
    const preview =
      trimmed.length > PREVIEW_LIMIT
        ? `${trimmed.slice(0, PREVIEW_LIMIT)}…`
        : trimmed

    for (const { column, match } of matches) {
      bucket.push({
        file,
        line: index + 1,
        column: column + 1,
        match,
        heading,
        carriesReplacement: carriesReplacement(line, options, stems, match),
        preview,
      })
    }
  }

  return { findings, exempt }
}

/**
 * Where the tree still asserts a value the convention behind it no longer
 * produces, keyed on the value rather than on the file stating the rule.
 *
 * The file-scoped map is what this exists against. A fixture asserting an old
 * output names neither the rule nor the standard, so nothing reaches it from
 * the change that superseded it, and the value it carries is the only key both
 * sides share.
 *
 * This reports and never gates. A string appears for reasons unrelated to the
 * convention, so the output is a reading a person settles, and the counts of
 * what was listed, opened, and skipped are what keep it from reading as a
 * verdict over the whole tree.
 *
 * Beside the literal comparison it matches the family stem the two values
 * differ on, so a citation writing the family as a pattern enters the report.
 * The trade is false positives, bounded at one across a sixteen-folder rename,
 * which is why this reports rather than gates.
 *
 * What it cannot see is a prose reference that went stale without carrying the
 * value, such as a declaration citing the wrong standard for the transform, and
 * a family written in a form neither the value nor the three stem shapes reach.
 * A value sweep closes most of this class and no part of either one.
 */
export async function readSuperseded(
  root: string,
  options: SupersededOptions,
): Promise<SupersededReport> {
  if (options.superseded === '') {
    return {
      kind: 'unreadable',
      reason:
        'The superseded value is empty, which matches every line in the tree rather than a convention.',
    }
  }

  if (options.superseded === options.replacement) {
    return {
      kind: 'unreadable',
      reason: `The superseded value and its replacement are both ${options.superseded}, so no convention changed and there is nothing to sweep for.`,
    }
  }

  const listed = await listRepositoryFiles(root)
  if (listed === undefined) {
    return {
      kind: 'unreadable',
      reason: `Git listed no corpus under ${root}. An empty list passes each of its zero files, so a tree git cannot read refuses rather than reporting clean.`,
    }
  }

  const findings: SupersededHit[] = []
  const exempt: SupersededHit[] = []
  let files = 0
  let skipped = 0

  for (const path of listed) {
    let text: string
    try {
      text = await readFile(join(root, path), 'utf8')
    } catch {
      // A listed path that will not open is a symlink leaving the tree or a
      // file removed since git answered. Counted rather than reported, so the
      // run still states that it measured less than it listed.
      skipped += 1
      continue
    }

    if (isBinary(text)) {
      skipped += 1
      continue
    }

    files += 1
    const swept = sweepText(path, text, options)
    findings.push(...swept.findings)
    exempt.push(...swept.exempt)
  }

  return {
    kind: 'measured',
    superseded: options.superseded,
    replacement: options.replacement,
    stems: deriveStems(options),
    listed: listed.length,
    files,
    skipped,
    findings,
    exempt,
  }
}
