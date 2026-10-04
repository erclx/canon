import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  addFrame,
  addPage,
  type ContentRefused,
  canvasDir,
  DEFAULT_FRAME,
  listPages,
  moveFrame,
  readPage,
  readSelection,
  renamePage,
} from '@/canvas/content'
import { captureCanvas, captureComposite } from '@/canvas/capture'
import {
  type EditRefused,
  editFrameAtIndex,
  STYLE_PROPERTIES,
} from '@/canvas/edit'
import {
  clearEditing,
  EDITING_TTL_MS,
  markEditing,
  readEditing,
} from '@/canvas/editing'
import { CANVAS_PORT, startCanvas } from '@/canvas/server'
import { PROJECT_ROOT } from '@/project-root'
import { resolveFrameTokens } from '@/canvas/tokens'
import { displayPath, parsePort, waitForInterrupt } from '@/serve/report'
import {
  callerIdentity,
  type Located,
  resolveSessions,
  selfOf,
} from '@/sessions/resolve'
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
import { mainWorktreeRoot } from '@/git/worktree'

const BANNER = 'canon canvas'

interface RootOptions {
  readonly root?: string
  readonly json?: boolean
}

interface Refused {
  readonly ok: false
  readonly reason:
    | ContentRefused['reason']
    | EditRefused['reason']
    | 'no-root'
    | 'no-server'
    | 'capture-failed'
    | 'missing-client-deps'
  readonly detail: string
}

const CLIENT_DEPS = ['preact', '@preact/signals'] as const

/**
 * Refuses when the shell's client packages do not resolve from `from`, since
 * the bundler then answers `/` with an empty page rather than an error. The
 * caller passes the package root the binary runs from, never the served
 * project's, so a global install serving a target finds its own copies.
 */
export function missingClientDeps(from: string): Refused | undefined {
  const missing = CLIENT_DEPS.filter((name) => {
    try {
      Bun.resolveSync(name, from)
      return false
    } catch {
      return true
    }
  })
  if (missing.length === 0) return undefined
  return {
    ok: false,
    reason: 'missing-client-deps',
    detail: `${missing.join(', ')} not installed in ${from}, so the canvas shell cannot load. Run bun install there`,
  }
}

type RootOutcome = { readonly ok: true; readonly root: string } | Refused

/**
 * Refuses a root that is not a directory rather than letting the first write
 * scaffold `.canon/canvas/` under a mistyped path, the way `canon serve`
 * refuses a directory it cannot find.
 */
async function resolveRoot(opts: RootOptions): Promise<RootOutcome> {
  const root = opts.root
    ? resolve(process.cwd(), opts.root)
    : await mainWorktreeRoot()
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    return {
      ok: false,
      reason: 'no-root',
      detail: `${root} is not a directory`,
    }
  }
  return { ok: true, root }
}

function writeJson(record: unknown): void {
  process.stdout.write(`${JSON.stringify(record)}\n`)
}

/** Every verb's refusal, framed on stderr and mirrored on stdout under --json. */
function refuse(refusal: Refused, emitJson: boolean): number {
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
      'Local canvas of pages and HTML frames (serve, list, page, frame, selection, edit, editing, capture)',
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
        '  canon canvas frame move drafts hero --x 200 --y 120',
        '  canon canvas selection --json',
        "  canon canvas edit drafts/hero --element 4 --set 'color=var(--color-accent)'",
        '  canon canvas editing drafts/hero',
        '  canon canvas capture drafts/hero',
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
    const resolved = await resolveRoot(opts)
    if (!resolved.ok) {
      process.exitCode = refuse(resolved, opts.json ?? false)
      return
    }
    const { root } = resolved
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
    const resolved = await resolveRoot(opts)
    const outcome = resolved.ok ? addPage(resolved.root, name) : resolved
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
    const resolved = await resolveRoot(opts)
    const outcome = resolved.ok ? renamePage(resolved.root, from, to) : resolved
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
    .description('Add a frame to a page, or move one')

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
      const resolved = await resolveRoot(opts)
      if (!resolved.ok) {
        process.exitCode = refuse(resolved, opts.json ?? false)
        return
      }
      const { root } = resolved
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

  withRoot(
    frame
      .command('move')
      .description('Move a frame, keeping its size')
      .argument('<page>', 'Page the frame is on')
      .argument('<name>', 'Frame name')
      .option('--x <px>', 'New x, defaulting to where the frame is')
      .option('--y <px>', 'New y, defaulting to where the frame is'),
  ).action(
    async (
      pageName: string,
      name: string,
      opts: RootOptions & { x?: string; y?: string },
    ) => {
      const resolved = await resolveRoot(opts)
      if (!resolved.ok) {
        process.exitCode = refuse(resolved, opts.json ?? false)
        return
      }
      const { root } = resolved
      const current = readPage(root, pageName)?.frames.find(
        (candidate) => candidate.name === name,
      )
      const outcome = moveFrame(root, pageName, name, {
        x: parsePosition(opts.x, current?.x ?? 0),
        y: parsePosition(opts.y, current?.y ?? 0),
      })
      if (!outcome.ok) {
        process.exitCode = refuse(outcome, opts.json ?? false)
        return
      }
      if (opts.json) writeJson(outcome)
      intro(BANNER)
      logAdd(`${outcome.page}/${outcome.file}`)
      logInfo(`at ${outcome.box.x}, ${outcome.box.y}`)
      outro()
    },
  )

  withRoot(
    canvas
      .command('selection')
      .description(
        'Report the frame, or the element in it, the operator selected',
      ),
  )
    .addHelpText(
      'after',
      [
        '',
        'Reports none when nothing is selected or when the selected frame has',
        'since been removed. Read this when the operator says "this one".',
        '',
        'An element is named by its index in document order, with the tag,',
        'classes, and text it had when picked. stale is true once the frame',
        'file changed since, since the index may then name another element.',
        '',
      ].join('\n'),
    )
    .action(async (opts: RootOptions) => {
      const resolved = await resolveRoot(opts)
      if (!resolved.ok) {
        process.exitCode = refuse(resolved, opts.json ?? false)
        return
      }
      const { root } = resolved
      const selected = readSelection(root)
      if (opts.json) {
        writeJson({
          ok: true,
          selection: selected
            ? {
                ...selected,
                path: resolve(canvasDir(root), selected.page, selected.file),
              }
            : null,
        })
      }
      intro(BANNER)
      if (!selected) {
        logStep('Nothing selected')
      } else {
        logStep(`${selected.page}/${selected.frame}`)
        const { box, element } = selected
        logInfo(`${box.width} × ${box.height} at ${box.x}, ${box.y}`)
        if (element) {
          const classes = element.classes.map((name) => `.${name}`).join('')
          logInfo(
            `<${element.tag}${classes}> at index ${element.index}: ${element.text}`,
          )
          if (element.stale) {
            logWarn('The frame changed since, so the index may have moved')
          }
        }
      }
      outro()
    })

  withRoot(
    canvas
      .command('edit')
      .description(
        'Set one property of an element in a frame, the writer the inspector uses',
      )
      .argument('<target>', '<page>/<frame>')
      .requiredOption(
        '--element <index>',
        'The element by its index in document order, as canvas selection reports it',
      )
      .requiredOption(
        '--set <property=value>',
        'The property and its value, where an empty value drops a style property',
      ),
  )
    .addHelpText(
      'after',
      [
        '',
        `Properties: text, ${STYLE_PROPERTIES.join(', ')}.`,
        'A style property is written into the element inline style and',
        'leaves its other properties as they were. text replaces the text of',
        'an element holding text alone, and refuses one holding elements.',
        'Every byte outside the element stays as it was.',
        '',
      ].join('\n'),
    )
    .action(
      async (
        target: string,
        opts: RootOptions & { element: string; set: string },
      ) => {
        const emitJson = opts.json ?? false
        const resolved = await resolveRoot(opts)
        if (!resolved.ok) {
          process.exitCode = refuse(resolved, emitJson)
          return
        }
        const { root } = resolved
        const [pageName, frameName, ...rest] = target.split('/')
        if (!pageName || !frameName || rest.length > 0) {
          process.exitCode = refuse(
            {
              ok: false,
              reason: 'invalid-name',
              detail: `${target} is not <page>/<frame>`,
            },
            emitJson,
          )
          return
        }
        const split = opts.set.indexOf('=')
        if (split <= 0) {
          process.exitCode = refuse(
            {
              ok: false,
              reason: 'invalid-edit',
              detail: `${opts.set} is not <property>=<value>`,
            },
            emitJson,
          )
          return
        }
        const property = opts.set.slice(0, split).trim()
        const value = opts.set.slice(split + 1)
        const index =
          opts.element.trim() === '' ? Number.NaN : Number(opts.element)
        const outcome = editFrameAtIndex(root, pageName, frameName, index, {
          property,
          value,
        })
        if (!outcome.ok) {
          process.exitCode = refuse(outcome, emitJson)
          return
        }
        const path = resolve(canvasDir(root), outcome.page, outcome.file)
        if (emitJson) writeJson({ ...outcome, property, value, path })
        intro(BANNER)
        logAdd(`${outcome.page}/${outcome.file}`)
        logInfo(
          `element ${index}: ${property} ${value === '' ? 'dropped' : `= ${value}`}`,
        )
        outro()
      },
    )

  withRoot(
    canvas
      .command('editing')
      .description('Mark a frame as being edited, clear it, or list the marks')
      .argument('[target]', '<page>/<frame>, or none to list the marks')
      .option('--done', 'Clear the mark once the edits are written')
      .option('--by <name>', 'The label the mark shows, over the session name'),
  )
    .addHelpText(
      'after',
      [
        '',
        'Mark a frame before writing it and clear it with --done after, so an',
        `open canvas shows who is editing it. A mark lapses after ${EDITING_TTL_MS / 60_000} minutes`,
        'unless marked again, so re-mark during a long edit. A mark gates no',
        'write, and --done on a frame holding no mark succeeds.',
        '',
      ].join('\n'),
    )
    .action(
      async (
        target: string | undefined,
        opts: RootOptions & { done?: boolean; by?: string },
      ) => {
        const emitJson = opts.json ?? false
        const resolved = await resolveRoot(opts)
        if (!resolved.ok) {
          process.exitCode = refuse(resolved, emitJson)
          return
        }
        const { root } = resolved
        const now = new Date()

        if (target !== undefined) {
          const [pageName, frameName, ...rest] = target.split('/')
          if (!pageName || !frameName || rest.length > 0) {
            process.exitCode = refuse(
              {
                ok: false,
                reason: 'invalid-name',
                detail: `${target} is not <page>/<frame>`,
              },
              emitJson,
            )
            return
          }
          const outcome = opts.done
            ? clearEditing(root, pageName, frameName)
            : markEditing(
                root,
                pageName,
                frameName,
                opts.by ?? (await sessionLabel()),
                now,
              )
          if (!outcome.ok) {
            process.exitCode = refuse(outcome, emitJson)
            return
          }
        } else if (opts.done) {
          process.exitCode = refuse(
            {
              ok: false,
              reason: 'invalid-name',
              detail: '--done needs the <page>/<frame> to clear',
            },
            emitJson,
          )
          return
        }

        const marks = readEditing(root, now)
        if (emitJson) writeJson({ ok: true, editing: marks })
        intro(BANNER)
        if (target !== undefined) {
          logStep(`${target} ${opts.done ? 'cleared' : 'marked'}`)
        }
        if (marks.length === 0) logInfo('No frame is marked as being edited')
        for (const mark of marks) {
          logInfo(`${mark.page}/${mark.frame}  ${mark.by} until ${mark.until}`)
        }
        outro()
      },
    )

  withRoot(
    canvas
      .command('capture')
      .description('Capture a frame, or every frame of a page, as a PNG')
      .argument('<target>', '<page>/<frame> for one frame, <page> for all')
      .option(
        '-o, --out <path>',
        'The PNG for a frame, or the folder for a page; defaults to session scratch',
      )
      .option(
        '--composite',
        'Capture a page as one PNG with every frame at its layout position; --out is then the PNG',
      ),
  )
    .addHelpText(
      'after',
      [
        '',
        'Serves the canvas for the call and captures through that address, so',
        'the injected tokens are in the PNG and each frame renders at its own',
        'width. The raw file on disk is never captured.',
        '',
        'With --composite, each frame is clipped to its box as on the board and',
        'shows in its default theme, with no captions or selection outline.',
        '',
        'Exit codes:',
        '  0  every frame rendered',
        '  1  refused or a frame failed, with the reason on stderr or in the JSON record',
        '',
      ].join('\n'),
    )
    .action(async (target: string, opts: CaptureOptions) => {
      const resolved = await resolveRoot(opts)
      if (!resolved.ok) {
        process.exitCode = refuse(resolved, opts.json ?? false)
        return
      }
      if (opts.composite) {
        process.exitCode = await runComposite(resolved.root, target, opts)
        return
      }
      let outcome: Awaited<ReturnType<typeof captureCanvas>>
      try {
        outcome = await captureCanvas(
          resolved.root,
          target,
          opts.out ? resolve(process.cwd(), opts.out) : undefined,
        )
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        process.exitCode = refuse(
          { ok: false, reason: 'capture-failed', detail },
          opts.json ?? false,
        )
        return
      }
      if (!outcome.ok) {
        process.exitCode = refuse(outcome, opts.json ?? false)
        return
      }

      const rows = outcome.captures.map(({ target: item, result }) =>
        result.status === 'rendered'
          ? {
              page: item.page,
              frame: item.frame,
              status: result.status,
              path: result.pngPath,
              width: result.width,
              height: result.height,
            }
          : {
              page: item.page,
              frame: item.frame,
              status: result.status,
              reason: result.reason,
            },
      )
      const failed = rows.some((row) => row.status === 'failed')
      if (opts.json) writeJson({ ok: !failed, captures: rows })
      intro(BANNER)
      for (const row of rows) {
        if (row.status === 'rendered') {
          logAdd(`${row.page}/${row.frame}`)
          logInfo(`${displayPath(row.path)} ${row.width}x${row.height}`)
        } else {
          logError(`${row.page}/${row.frame}: ${row.reason}`)
        }
      }
      outro()
      if (failed) process.exitCode = 1
    })
}

interface CaptureOptions extends RootOptions {
  readonly out?: string
  readonly composite?: boolean
}

async function runComposite(
  root: string,
  target: string,
  opts: CaptureOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  let outcome: Awaited<ReturnType<typeof captureComposite>>
  try {
    outcome = await captureComposite(
      root,
      target,
      opts.out ? resolve(process.cwd(), opts.out) : undefined,
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return refuse({ ok: false, reason: 'capture-failed', detail }, emitJson)
  }
  if (!outcome.ok) return refuse(outcome, emitJson)

  const { target: item, result } = outcome.composite
  if (result.status === 'failed') {
    if (emitJson) {
      writeJson({
        ok: false,
        composite: {
          page: item.page,
          status: result.status,
          reason: result.reason,
        },
      })
    }
    intro(BANNER)
    logError(`${item.page}: ${result.reason}`)
    outro()
    return 1
  }

  if (emitJson) {
    writeJson({
      ok: true,
      composite: {
        page: item.page,
        status: result.status,
        path: result.pngPath,
        width: result.width,
        height: result.height,
      },
    })
  }
  intro(BANNER)
  logAdd(
    `${item.page} composite of ${plural(item.composite.placements.length, 'frame')}`,
  )
  logInfo(`${displayPath(result.pngPath)} ${result.width}x${result.height}`)
  outro()
  return 0
}

/** NaN for a value that is not a number, which the content module refuses. */
/**
 * The caller's roster name, or a generic label when the environment names no
 * session or the roster holds no row for it, as in a sandbox or a CI run.
 */
async function unlocated(): Promise<Located> {
  return {
    repository: null,
    worktree: null,
    branch: null,
    unresolved: 'git-unavailable',
  }
}

async function sessionLabel(): Promise<string> {
  const identity = callerIdentity()
  if (identity.sessionId === null && identity.pid === null) return 'a session'
  /* The label needs the name alone, so skip the git probe each row's branch costs. */
  const report = await resolveSessions({ locate: unlocated })
  if (report.kind === 'absent') return 'a session'
  const self = selfOf(report.sessions, identity)
  return self.kind === 'self' ? self.session.name : 'a session'
}

function parsePosition(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  return raw.trim() === '' ? Number.NaN : Number(raw)
}

async function runServe(
  opts: RootOptions & { port?: string },
): Promise<number> {
  const emitJson = opts.json ?? false
  const port = opts.port === undefined ? CANVAS_PORT : parsePort(opts.port)
  if (port === undefined) {
    return refuseServe('no-port', `${opts.port} is not a port`, emitJson)
  }

  const resolved = await resolveRoot(opts)
  if (!resolved.ok) {
    return refuseServe(resolved.reason, resolved.detail, emitJson)
  }
  const { root } = resolved
  const missing = missingClientDeps(PROJECT_ROOT)
  if (missing) return refuseServe(missing.reason, missing.detail, emitJson)
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
