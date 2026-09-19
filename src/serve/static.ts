import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

/**
 * The loopback interface, never a wildcard bind. A preview serves whatever
 * directory it is pointed at, and the folders this exists for are the
 * gitignored record trees, so reaching the network is the one thing it must
 * not do.
 */
export const SERVE_HOST = '127.0.0.1'

/** Tried first, then the next ports in order, so a second preview still opens. */
export const DEFAULT_PORT = 8787

/** How far past the requested port to look before refusing. */
const PORT_ATTEMPTS = 20

const DEFAULT_ENTRY = 'index.html'

/**
 * Extensions a browser has to be told about. Anything absent is served as an
 * octet stream, which downloads rather than renders, and that is the safe
 * direction for a type this map does not claim to know.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  css: 'text/css; charset=utf-8',
  gif: 'image/gif',
  htm: 'text/html; charset=utf-8',
  html: 'text/html; charset=utf-8',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  /**
   * Plain text rather than `text/markdown`, which a browser offers to save
   * instead of showing. A reader following a link to a source page wants to
   * read it, and the rendered sibling is a separate file.
   */
  md: 'text/plain; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

export type ServeRefusal =
  | 'no-root'
  | 'not-a-directory'
  | 'no-port'
  | 'no-entry'
  | 'bind-failed'

export interface ServeRefused {
  readonly ok: false
  readonly reason: ServeRefusal
  readonly detail: string
}

export interface ServeStarted {
  readonly ok: true
  /** Absolute, so a report names the directory rather than the caller's cwd. */
  readonly root: string
  readonly host: string
  readonly port: number
  /** The entry page relative to the root, as the URL spells it. */
  readonly entry: string
  /** What a reader clicks. Complete, including the entry page. */
  readonly url: string
  /** Whether the entry page exists. A missing one is reported, never fatal. */
  readonly entryExists: boolean
  readonly stop: () => Promise<void>
}

export type ServeOutcome = ServeStarted | ServeRefused

export interface ServeOptions {
  readonly port?: number
  readonly entry?: string
  /** Answers a directory request with no index page by listing it. Off by default. */
  readonly index?: boolean
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

interface ListingEntry {
  readonly name: string
  readonly isDirectory: boolean
}

/**
 * Reads the entries a listing may name. Each one takes the same containment
 * test a request for it would, since a listed name is itself a fact about a
 * place outside the root. Dotfiles are hidden because a listing is for
 * navigating pages, and a hidden file is still reachable by its URL.
 */
function listEntries(root: string, directory: string): ListingEntry[] {
  return readdirSync(directory)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => !escapesThroughLink(root, join(directory, name)))
    .map((name) => ({
      name,
      isDirectory:
        statSync(join(directory, name), {
          throwIfNoEntry: false,
        })?.isDirectory() ?? false,
    }))
    .sort(
      (a, b) =>
        Number(b.isDirectory) - Number(a.isDirectory) ||
        a.name.localeCompare(b.name),
    )
}

function renderListing(
  pathname: string,
  entries: readonly ListingEntry[],
  hasParent: boolean,
): string {
  const rows = entries.map(({ name, isDirectory }) => {
    const label = isDirectory ? `${name}/` : name
    return `<li><a href="${escapeHtml(encodeURIComponent(name))}${isDirectory ? '/' : ''}">${escapeHtml(label)}</a></li>`
  })
  if (hasParent) rows.unshift('<li><a href="../">../</a></li>')
  return `<!doctype html>
<meta charset="utf-8">
<title>Index of ${escapeHtml(pathname)}</title>
<h1>Index of ${escapeHtml(pathname)}</h1>
<ul>
${rows.join('\n')}
</ul>
`
}

function refuse(reason: ServeRefusal, detail: string): ServeRefused {
  return { ok: false, reason, detail }
}

function contentType(path: string): string {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return 'application/octet-stream'
  const ext = path.slice(dot + 1).toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

/**
 * Resolves a request path inside the root, or returns undefined when it escapes.
 * The containment test compares resolved absolute paths rather than inspecting
 * the request for `..`, because an encoded traversal survives a textual scan and
 * does not survive resolution.
 */
export function resolveWithin(
  root: string,
  requestPath: string,
): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(requestPath)
  } catch {
    return undefined
  }
  /**
   * A NUL truncates the path at the filesystem layer, so a request carrying one
   * asks for a different file than the one the containment test read.
   */
  if (decoded.includes('\0')) return undefined

  const relativePath = decoded.replace(/^\/+/, '')
  const target = resolve(root, relativePath)
  if (target !== root && !target.startsWith(root + sep)) return undefined
  return target
}

/**
 * Re-tests containment after following symlinks. `resolveWithin` is lexical
 * and `resolve` does not follow a link, so a link inside the root clears that
 * test while the file it points at sits outside. This repository is a live
 * instance, since `claude/standards` and `claude/snippets` are links out of
 * `claude/`.
 *
 * Only a path that exists is checked, because a link can be followed only once
 * there is something on the other end, and a path that resolves to nothing is
 * a 404 rather than an escape.
 */
function escapesThroughLink(root: string, target: string): boolean {
  if (!existsSync(target)) return false
  try {
    const realRoot = realpathSync(root)
    const realTarget = realpathSync(target)
    return realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)
  } catch {
    /* Unreadable resolves to no answer, and no answer is refused. */
    return true
  }
}

/**
 * Whether a bind failure is contention worth trying the next port for.
 *
 * Lifted out of the loop so the decision is testable. Manufacturing a real
 * non-contention bind failure needs a privileged port or an unavailable
 * interface and neither travels between machines, where an error value does,
 * so this is unit-tested and the bind itself is not.
 */
export function shouldWalkPast(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'EADDRINUSE'
}

/**
 * Picks a listening port, starting at the requested one and walking forward.
 * A busy port is the ordinary case rather than a failure, since a preview of
 * one workspace is routinely open while another is started.
 */
function listen(
  root: string,
  first: number,
  index: boolean,
): { server: ReturnType<typeof Bun.serve>; port: number } | undefined {
  for (let port = first; port < first + PORT_ATTEMPTS; port++) {
    try {
      const server = Bun.serve({
        hostname: SERVE_HOST,
        port,
        fetch: (request) => respond(root, request, index),
      })
      /**
       * The bound port rather than the requested one. Port 0 asks the OS to
       * choose, so reporting the request builds a URL pointing at nothing.
       * The type admits undefined for a unix socket, which a bind carrying a
       * hostname and a port never is, and the request is the honest fallback.
       */
      return { server, port: server.port ?? port }
    } catch (error) {
      /**
       * Contention is the one cause worth walking past. A permission failure
       * or an unavailable interface swallowed here would be retried twenty
       * times and then reported as a port range being full, which names a
       * cause nothing checked. `startServer` turns the rethrow into a refusal.
       */
      if (!shouldWalkPast(error)) throw error
    }
  }
  return undefined
}

export async function respond(
  root: string,
  request: Request,
  index = false,
): Promise<Response> {
  const { pathname, search } = new URL(request.url)
  const forbidden = () =>
    new Response('Forbidden\n', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })

  const target = resolveWithin(root, pathname)
  if (!target) return forbidden()

  /**
   * Tested here as well as before the read, because the redirect below answers
   * ahead of that one. A redirect firing on an out-of-root directory reports
   * that it exists, where one that does not answers 404, and the pair is a
   * fact about the filesystem outside the root.
   */
  if (escapesThroughLink(root, target)) return forbidden()

  let path = target
  if (existsSync(path) && statSync(path).isDirectory()) {
    /**
     * A browser resolves a relative asset against the last slash of the URL it
     * is on, so answering a directory in place leaves `/lesson` asking for
     * `/course.css` rather than `/lesson/course.css` and the page renders
     * unstyled. The redirect moves the base before the index is served.
     */
    if (!pathname.endsWith('/')) {
      return new Response(null, {
        status: 301,
        headers: { location: `${pathname}/${search}` },
      })
    }
    const indexPage = join(path, DEFAULT_ENTRY)
    if (index && !existsSync(indexPage)) {
      return new Response(
        renderListing(pathname, listEntries(root, path), path !== root),
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          },
        },
      )
    }
    path = indexPage
  }

  /**
   * Sits immediately before the read rather than beside the path that produced
   * it, so every path reaching `Bun.file` has been tested whatever produced
   * it. Checking the request path alone left the appended index untested, and
   * a real directory holding a linked index was served.
   */
  if (escapesThroughLink(root, path)) return forbidden()

  const file = Bun.file(path)
  if (!(await file.exists())) {
    return new Response(`Not found: ${pathname}\n`, {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(file, {
    headers: {
      'content-type': contentType(path),
      /**
       * A preview is edited and reloaded continuously, and a cached stylesheet
       * reads as a fix that did not work. Revalidation is the whole point of
       * the surface, so it is not negotiable per response.
       */
      'cache-control': 'no-store',
    },
  })
}

export function startServer(
  dir: string,
  options: ServeOptions = {},
): ServeOutcome {
  const root = resolve(process.cwd(), dir)
  if (!existsSync(root)) return refuse('no-root', `${dir} does not exist`)
  if (!statSync(root).isDirectory())
    return refuse('not-a-directory', `${dir} is not a directory`)

  const entry = (options.entry ?? DEFAULT_ENTRY).replace(/^\/+/, '')

  /**
   * Checked before a port is taken, since `url` is the field a caller is told
   * to read and hand to a reader. An entry the containment test rejects would
   * otherwise be reported as a link the server then refuses. An entry that is
   * merely absent is not this case and does not refuse, which `entryExists`
   * reports instead.
   */
  const entryPath = resolveWithin(root, entry)
  if (!entryPath) return refuse('no-entry', `${entry} escapes ${dir}`)

  const first = options.port ?? DEFAULT_PORT

  /**
   * A bind failure that is not contention reaches here as a throw, and the
   * command's own help promises a reason on stderr or in the record. A stack
   * trace is neither, so it is caught and named.
   */
  let bound: ReturnType<typeof listen>
  try {
    bound = listen(root, first, options.index ?? false)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown'
    return refuse(
      'bind-failed',
      `could not bind ${SERVE_HOST}:${first} (${code})`,
    )
  }

  if (!bound) {
    return refuse(
      'no-port',
      `no free port between ${first} and ${first + PORT_ATTEMPTS - 1}`,
    )
  }

  /**
   * A listing answers `/` where no index page exists, so under the flag the
   * default entry is the root itself. An explicit `--entry` keeps its own link
   * and its own warning.
   */
  const listsRoot =
    (options.index ?? false) &&
    options.entry === undefined &&
    !existsSync(entryPath)

  return {
    ok: true,
    root,
    host: SERVE_HOST,
    port: bound.port,
    entry,
    url: `http://${SERVE_HOST}:${bound.port}/${listsRoot ? '' : entry}`,
    entryExists: listsRoot || existsSync(entryPath),
    stop: async () => {
      await bound.server.stop(true)
    },
  }
}
