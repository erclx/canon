import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { plural } from '@/cli/ui'
import {
  BODY_BLOCK_CAP,
  type CappedRun,
  countFile,
  type DegradationHit,
  FILE_SHARE_CAP,
  type FileShare,
  FILE_SHARE_FLOOR,
  HISTORY_PATTERNS,
  HEAD_TEXT_CAP,
  isPruned,
  type LanguageCount,
  languageFor,
} from '@/comments/scan'
import type { Measure, Emission, MeasureReport } from '@/gate/measures'
import { type GateContext, readChangedLines } from '@/gate/sequencer'
import { listRepositoryFiles } from '@/git/files'

/**
 * Counts every source the scan reads through the scan's own counter, so the
 * report and the gate agree. No exempt marker, since a marker on a long comment
 * is one more comment line.
 */
async function countRepository(
  root: string,
  include: (path: string) => boolean = () => true,
): Promise<{ counts: LanguageCount[]; files: number } | undefined> {
  const paths = await listRepositoryFiles(root)
  if (paths === undefined) return undefined

  const counts = paths.flatMap((path) => {
    const language = languageFor(path)
    if (language === undefined || isPruned(path) || !include(path)) return []
    const text = readFileSync(join(root, path), 'utf8')
    return [countFile({ path, text }, language)]
  })
  return { counts, files: counts.length }
}

/** The changed set as a path test, or every path when scoping is off. */
function touchedBy(
  changed: readonly string[] | undefined,
): ((path: string) => boolean) | undefined {
  if (changed === undefined) return undefined
  const touched = new Set(changed)
  return (path) => touched.has(path)
}

/**
 * Whether a file past `FILE_SHARE_CAP` fails. `commentFileShare` and
 * `shippedCommentCaps` both read it, so the two flip together.
 */
export const FILE_SHARE_FAILS = false

const UNMEASURED: MeasureReport = {
  emissions: [],
  unmeasured:
    'The tracked file list could not be read, so no comment block was measured.',
}

interface CapReading<T> {
  readonly clean: string
  readonly line: (finding: T) => string
  readonly failure: (count: number) => string
}

interface FindingSplit<T> {
  readonly changed: readonly T[]
  readonly untouched: readonly T[]
  readonly notice?: string
}

const runEnd = (run: CappedRun): number => run.line + run.lines - 1

/**
 * Splits runs by whether the branch wrote a line in them. With no base every
 * run counts as changed, and a failed read widens to the same with a notice.
 */
async function splitByChangedLines(
  ctx: GateContext,
  runs: readonly CappedRun[],
): Promise<FindingSplit<CappedRun>> {
  if (ctx.base === undefined) return { changed: runs, untouched: [] }
  const files = [...new Set(runs.map((run) => run.file))]
  const lines = await readChangedLines(ctx.run, ctx.base, files)
  if (lines === undefined) {
    return {
      changed: runs,
      untouched: [],
      notice:
        'The changed lines could not be read, so every run in a touched file fails',
    }
  }

  const wrote = (run: CappedRun): boolean => {
    const changed = lines.get(run.file)
    if (changed === undefined) return false
    if (changed === 'whole') return true
    return changed.some(
      (span) => span.start <= runEnd(run) && span.end >= run.line,
    )
  }
  return {
    changed: runs.filter(wrote),
    untouched: runs.filter((run) => !wrote(run)),
  }
}

/**
 * Fails the runs `pick` returns from the files a change touched, or only those
 * `split` reads as changed. A full run reports without failing.
 */
function capMeasure<T>(
  pick: (count: LanguageCount) => readonly T[],
  reading: CapReading<T>,
  split?: (
    ctx: GateContext,
    findings: readonly T[],
  ) => Promise<FindingSplit<T>>,
): Measure {
  // The stage test through `runStage` fails if the sequencer passes less context.
  return async (ctx: GateContext) => {
    const counted = await countRepository(ctx.root, touchedBy(ctx.changed))
    if (counted === undefined) return UNMEASURED

    const scope = plural(
      counted.files,
      ctx.changed === undefined ? 'source file' : 'touched source file',
    )
    const findings = counted.counts.flatMap(pick)
    if (findings.length === 0) {
      return {
        emissions: [{ kind: 'info', text: `${reading.clean} across ${scope}` }],
      }
    }

    const emissions = findings.map((finding) => ({
      kind: 'warn' as const,
      text: reading.line(finding),
    }))
    if (ctx.changed === undefined) {
      return {
        emissions: [
          ...emissions,
          {
            kind: 'info',
            text: `Reported across ${scope} and not failed, since only a touched file fails`,
          },
        ],
      }
    }
    const { changed, untouched, notice } =
      split === undefined
        ? { changed: findings, untouched: [], notice: undefined }
        : await split(ctx, findings)
    const reported: Emission[] = [
      ...untouched.map((finding) => ({
        kind: 'warn' as const,
        text: `${reading.line(finding)}, untouched by this branch`,
      })),
      ...(notice === undefined
        ? []
        : [{ kind: 'info' as const, text: notice }]),
      ...(untouched.length === 0
        ? []
        : [
            {
              kind: 'info' as const,
              text: `${plural(untouched.length, 'untouched run')} reported and not failed, since only a run the branch changed fails`,
            },
          ]),
    ]
    const failing = changed.map((finding) => ({
      kind: 'warn' as const,
      text: reading.line(finding),
    }))
    if (failing.length === 0) return { emissions: reported }
    return {
      emissions: [...failing, ...reported],
      failure: reading.failure(failing.length),
    }
  }
}

const HEAD_READING: CapReading<CappedRun> = {
  clean: `No head comment run past ${HEAD_TEXT_CAP} text lines`,
  line: (block) =>
    `${block.file}:${block.line} runs ${block.textLines} comment text lines outside a function body, past ${HEAD_TEXT_CAP}`,
  failure: (count) =>
    `${plural(count, 'head comment run')} past ${HEAD_TEXT_CAP} text lines. Cut each to the contract or the constraint the code cannot carry.`,
}

const BODY_READING: CapReading<CappedRun> = {
  clean: `No in-body comment run past ${BODY_BLOCK_CAP} text line`,
  line: (block) =>
    `${block.file}:${block.line} runs ${block.textLines} comment text lines inside a function body, past ${BODY_BLOCK_CAP}`,
  failure: (count) =>
    `${plural(count, 'in-body comment run')} past ${BODY_BLOCK_CAP} text line. Move the reason above the function or into the code it explains.`,
}

/** Fails a changed run outside every function body past `HEAD_TEXT_CAP` text lines. */
export const commentHeadBlocks: Measure = capMeasure(
  (count) => count.headBlocks,
  HEAD_READING,
  splitByChangedLines,
)

/** Fails a changed run inside a function body past `BODY_BLOCK_CAP` text lines. */
export const commentBodyBlocks: Measure = capMeasure(
  (count) => count.bodyBlocks,
  BODY_READING,
  splitByChangedLines,
)

const SHARE_CAP = `${FILE_SHARE_CAP * 100}%`

const shareEmission = (share: FileShare): Emission => ({
  kind: 'warn',
  text: `${share.file} carries ${share.textLines} comment text lines in ${share.nonBlankLines}, past ${SHARE_CAP}`,
})

const shareFailure = (count: number): string =>
  `${plural(count, 'file')} past ${SHARE_CAP} comment text. Cut each comment to the fact the code cannot carry.`

/**
 * Reports each file past `FILE_SHARE_CAP` comment text, touched or full, and
 * fails a touched file only once `FILE_SHARE_FAILS` flips.
 */
export const commentFileShare: Measure = async (ctx: GateContext) => {
  const counted = await countRepository(ctx.root, touchedBy(ctx.changed))
  if (counted === undefined) return UNMEASURED

  const scope = plural(
    counted.files,
    ctx.changed === undefined ? 'source file' : 'touched source file',
  )
  const shares = counted.counts.flatMap((count) => count.fileShares)
  if (shares.length === 0) {
    return {
      emissions: [
        {
          kind: 'info',
          text: `No file of ${FILE_SHARE_FLOOR} lines or more past ${SHARE_CAP} comment text across ${scope}`,
        },
      ],
    }
  }

  const emissions = shares.map(shareEmission)
  if (FILE_SHARE_FAILS && ctx.changed !== undefined) {
    return { emissions, failure: shareFailure(shares.length) }
  }
  return {
    emissions: [
      ...emissions,
      {
        kind: 'info',
        text: `Reported across ${scope} and not failed until the comment sweep lands`,
      },
    ],
  }
}

const HISTORY_TERMS = new Set(HISTORY_PATTERNS.map(({ term }) => term))

const historyHits = (count: LanguageCount): readonly DegradationHit[] =>
  count.degradationHits.filter((hit) => HISTORY_TERMS.has(hit.term))

const HISTORY_READING: CapReading<DegradationHit> = {
  clean: 'No date, commit hash, or issue reference in a comment',
  line: (hit) => `${hit.file}:${hit.line} carries a ${hit.term} in a comment`,
  failure: (count) =>
    `${plural(count, 'comment')} carrying change history. Move the history to the pull request and keep the fact the code needs.`,
}

/** Fails a touched file's comment carrying a date, a commit hash, or an issue reference. */
export const commentHistory: Measure = capMeasure(historyHits, HISTORY_READING)

/** Any stack's shipped files, whatever the stack is named. */
const SHIPPED_PATH = /^tooling\/[^/]+\/(configs|seeds)\//

/**
 * Fails a shipped file past a head, in-body, or history cap whether or not a
 * change touched it, since a target fails on every file sync writes. Share
 * fails only once `FILE_SHARE_FAILS` flips.
 */
export const shippedCommentCaps: Measure = async (ctx: GateContext) => {
  const counted = await countRepository(ctx.root, (path) =>
    SHIPPED_PATH.test(path),
  )
  if (counted === undefined) return UNMEASURED

  const counts = counted.counts
  const lines = [
    ...counts.flatMap((count) => count.headBlocks).map(HEAD_READING.line),
    ...counts.flatMap((count) => count.bodyBlocks).map(BODY_READING.line),
    ...counts.flatMap(historyHits).map(HISTORY_READING.line),
  ]
  const shares = counts.flatMap((count) => count.fileShares)
  const scope = plural(counted.files, 'shipped source file')
  if (lines.length === 0 && shares.length === 0) {
    return {
      emissions: [
        { kind: 'info', text: `No comment cap exceeded across ${scope}` },
      ],
    }
  }

  const emissions: Emission[] = [
    ...lines.map((text) => ({ kind: 'warn' as const, text })),
    ...shares.map(shareEmission),
  ]
  const failures = lines.length + (FILE_SHARE_FAILS ? shares.length : 0)
  if (failures === 0) {
    return {
      emissions: [
        ...emissions,
        {
          kind: 'info',
          text: `Share reported across ${scope} and not failed until the comment sweep lands`,
        },
      ],
    }
  }
  return {
    emissions,
    failure: `${plural(failures, 'comment cap finding')} in files sync writes into a target. Cut each to the contract or the constraint the code cannot carry.`,
  }
}
