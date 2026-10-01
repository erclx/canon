import type { Command } from 'commander'
import { type DocEntry, listDocs } from '@/docs/list'
import { listTopics, readTopic, resolveTopic } from '@/docs/read'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/project-root'
import { intro, logError, logInfo, logStep, logWarn, outro } from '@/ui'

export function register(program: Command): void {
  const docs = program
    .command('docs')
    .description('Emit toolkit reference docs (list, <topic>)')
    .argument('[topic]', 'Doc to print, by exact name')
    .helpOption('-h, --help', 'Show this help message')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  canon docs list',
        '  canon docs list --json',
        '  canon docs agents',
        '',
      ].join('\n'),
    )
    .action((topic: string | undefined) => {
      process.exitCode = topic === undefined ? list({}) : get(topic)
    })

  docs
    .command('list')
    .description('List the docs and domain context with their descriptions')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit machine-readable JSON')
    .action((opts: ListOptions) => {
      process.exitCode = list(opts)
    })
}

interface ListOptions {
  readonly json?: boolean
}

/**
 * The text listing is frame lines on stderr and the `--json` record is the one
 * thing on stdout, so a caller piping it through a wrapper reads JSON alone.
 * The frame opens after the `--json` branch and never wraps it.
 */
function list(opts: ListOptions): number {
  const catalog = listDocs(PROJECT_ROOT)
  const mismatch = checkoutMismatchWarning(process.cwd())

  if (opts.json) {
    if (mismatch !== undefined) logWarn(mismatch)
    const docs: DocEntry[] = catalog.hasContext
      ? [...catalog.docs, ...catalog.context]
      : catalog.docs
    process.stdout.write(`${JSON.stringify({ docs })}\n`)
    return 0
  }

  intro('canon docs')
  if (mismatch !== undefined) logWarn(mismatch)

  logStep('Docs')
  for (const entry of catalog.docs) logInfo(describeEntry(entry))

  if (catalog.hasContext) {
    logStep('Domain context')
    for (const entry of catalog.context) logInfo(describeEntry(entry))
  }

  outro()
  return 0
}

const describeEntry = (entry: DocEntry): string =>
  `${entry.name} : ${entry.description}`

/**
 * Writes the document body to stdout and every frame line to stderr, so a
 * caller capturing the output with `$(...)` receives the document alone.
 */
function get(topic: string): number {
  intro('canon docs')

  const mismatch = checkoutMismatchWarning(process.cwd())
  if (mismatch !== undefined) logWarn(mismatch)

  const resolved = resolveTopic(PROJECT_ROOT, topic)

  if (!resolved) {
    logWarn(`Unknown topic: ${topic}`)
    logStep('Available topics')
    for (const name of listTopics(PROJECT_ROOT)) logInfo(name)
    logError("Run 'canon docs list' for descriptions.")
    outro()
    return 1
  }

  logStep(resolved.rel)
  process.stdout.write(readTopic(resolved))
  outro()
  return 0
}
