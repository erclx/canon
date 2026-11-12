import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  BLOCK_LINE_CHECKPOINT,
  BODY_BLOCK_CAP,
  density,
  FILE_LONG_BLOCK_CAP,
  LONG_BLOCK_FLOOR,
  type Language,
  LANGUAGES,
  type LanguageCount,
  scanTree,
} from '@/comments/scan'
import { type TrendPoint, trend } from '@/comments/trend'
import { loadVocabulary, type Vocabulary } from '@/comments/vocabulary'
import { currentWorktreeRoot } from '@/git/worktree'
import { intro, logInfo, logStep, logWarn, outro, pipeOutput } from '@/cli/ui'

interface ScanCommandOptions {
  readonly json?: boolean
  readonly since?: string
  readonly languages?: string
}

const LABELS: Record<Language, string> = {
  ts: 'TypeScript',
  sh: 'Bash',
}

export function register(program: Command): void {
  const comments = program
    .command('comments')
    .description('Measure comment density and trend across a source tree')
    .helpOption('-h, --help', 'Show this help message')

  comments
    .command('scan')
    .description(
      'Report comment density by language and kind, every comment run past the checkpoint with its placement, and what the comment caps would fail',
    )
    .argument('[path]', 'Tree to scan, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--since <rev>', 'Report the trend from this revision instead')
    .option('--languages <list>', 'Comma-separated subset of ts,sh')
    .addHelpText(
      'after',
      [
        '',
        'Placement:',
        '  head  outside every function body, such as a doc block above one',
        '  body  inside a function body, a nested function heading included',
        '  -     unread, as for every bash run',
        '',
        'Caps, which canon gate run fails on and this report only lists:',
        `  an in-body run past ${BODY_BLOCK_CAP} lines`,
        `  a file past ${FILE_LONG_BLOCK_CAP} lines in runs of ${LONG_BLOCK_FLOOR} or more`,
        '',
        'Exit codes:',
        '  0  the scan completed',
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon comments scan',
        '  canon comments scan src --json',
        '  canon comments scan --since v0.5.0',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: ScanCommandOptions) => {
      process.exitCode = await runScan(path, opts)
    })
}

function parseLanguages(list: string | undefined): Language[] | string {
  if (!list) return [...LANGUAGES]

  const requested = list
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const unknown = requested.filter(
    (entry) => !LANGUAGES.includes(entry as Language),
  )
  if (unknown.length > 0) {
    return `Unknown language: ${unknown.join(', ')}. Known: ${LANGUAGES.join(', ')}.`
  }

  return requested as Language[]
}

async function runScan(
  path: string | undefined,
  opts: ScanCommandOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  const emitJson = opts.json ?? false
  const languages = parseLanguages(opts.languages)

  intro('canon comments scan')

  if (typeof languages === 'string') {
    logStep('Refused')
    logWarn(languages)
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ root, reason: 'bad-languages', message: languages })}\n`,
      )
    }
    return 1
  }

  // The rule roots sit at the project root, so a path argument reads them from
  // the checkout holding it and keeps the scanned path for the file walk alone.
  const vocabulary = await loadVocabulary(await currentWorktreeRoot(root))
  const scanOptions = {
    languages,
    vocabulary: vocabulary.kind === 'loaded' ? vocabulary.terms : [],
  }

  const snapshot = await scanTree(root, scanOptions)
  reportSnapshot(snapshot)

  const points = opts.since
    ? await trend(root, { ...scanOptions, since: opts.since })
    : []

  if (opts.since) reportTrend(points, languages)

  reportLongBlocks(snapshot)
  reportCaps(snapshot)
  reportVocabulary(vocabulary, snapshot)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        path: root,
        vocabulary:
          vocabulary.kind === 'loaded'
            ? { source: vocabulary.source, terms: vocabulary.terms }
            : null,
        blockCheckpoint: BLOCK_LINE_CHECKPOINT,
        longBlockFloor: LONG_BLOCK_FLOOR,
        bodyBlockCap: BODY_BLOCK_CAP,
        fileLongBlockCap: FILE_LONG_BLOCK_CAP,
        snapshot: snapshot.map((count) => ({
          ...record(count),
          blocks: count.blocks,
          bodyBlocks: count.bodyBlocks,
          longBlockFiles: count.longBlockFiles,
        })),
        // A trend point keeps the summary keys alone, so a long range does
        // not repeat every block list once per revision.
        trend: points.map((point) => ({
          rev: point.rev,
          date: point.date,
          languages: point.languages.map(record),
        })),
      })}\n`,
    )
  }

  return 0
}

function record(count: LanguageCount): Record<string, unknown> {
  return {
    language: count.language,
    files: count.files,
    lines: count.lines,
    commentLines: count.commentLines,
    density: Number(density(count).toFixed(4)),
    docBlocks: count.docBlocks,
    inlineComments: count.inlineComments,
    degradationHits: count.degradationHits,
    longBlocks: count.longBlocks,
  }
}

function percent(count: LanguageCount): string {
  return `${(density(count) * 100).toFixed(1)}%`
}

function reportSnapshot(snapshot: readonly LanguageCount[]): void {
  logStep('Snapshot')

  for (const count of snapshot) {
    if (count.files === 0) {
      logInfo(`${LABELS[count.language]}: no files`)
      continue
    }

    logInfo(
      `${LABELS[count.language]}: ${count.commentLines} comment lines in ${count.lines} (${percent(count)}), ${count.files} files`,
    )
    logInfo(
      `  ${count.docBlocks} doc blocks, ${count.inlineComments} inline comments`,
    )
  }
}

function reportTrend(
  points: readonly TrendPoint[],
  languages: readonly Language[],
): void {
  logStep('Trend')

  if (points.length === 0) {
    logWarn('No commits in range. Check the revision passed to --since.')
    return
  }

  for (const language of languages) {
    const rows = points
      .map((point) => {
        const count = point.languages.find(
          (entry) => entry.language === language,
        )
        if (!count) return undefined
        return `${point.rev.slice(0, 8)}  ${point.date}  ${String(count.lines).padStart(6)} lines  ${String(count.commentLines).padStart(5)} comments  ${percent(count).padStart(6)}`
      })
      .filter((row): row is string => row !== undefined)

    // A language the tree does not carry would otherwise print a column of
    // zeros, which reads as a measured decline rather than an absence.
    const measured = points.some((point) =>
      point.languages.some(
        (entry) => entry.language === language && entry.files > 0,
      ),
    )
    if (rows.length === 0 || !measured) continue

    logInfo(LABELS[language])
    pipeOutput(rows.join('\n'))
  }
}

/**
 * Lists every comment run past the checkpoint, longest first, with where it
 * sits.
 *
 * A long run is a prompt to read it against the code beside it, and some
 * belong where they are, so the step names the length and asks nothing of it.
 */
function reportLongBlocks(snapshot: readonly LanguageCount[]): void {
  logStep('Long comment blocks')

  const blocks = snapshot
    .flatMap((count) => count.blocks)
    .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file))

  if (blocks.length === 0) {
    logInfo(`None past ${BLOCK_LINE_CHECKPOINT} lines.`)
    return
  }

  const files = snapshot.reduce(
    (sum, count) => sum + count.longBlocks.length,
    0,
  )
  logInfo(
    `${blocks.length} runs past ${BLOCK_LINE_CHECKPOINT} lines in ${files} files`,
  )
  pipeOutput(
    blocks
      .map(
        (block) =>
          `${block.file}:${block.line}  ${block.lines} lines  ${block.placement ?? '-'}`,
      )
      .join('\n'),
  )
}

/** Lists what the two comment caps `canon gate run` holds would fail. */
function reportCaps(snapshot: readonly LanguageCount[]): void {
  logStep('Comment caps')

  const body = snapshot.flatMap((count) => count.bodyBlocks)
  const files = snapshot
    .flatMap((count) => count.longBlockFiles)
    .filter((file) => file.lines > FILE_LONG_BLOCK_CAP)

  if (body.length === 0) {
    logInfo(`No in-body run past ${BODY_BLOCK_CAP} lines.`)
  } else {
    logWarn(`${body.length} in-body runs past ${BODY_BLOCK_CAP} lines`)
    pipeOutput(
      body
        .map((block) => `${block.file}:${block.line}  ${block.lines} lines`)
        .join('\n'),
    )
  }

  if (files.length === 0) {
    logInfo(
      `No file past ${FILE_LONG_BLOCK_CAP} lines in runs of ${LONG_BLOCK_FLOOR} or more.`,
    )
  } else {
    logWarn(
      `${files.length} files past ${FILE_LONG_BLOCK_CAP} lines in runs of ${LONG_BLOCK_FLOOR} or more`,
    )
    pipeOutput(
      files.map((file) => `${file.file}  ${file.lines} lines`).join('\n'),
    )
  }
}

/**
 * Reports the sweep as skipped when no rule publishes a vocabulary.
 *
 * Zero hits against an empty vocabulary is indistinguishable from a clean
 * codebase in the output, and the two mean opposite things, so the absent case
 * says so rather than printing a count nobody looked for.
 */
function reportVocabulary(
  vocabulary: Vocabulary,
  snapshot: readonly LanguageCount[],
): void {
  logStep('Degradation sweep')

  if (vocabulary.kind === 'absent') {
    logWarn('Skipped. No rule publishes a "Degradation vocabulary" heading.')
    return
  }

  const hits = snapshot.flatMap((count) => count.degradationHits)
  logInfo(`${vocabulary.terms.length} terms from ${vocabulary.source}`)

  if (hits.length === 0) {
    logInfo('No hits.')
    return
  }

  logWarn(`${hits.length} hits`)
  pipeOutput(
    hits.map((hit) => `${hit.file}:${hit.line}  ${hit.term}`).join('\n'),
  )
}
