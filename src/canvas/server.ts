import { type FSWatcher, mkdirSync, watch } from 'node:fs'
import {
  type ContentRefused,
  canvasDir,
  listPages,
  LOCK_SUFFIX,
  moveFrame,
  readSelection,
  TEMP_SUFFIX,
  writeSelection,
} from '@/canvas/content'
import { resolveFrameTokens, type TokenOptions } from '@/canvas/tokens'
import { buildDesignCss } from '@/design/css'
import {
  bindFirstFree,
  PORT_ATTEMPTS,
  respond,
  SERVE_HOST,
  type ServeRefusal,
} from '@/serve/static'

/** Clear of `canon serve`'s default, so a lesson preview and the canvas both open. */
export const CANVAS_PORT = 8790

/** The URL prefix a frame and the files beside it are served under. */
export const FRAMES_PREFIX = '/frames/'

/**
 * How long a burst of watch events for one file waits before it is sent. One
 * editor save raises several, and each would otherwise reload the frame again.
 */
const SETTLE_MS = 40

export interface CanvasStarted {
  readonly ok: true
  readonly root: string
  readonly content: string
  readonly host: string
  readonly port: number
  readonly url: string
  readonly stop: () => Promise<void>
}

export interface CanvasRefused {
  readonly ok: false
  readonly reason: Extract<ServeRefusal, 'no-port' | 'bind-failed'>
  readonly detail: string
}

export type CanvasOutcome = CanvasStarted | CanvasRefused

export interface CanvasOptions {
  readonly port?: number
  /**
   * What answers `/`. The command passes the HTML import of `index.html`, which
   * `Bun.serve` bundles on request, and a test passes a plain response, since
   * the test runner cannot load an HTML module.
   */
  readonly shell: Bun.HTMLBundle | Response
  readonly tokens?: TokenOptions
}

export interface ChangeEvent {
  readonly page: string
  /**
   * The path under the page folder, or empty when the change is to the
   * top-level entry itself, being a page folder added, renamed, or removed.
   * An empty file names no frame, so a reader rereads the page list alone.
   */
  readonly file: string
}

/** Escapes the one sequence that would end the injected element early. */
function styleElement(css: string): string {
  return `<style data-canvas-tokens>${css.replaceAll('</style', '<\\/style')}</style>`
}

/**
 * Puts the tokens first in the head, so a stylesheet the frame links itself
 * still wins the cascade. A frame with no head gets the element ahead of
 * everything, which a browser hoists into the head it builds.
 */
export function injectTokens(html: string, css: string): string {
  if (css === '') return html
  const element = styleElement(css)
  const head = html.match(/<head(?:\s[^>]*)?>/i)
  if (head?.index === undefined) return `${element}${html}`
  const at = head.index + head[0].length
  return `${html.slice(0, at)}${element}${html.slice(at)}`
}

/**
 * Whether a request names this server by a loopback name and its own port.
 * The bind keeps other machines out, and this keeps out a page the operator
 * visits whose domain was rebound to 127.0.0.1, which reaches the socket with
 * its own name in the Host header.
 */
export function isLoopbackHost(host: string | null, port: number): boolean {
  return host === `${SERVE_HOST}:${port}` || host === `localhost:${port}`
}

type Handler = (
  request: Request,
  server: Bun.Server<undefined>,
) => Response | Promise<Response>

function guarded(handler: Handler): Handler {
  return (request, server) =>
    isLoopbackHost(request.headers.get('host'), server.port ?? 0)
      ? handler(request, server)
      : new Response('Forbidden\n', {
          status: 403,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

const REFUSAL_STATUS: Record<ContentRefused['reason'], number> = {
  'invalid-name': 400,
  'invalid-size': 400,
  'invalid-position': 400,
  'no-page': 404,
  'no-frame': 404,
  exists: 409,
  'malformed-layout': 409,
  busy: 409,
}

function refusal(refused: ContentRefused): Response {
  return json(refused, REFUSAL_STATUS[refused.reason])
}

function badBody(detail: string): Response {
  return json({ ok: false, reason: 'invalid-body', detail }, 400)
}

/**
 * The Host guard cannot tell the shell from a page on another origin that
 * reaches this socket, since a browser sends the loopback Host either way. A
 * write also carries an Origin when a page sent it, so one naming any other
 * origin is refused, and a JSON content type forces that page through a
 * preflight this server never answers.
 */
function mutation(handler: (body: unknown) => Response): Handler {
  return async (request, server) => {
    const origin = request.headers.get('origin')
    if (origin !== null && !isLoopbackOrigin(origin, server.port ?? 0)) {
      return new Response('Forbidden\n', { status: 403 })
    }
    const type = request.headers.get('content-type') ?? ''
    if (!type.startsWith('application/json')) {
      return json(
        { ok: false, reason: 'invalid-body', detail: 'send application/json' },
        415,
      )
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badBody('the body is not JSON')
    }
    return handler(body)
  }
}

function isLoopbackOrigin(origin: string, port: number): boolean {
  return (
    origin === `http://${SERVE_HOST}:${port}` ||
    origin === `http://localhost:${port}`
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function serveFrame(
  root: string,
  content: string,
  request: Request,
  tokens: TokenOptions,
): Promise<Response> {
  const url = new URL(request.url)
  url.pathname = `/${url.pathname.slice(FRAMES_PREFIX.length)}`
  const file = await respond(content, new Request(url))

  const type = file.headers.get('content-type') ?? ''
  if (file.status !== 200 || !type.startsWith('text/html')) return file

  const { css } = resolveFrameTokens(root, tokens)
  return new Response(injectTokens(await file.text(), css), {
    headers: { 'content-type': type, 'cache-control': 'no-store' },
  })
}

/**
 * Fans each change under the canvas folder out to every open shell. The first
 * segment names the page and the rest names the file within it, so a
 * top-level entry goes out with an empty file. Only an empty path is skipped.
 */
class ChangeStream {
  private readonly clients = new Set<ReadableStreamDefaultController<string>>()
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly watcher: FSWatcher

  constructor(content: string) {
    this.watcher = watch(content, { recursive: true }, (_event, filename) => {
      if (filename) this.queue(filename.toString())
    })
  }

  /**
   * A one-segment path is kept because the recursive watch reports a page
   * folder appearing, going, or being renamed under its bare name with nothing
   * beneath it. A stray file beside the pages goes out the same way, which
   * costs the shell one page-list reread.
   */
  private queue(path: string): void {
    const [page, ...rest] = path.split(/[\\/]/)
    if (page === undefined || page === '') return
    /* A write's staging or lock file, gone a moment later. */
    if (path.endsWith(TEMP_SUFFIX) || path.endsWith(LOCK_SUFFIX)) return
    clearTimeout(this.pending.get(path))
    this.pending.set(
      path,
      setTimeout(() => {
        this.pending.delete(path)
        this.send({ page, file: rest.join('/') })
      }, SETTLE_MS),
    )
  }

  private send(change: ChangeEvent): void {
    const frame = `data: ${JSON.stringify(change)}\n\n`
    for (const client of this.clients) client.enqueue(frame)
  }

  open(): Response {
    let self: ReadableStreamDefaultController<string> | undefined
    const stream = new ReadableStream<string>({
      start: (controller) => {
        self = controller
        this.clients.add(controller)
        controller.enqueue(': open\n\n')
      },
      cancel: () => {
        if (self) this.clients.delete(self)
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
      },
    })
  }

  close(): void {
    this.watcher.close()
    for (const timer of this.pending.values()) clearTimeout(timer)
    for (const client of this.clients) {
      try {
        client.close()
      } catch {
        /* Already closed by the browser going away. */
      }
    }
    this.clients.clear()
  }
}

export function startCanvas(
  root: string,
  options: CanvasOptions,
): CanvasOutcome {
  const content = canvasDir(root)
  /* Created up front, since the change stream has to watch something. */
  mkdirSync(content, { recursive: true })

  const tokens = options.tokens ?? {}
  /*
   * Fonts embedded, so the chrome renders in its own face on a machine that
   * never installed it rather than in whatever the fallback stack finds.
   */
  const chromeCss = buildDesignCss(undefined, {
    components: false,
    embedFonts: true,
  })
  const changes = new ChangeStream(content)
  const first = options.port ?? CANVAS_PORT

  let bound: ReturnType<typeof bindFirstFree>
  try {
    bound = bindFirstFree(first, (port) =>
      Bun.serve({
        hostname: SERVE_HOST,
        port,
        development: false,
        /* The change stream stays open for as long as the shell does. */
        idleTimeout: 0,
        routes: {
          /*
           * The shell and the chunks it bundles carry toolkit code and no
           * project content, so they are the one route left unguarded.
           */
          '/': options.shell,
          '/api/pages': guarded(() => {
            const resolved = resolveFrameTokens(root, tokens)
            const { css: _css, ...source } = resolved
            const selected = readSelection(root)
            return json({
              pages: listPages(root),
              tokens: source,
              selection: selected && {
                page: selected.page,
                frame: selected.frame,
              },
            })
          }),
          '/api/frames/move': {
            POST: guarded(
              mutation((body) => {
                if (
                  !isRecord(body) ||
                  typeof body.page !== 'string' ||
                  typeof body.frame !== 'string' ||
                  typeof body.x !== 'number' ||
                  typeof body.y !== 'number'
                ) {
                  return badBody('send page, frame, x, and y')
                }
                const outcome = moveFrame(root, body.page, body.frame, {
                  x: body.x,
                  y: body.y,
                })
                return outcome.ok ? json(outcome) : refusal(outcome)
              }),
            ),
          },
          '/api/selection': {
            POST: guarded(
              mutation((body) => {
                if (!isRecord(body)) return badBody('send a frame or {}')
                const { page, frame } = body
                const target =
                  typeof page === 'string' && typeof frame === 'string'
                    ? { page, frame }
                    : undefined
                if (target === undefined && (page != null || frame != null)) {
                  return badBody('send both page and frame, or neither')
                }
                const outcome = writeSelection(root, target)
                return outcome.ok ? json(outcome) : refusal(outcome)
              }),
            ),
          },
          '/api/chrome.css': guarded(
            () =>
              new Response(chromeCss, {
                headers: {
                  'content-type': 'text/css; charset=utf-8',
                  'cache-control': 'no-store',
                },
              }),
          ),
          '/api/events': guarded(() => changes.open()),
        },
        fetch: guarded((request) => {
          const { pathname } = new URL(request.url)
          if (pathname.startsWith(FRAMES_PREFIX)) {
            return serveFrame(root, content, request, tokens)
          }
          return new Response('Not found\n', { status: 404 })
        }),
      }),
    )
  } catch (error) {
    changes.close()
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown'
    return {
      ok: false,
      reason: 'bind-failed',
      detail: `could not bind ${SERVE_HOST}:${first} (${code})`,
    }
  }

  if (!bound) {
    changes.close()
    return {
      ok: false,
      reason: 'no-port',
      detail: `no free port between ${first} and ${first + PORT_ATTEMPTS - 1}`,
    }
  }

  const { server, port } = bound
  return {
    ok: true,
    root,
    content,
    host: SERVE_HOST,
    port,
    url: `http://${SERVE_HOST}:${port}/`,
    stop: async () => {
      changes.close()
      await server.stop(true)
    },
  }
}
