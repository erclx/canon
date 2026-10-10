import { resolve } from 'node:path'
import type { Command } from 'commander'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import { currentWorktreeRoot, mainWorktreeRoot } from '@/git/worktree'
import { buildCatalog, renderCatalog } from '@/upstream/catalog'
import {
  advanceCursor,
  llmsDifference,
  readCursor,
  readLastLlms,
} from '@/upstream/cursor'
import { buildDigest } from '@/upstream/digest'
import {
  githubPageFetcher,
  grepHint,
  type FetchFailure,
} from '@/upstream/releases'

const LLMS_URL = 'https://code.claude.com/docs/llms.txt'
const VERSION = /^\d+(\.\d+)*$/

interface RootOption {
  readonly root?: string
  readonly json?: boolean
}

interface FetchOptions extends RootOption {
  readonly since?: string
}

interface AdvanceOptions extends RootOption {
  readonly intake: string
  readonly llms: boolean
}

type Refusal =
  | 'no-cursor'
  | 'bad-since'
  | 'cursor-missing'
  | FetchFailure
  | 'older-than-cursor'
  | 'invalid-version'

const REFUSALS: Record<Refusal, string> = {
  'no-cursor':
    'No cursor is stored, so there is no range to read. Pass --since <version> with the last version a digest covered.',
  'bad-since': 'The --since value is not a dotted version such as 2.1.256.',
  'cursor-missing':
    'The releases feed ran out before reaching a release at or below the cursor, so the range cannot be bounded. Pass --since with a more recent version.',
  'rate-limited':
    'GitHub refused the request. Set GH_TOKEN or GITHUB_TOKEN to lift the hourly limit.',
  network: 'The releases feed could not be reached.',
  http: 'GitHub answered with an error for the releases feed.',
  'older-than-cursor':
    'The version is older than the stored cursor, and the cursor never moves back.',
  'invalid-version': 'The version is not a dotted number such as 2.1.289.',
}

export function register(program: Command): void {
  const upstream = program
    .command('upstream')
    .description(
      'Read Claude Code releases against the toolkit (fetch, catalog, advance)',
    )
    .helpOption('-h, --help', 'Show this help message')
    .addHelpText(
      'after',
      [
        '',
        'Ships in the published CLI as `canon gate` and `canon sandbox` do, but',
        'only the toolkit repository has the skill that drives it, so a target',
        'has no use for these verbs.',
        '',
      ].join('\n'),
    )

  upstream
    .command('fetch')
    .description(
      'List the release lines since the cursor, with the mechanical noise dropped',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--since <version>', 'Read from this version instead of the cursor')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Writes nothing. The cursor moves only through `upstream advance`, so a',
        'run that dies midway reads the same range next time.',
        '',
        'Exit codes:',
        '  0  the range was read, possibly empty',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon upstream fetch --json',
        '  canon upstream fetch --since 2.1.256 --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: FetchOptions) => {
      process.exitCode = await runFetch(opts)
    })

  upstream
    .command('catalog')
    .description("List the toolkit's own mechanisms, one line each")
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Emit the sections as a JSON record instead of text')
    .addHelpText(
      'after',
      [
        '',
        'Writes nothing. Skills, verbs, hooks, and gate stages are read from the',
        'tree, so the list cannot drift from it. A row that exists but cannot be',
        'described is named under Gaps.',
        '',
        'Examples:',
        '  canon upstream catalog',
        '  canon upstream catalog --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RootOption) => {
      process.exitCode = await runCatalog(opts)
    })

  upstream
    .command('advance')
    .description('Move the cursor to a version once its digest is filed')
    .helpOption('-h, --help', 'Show this help message')
    .argument('<version>', 'Last version the digest covered')
    .requiredOption('--intake <slug>', 'Intake folder the digest was filed in')
    .option('--no-llms', 'Keep the stored llms.txt rather than fetching it')
    .option('--root <path>', 'Repository to write, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Writes the cursor and the current llms.txt under the upstream record',
        'folder through a temp file and a rename. It refuses a version older than',
        'the stored cursor.',
        '',
        'Exit codes:',
        '  0  the cursor moved',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon upstream advance 2.1.289 --intake claude-code-2-1-257-to-2-1-289',
        '',
      ].join('\n'),
    )
    .action(async (version: string, opts: AdvanceOptions) => {
      process.exitCode = await runAdvance(version, opts)
    })
}

function refuse(
  reason: Refusal,
  extra: Record<string, unknown>,
  emitJson: boolean,
): number {
  logStep('Refused')
  logWarn(REFUSALS[reason])
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ ...extra, reason, message: REFUSALS[reason] })}\n`,
    )
  }

  return 1
}

async function fetchLlms(): Promise<string | null> {
  try {
    const response = await fetch(LLMS_URL)

    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

async function runFetch(opts: FetchOptions): Promise<number> {
  const emitJson = opts.json ?? false
  const cursorRoot = opts.root ? resolve(opts.root) : await mainWorktreeRoot()
  const readRoot = opts.root ? resolve(opts.root) : await currentWorktreeRoot()

  intro('canon upstream fetch')

  if (opts.since !== undefined && !VERSION.test(opts.since)) {
    return refuse('bad-since', { since: opts.since }, emitJson)
  }
  const cursor = opts.since ?? readCursor(cursorRoot)?.version
  if (!cursor) return refuse('no-cursor', {}, emitJson)

  const digest = await buildDigest(cursor, githubPageFetcher(), (name) =>
    grepHint(readRoot, name),
  )
  if (digest.kind === 'failed') {
    return refuse(digest.reason, {}, emitJson)
  }
  if (digest.kind === 'cursor-missing') {
    return refuse('cursor-missing', { cursor: digest.cursor }, emitJson)
  }

  const llms = await fetchLlms()
  const difference =
    llms === null ? null : llmsDifference(readLastLlms(cursorRoot), llms)

  logStep('Range')
  logInfo(
    `${digest.from} to ${digest.to}, ${plural(digest.releases, 'release')}, ${plural(digest.lines.length, 'line')} kept`,
  )
  if (difference === null) logWarn('llms.txt could not be fetched')
  outro()

  if (!emitJson) {
    for (const line of digest.lines) {
      process.stdout.write(`${line.version}\t${line.text}\n`)
    }
  } else {
    process.stdout.write(
      `${JSON.stringify({
        from: digest.from,
        to: digest.to,
        releases: digest.releases,
        lines: digest.lines,
        llms: difference,
      })}\n`,
    )
  }

  return 0
}

async function runCatalog(opts: RootOption): Promise<number> {
  const root = opts.root ? resolve(opts.root) : await currentWorktreeRoot()
  const catalog = buildCatalog(root)

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(catalog)}\n`)
  } else {
    process.stdout.write(`${renderCatalog(catalog)}\n`)
  }

  return 0
}

async function runAdvance(
  version: string,
  opts: AdvanceOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = opts.root ? resolve(opts.root) : await mainWorktreeRoot()

  intro('canon upstream advance')

  const llms = opts.llms ? await fetchLlms() : null
  const outcome = await advanceCursor(root, {
    version,
    intake: opts.intake,
    today: new Date().toISOString().slice(0, 10),
    llms,
  })
  if (outcome.kind === 'refused') {
    return refuse(outcome.reason, { version }, emitJson)
  }

  logStep('Cursor')
  logInfo(`Moved to ${version}, filed as ${opts.intake}`)
  if (opts.llms && llms === null) {
    logWarn('llms.txt could not be fetched, so the stored copy is unchanged')
  }
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        version,
        intake: opts.intake,
        advanced: true,
        llms: llms === null ? 'kept' : 'stored',
      })}\n`,
    )
  }

  return 0
}
