import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  addFrame,
  addPage,
  type ContentRefused,
  canvasDir,
  DEFAULT_FRAME,
  listPages,
  renamePage,
} from '@/canvas/content'
import { CANVAS_PORT, startCanvas } from '@/canvas/server'
import { resolveFrameTokens } from '@/canvas/tokens'
import { displayPath, parsePort, waitForInterrupt } from '@/serve/report'
import {
  intro,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  plural,
} from '@/ui'
import { mainWorktreeRoot } from '@/worktree'

const BANNER = 'canon canvas'

interface RootOptions {
  readonly root?: string
  readonly json?: boolean
}

async function resolveRoot(opts: RootOptions): Promise<string> {
  return opts.root
    ? resolve(process.cwd(), opts.root)
    : await mainWorktreeRoot()
}

function writeJson(record: unknown): void {
  process.stdout.write(`${JSON.stringify(record)}\n`)
}

/** Every verb's refusal, framed on stderr and mirrored on stdout under --json. */
function refuse(refusal: ContentRefused, emitJson: boolean): number {
  if (emitJson) writeJson(refusal)
  intro(BANNER)
  logError(refusal.detail)
  outro()
  return 1
}

/**
 * Parses a size flag. NaN for a value that is not a positive integer, which
 * the content module then refuses as an invalid size.
 */
function parseSize(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : Number.NaN
}

function withRoot(command: Command): Command {
  return command
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Project root, defaulting to the main worktree')
    .option('--json', 'Emit a machine-readable record on stdout')
}

export function register(program: Command): void {
  const canvas = program
    .command('canvas')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Local canvas of pages and HTML frames (serve, list, page, frame)',
    )
    .addHelpText(
      'after',
      [
        '',
        'A page is a folder under .canon/canvas/, a frame is one HTML file in',
        'it, and layout.json beside them holds each frame box. Edit a frame by',
        'editing its file, and an open canvas reloads that frame.',
        '',
        'Examples:',
        '  canon canvas serve',
        '  canon canvas page add drafts',
        '  canon canvas frame add drafts hero --width 1440 --height 900',
        '  canon canvas list --json',
        '',
      ].join('\n'),
    )

  withRoot(
    canvas
      .command('serve')
      .description('Serve the canvas on localhost and print the link')
      .option('--port <number>', `Port to try first, default ${CANVAS_PORT}`),
  )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the server stopped after running',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'The server binds 127.0.0.1 and nothing else. It runs until',
        'interrupted, so a session wanting the link starts it in the',
        'background and reads the record off stdout.',
        '',
      ].join('\n'),
    )
    .action(async (opts: RootOptions & { port?: string }) => {
      process.exitCode = await runServe(opts)
    })

  withRoot(
    canvas.command('list').description('List pages and the frames on each'),
  ).action(async (opts: RootOptions) => {
    const root = await resolveRoot(opts)
    const pages = listPages(root)
    if (opts.json) {
      writeJson({ ok: true, root, content: canvasDir(root), pages })
    }
    intro(BANNER)
    if (pages.length === 0) {
      logStep('No pages')
      logInfo('canon canvas page add <name> adds one')
    }
    for (const page of pages) {
      logStep(`${page.name} (${plural(page.frames.length, 'frame')})`)
      for (const frame of page.frames) {
        logInfo(`${frame.name}  ${frame.width} × ${frame.height}`)
      }
      if (page.layoutIssue === 'malformed') {
        logWarn('layout.json does not parse, so frames sit in a default row')
      }
    }
    outro()
  })

  const page = canvas
    .command('page')
    .helpOption('-h, --help', 'Show this help message')
    .description('Add or rename a page')

  withRoot(
    page
      .command('add')
      .description('Add a page')
      .argument('<name>', 'Page name, one path segment'),
  ).action(async (name: string, opts: RootOptions) => {
    const root = await resolveRoot(opts)
    const outcome = addPage(root, name)
    if (!outcome.ok) {
      process.exitCode = refuse(outcome, opts.json ?? false)
      return
    }
    if (opts.json) writeJson(outcome)
    intro(BANNER)
    logAdd(`page ${outcome.page}`)
    outro()
  })

  withRoot(
    page
      .command('rename')
      .description('Rename a page, keeping its frames and layout')
      .argument('<from>', 'Current page name')
      .argument('<to>', 'New page name'),
  ).action(async (from: string, to: string, opts: RootOptions) => {
    const root = await resolveRoot(opts)
    const outcome = renamePage(root, from, to)
    if (!outcome.ok) {
      process.exitCode = refuse(outcome, opts.json ?? false)
      return
    }
    if (opts.json) writeJson({ ...outcome, from })
    intro(BANNER)
    logAdd(`page ${from} → ${outcome.page}`)
    outro()
  })

  const frame = canvas
    .command('frame')
    .helpOption('-h, --help', 'Show this help message')
    .description('Add a frame to a page')

  withRoot(
    frame
      .command('add')
      .description('Add a frame as a new HTML file, placed after the others')
      .argument('<page>', 'Page to add the frame to')
      .argument('<name>', 'Frame name, which becomes <name>.html')
      .option('--width <px>', `Frame width, default ${DEFAULT_FRAME.width}`)
      .option('--height <px>', `Frame height, default ${DEFAULT_FRAME.height}`),
  ).action(
    async (
      pageName: string,
      name: string,
      opts: RootOptions & { width?: string; height?: string },
    ) => {
      const root = await resolveRoot(opts)
      const outcome = addFrame(root, pageName, name, {
        width: parseSize(opts.width, DEFAULT_FRAME.width),
        height: parseSize(opts.height, DEFAULT_FRAME.height),
      })
      if (!outcome.ok) {
        process.exitCode = refuse(outcome, opts.json ?? false)
        return
      }
      if (opts.json) {
        writeJson({
          ...outcome,
          path: resolve(canvasDir(root), outcome.page, outcome.file),
        })
      }
      intro(BANNER)
      logAdd(`${outcome.page}/${outcome.file}`)
      logInfo(
        `${outcome.box.width} × ${outcome.box.height} at ${outcome.box.x}, ${outcome.box.y}`,
      )
      outro()
    },
  )
}

async function runServe(
  opts: RootOptions & { port?: string },
): Promise<number> {
  const emitJson = opts.json ?? false
  const port = opts.port === undefined ? CANVAS_PORT : parsePort(opts.port)
  if (port === undefined) {
    return refuseServe('no-port', `${opts.port} is not a port`, emitJson)
  }

  const root = await resolveRoot(opts)
  /*
   * Imported here rather than at the top, so a command module the test runner
   * loads never asks it for an HTML module it cannot parse.
   */
  const { default: shell } = await import('@/canvas/index.html')
  const outcome = startCanvas(root, { port, shell })
  if (!outcome.ok) {
    return refuseServe(outcome.reason, outcome.detail, emitJson)
  }

  const tokens = resolveFrameTokens(root)
  const { css: _css, ...tokenSource } = tokens
  if (emitJson) {
    writeJson({
      ok: true,
      root: outcome.root,
      content: outcome.content,
      host: outcome.host,
      port: outcome.port,
      url: outcome.url,
      tokens: tokenSource,
    })
  }
  intro(BANNER)
  logStep('Serving')
  logInfo(displayPath(outcome.content))
  logStep('Open')
  logInfo(outcome.url)
  logStep('Tokens')
  if (tokens.source === 'none') logWarn(tokens.notice)
  else if (tokens.source === 'installed') {
    for (const file of tokens.files) logInfo(file)
  } else logInfo('this toolkit’s own token module')
  logStep('Stop')
  logInfo('Ctrl-C')

  await waitForInterrupt(outcome.stop)
  return 0
}

function refuseServe(
  reason: string,
  detail: string,
  emitJson: boolean,
): number {
  if (emitJson) writeJson({ ok: false, reason, detail })
  intro(BANNER)
  logError(detail)
  outro()
  return 1
}
