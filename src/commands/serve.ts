import type { Command } from 'commander'
import { relative } from 'node:path'
import { DEFAULT_PORT, type ServeOutcome, startServer } from '@/serve/static'
import { intro, logError, logInfo, logStep, logWarn, outro } from '@/ui'

const DEFAULT_DIR = '.'

interface ServeCommandOptions {
  readonly entry?: string
  readonly index?: boolean
  readonly json?: boolean
  readonly port?: string
}

export function register(program: Command): void {
  program
    .command('serve')
    .description('Serve a directory over localhost and print the preview link')
    .argument('[dir]', 'Directory to serve', DEFAULT_DIR)
    .helpOption('-h, --help', 'Show this help message')
    .option('--port <number>', `Port to try first, default ${DEFAULT_PORT}`)
    .option('--entry <path>', 'Page the printed link opens, default index.html')
    .option(
      '--index',
      'List a directory that has no index.html instead of answering 404',
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the server stopped after running',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'The server binds 127.0.0.1 and nothing else, and it sends no cache',
        'headers, so an edited stylesheet is never served stale. A port in use',
        'is not a failure: the next free one is taken and the link says which.',
        '',
        'It runs until interrupted. A session wanting the link without waiting',
        'starts it in the background and reads the record off stdout.',
        '',
        'Examples:',
        '  canon serve .canon/teach',
        '  canon serve .canon/teach --entry 03-fde-system-design/index.html',
        '  canon serve dist --port 4000 --json',
        '  canon serve .canon/groundwork --index',
        '',
      ].join('\n'),
    )
    .action(async (dir: string, opts: ServeCommandOptions) => {
      process.exitCode = await runServe(dir, opts)
    })
}

async function runServe(
  dir: string,
  opts: ServeCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  const port = parsePort(opts.port)
  if (port === undefined) {
    return report(
      { ok: false, reason: 'no-port', detail: `${opts.port} is not a port` },
      emitJson,
    )
  }

  const outcome = startServer(dir, {
    port,
    entry: opts.entry,
    index: opts.index,
  })
  const code = report(outcome, emitJson)
  if (!outcome.ok) return code

  await waitForInterrupt(outcome.stop)
  return 0
}

/**
 * The relative path where it stays inside the working directory, and the
 * absolute one where it climbs out. A run from a linked worktree serving the
 * main root reports `../../teach`, which names the directory without giving a
 * reader anything they can open.
 */
function displayPath(root: string): string {
  const near = relative(process.cwd(), root)
  if (near === '') return '.'
  return near.startsWith('..') ? root : near
}

/**
 * Undefined for a value that is not a port, distinct from an absent flag,
 * which takes the default. A `Number` of a typo is `NaN`, and passing that on
 * asks the runtime to bind a port nobody named.
 */
function parsePort(raw: string | undefined): number | undefined {
  if (raw === undefined) return DEFAULT_PORT
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 65535) return undefined
  return value
}

function report(outcome: ServeOutcome, emitJson: boolean): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, detail: outcome.detail })}\n`,
      )
      return 1
    }
    intro('canon serve')
    logError(outcome.detail)
    outro()
    return 1
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root: outcome.root,
        host: outcome.host,
        port: outcome.port,
        entry: outcome.entry,
        url: outcome.url,
        entryExists: outcome.entryExists,
      })}\n`,
    )
    return 0
  }

  intro('canon serve')
  logStep('Serving')
  logInfo(displayPath(outcome.root))
  logStep('Open')
  logInfo(outcome.url)

  if (!outcome.entryExists) {
    logStep('No entry page')
    logWarn(
      `${outcome.entry} is not in that directory, so the link opens a 404`,
    )
  }

  logStep('Stop')
  logInfo('Ctrl-C')
  return 0
}

/**
 * Resolves when the process is asked to stop. The frame is closed here rather
 * than in the reporter, because the run is the serving rather than the start,
 * and closing at start would print the frame's end while the server ran on.
 */
function waitForInterrupt(stop: () => Promise<void>): Promise<void> {
  return new Promise((settle) => {
    const finish = () => {
      void stop().then(() => {
        outro()
        settle()
      })
    }
    process.once('SIGINT', finish)
    process.once('SIGTERM', finish)
  })
}
