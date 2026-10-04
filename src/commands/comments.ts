import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  density,
  type Language,
  LANGUAGES,
  type LanguageCount,
  scanTree,
} from '@/comments/scan'
import { type TrendPoint, trend } from '@/comments/trend'
import { loadVocabulary, type Vocabulary } from '@/comments/vocabulary'
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
    .description('Report comment density by language and by comment kind')
    .argument('[path]', 'Tree to scan, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--since <rev>', 'Report the trend from this revision instead')
    .option('--languages <list>', 'Comma-separated subset of ts,sh')
    .addHelpText(
      'after',
      [
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

  const vocabulary = await loadVocabulary(root)
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
        snapshot: snapshot.map(record),
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
