import type { Command } from 'commander'
import { parsePort, report, waitForInterrupt } from '@/serve/report'
import { DEFAULT_PORT, startServer } from '@/serve/static'

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
