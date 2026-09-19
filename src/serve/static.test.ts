import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PORT,
  resolveWithin,
  SERVE_HOST,
  type ServeStarted,
  shouldWalkPast,
  startServer,
} from '@/serve/static'

let ROOT: string
const running: ServeStarted[] = []

function seed(relativePath: string, body: string): string {
  const full = join(ROOT, relativePath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, body)
  return full
}

/**
 * Sends a request line verbatim and reports the status. `fetch` resolves `..`
 * and decodes `%2e%2e` before the request leaves, so a traversal sent through
 * it arrives already collapsed and tests the client rather than the server.
 */
function rawRequest(port: number, path: string): Promise<number> {
  return new Promise((settle, fail) => {
    const socket = connect(port, SERVE_HOST, () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\nHost: ${SERVE_HOST}\r\nConnection: close\r\n\r\n`,
      )
    })
    let received = ''
    socket.on('data', (chunk) => {
      received += chunk.toString()
    })
    socket.on('error', fail)
    socket.on('close', () => {
      const status = received.match(/^HTTP\/1\.[01] (\d{3})/)
      if (!status) {
        fail(new Error(`no status line in response: ${received.slice(0, 80)}`))
        return
      }
      settle(Number(status[1]))
    })
  })
}

/** Starts a server and registers it for teardown, so no test leaks a port. */
function start(
  dir: string,
  options?: { port?: number; entry?: string; index?: boolean },
): ServeStarted {
  const outcome = startServer(dir, options)
  if (!outcome.ok)
    throw new Error(`expected a started server, got ${outcome.reason}`)
  running.push(outcome)
  return outcome
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-serve-'))
})

afterEach(async () => {
  await Promise.all(running.splice(0).map((server) => server.stop()))
  rmSync(ROOT, { recursive: true, force: true })
})

describe('resolveWithin', () => {
  it('should resolve a path inside the root', () => {
    const resolved = resolveWithin('/srv/site', '/assets/course.css')

    expect(resolved).toBe('/srv/site/assets/course.css')
  })

  it('should refuse a path that climbs out of the root', () => {
    const resolved = resolveWithin('/srv/site', '/../../etc/passwd')

    expect(resolved).toBeUndefined()
  })

  it('should refuse a traversal hidden by percent encoding', () => {
    const resolved = resolveWithin('/srv/site', '/%2e%2e/%2e%2e/etc/passwd')

    expect(resolved).toBeUndefined()
  })

  it('should refuse a path carrying a NUL byte', () => {
    const resolved = resolveWithin('/srv/site', '/index.html%00.png')

    expect(resolved).toBeUndefined()
  })

  it('should refuse a sibling directory sharing the root prefix', () => {
    const resolved = resolveWithin('/srv/site', '/../site-private/secret.txt')

    expect(resolved).toBeUndefined()
  })
})

/**
 * The classification is unit-tested and the bind is not. Manufacturing a real
 * non-contention bind failure needs a privileged port or an unavailable
 * interface, neither of which travels between machines, where an error value
 * does. That split is the honest boundary rather than a gap.
 */
describe('shouldWalkPast', () => {
  it('should walk past a port already in use', () => {
    const error = Object.assign(new Error('in use'), { code: 'EADDRINUSE' })

    expect(shouldWalkPast(error)).toBe(true)
  })

  it('should not walk past a permission failure', () => {
    const error = Object.assign(new Error('denied'), { code: 'EACCES' })

    expect(shouldWalkPast(error)).toBe(false)
  })

  it('should not walk past an error carrying no code', () => {
    expect(shouldWalkPast(new Error('unexplained'))).toBe(false)
  })
})

describe('startServer', () => {
  it('should refuse a directory that does not exist', () => {
    const outcome = startServer(join(ROOT, 'absent'))

    expect(outcome).toMatchObject({ ok: false, reason: 'no-root' })
  })

  it('should refuse a path that is a file', () => {
    seed('page.html', '<h1>page</h1>')

    const outcome = startServer(join(ROOT, 'page.html'))

    expect(outcome).toMatchObject({ ok: false, reason: 'not-a-directory' })
  })

  it('should report a url carrying the entry page', () => {
    seed('index.html', '<h1>root</h1>')

    const server = start(ROOT, { port: 0 })

    expect(server.url).toBe(`http://${SERVE_HOST}:${server.port}/index.html`)
  })

  it('should report an absent entry page without refusing', () => {
    seed('other.html', '<h1>other</h1>')

    const server = start(ROOT, { port: 0 })

    expect(server.entryExists).toBe(false)
  })

  it('should serve a file from the root', async () => {
    seed('index.html', '<h1>root</h1>')
    const server = start(ROOT, { port: 0 })

    const body = await fetch(server.url).then((r) => r.text())

    expect(body).toBe('<h1>root</h1>')
  })

  it('should serve a nested asset', async () => {
    seed('assets/course.css', 'body { color: red }')
    const server = start(ROOT, { port: 0 })

    const body = await fetch(
      `http://${SERVE_HOST}:${server.port}/assets/course.css`,
    ).then((r) => r.text())

    expect(body).toBe('body { color: red }')
  })

  it('should type a stylesheet so a browser applies it', async () => {
    seed('assets/course.css', 'body { color: red }')
    const server = start(ROOT, { port: 0 })

    const response = await fetch(
      `http://${SERVE_HOST}:${server.port}/assets/course.css`,
    )

    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8')
  })

  it('should serve markdown as text so a browser shows it rather than saving it', async () => {
    seed('reference/page.md', '# Heading')
    const server = start(ROOT, { port: 0 })

    const response = await fetch(
      `http://${SERVE_HOST}:${server.port}/reference/page.md`,
    )

    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    )
  })

  it('should forbid caching so an edited stylesheet is not served stale', async () => {
    seed('index.html', '<h1>root</h1>')
    const server = start(ROOT, { port: 0 })

    const response = await fetch(server.url)

    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('should serve the index of a directory request', async () => {
    seed('workspace/index.html', '<h1>workspace</h1>')
    const server = start(ROOT, { port: 0 })

    const body = await fetch(
      `http://${SERVE_HOST}:${server.port}/workspace/`,
    ).then((r) => r.text())

    expect(body).toBe('<h1>workspace</h1>')
  })

  it('should redirect a directory request to its trailing-slash form', async () => {
    seed('workspace/index.html', '<h1>workspace</h1>')
    const server = start(ROOT, { port: 0 })

    const response = await fetch(
      `http://${SERVE_HOST}:${server.port}/workspace`,
      { redirect: 'manual' },
    )

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('/workspace/')
  })

  /**
   * The outcome the redirect exists for. Serving the index at the directory
   * URL leaves the browser resolving `course.css` against the parent, so the
   * page renders unstyled, which is the failure this whole verb exists to
   * close.
   */
  it('should land a directory request on the url a relative asset resolves against', async () => {
    seed('workspace/index.html', '<h1>workspace</h1>')
    seed('workspace/course.css', 'body { color: red }')
    const server = start(ROOT, { port: 0 })

    const response = await fetch(
      `http://${SERVE_HOST}:${server.port}/workspace`,
    )

    expect(response.url).toBe(`http://${SERVE_HOST}:${server.port}/workspace/`)
  })

  /**
   * `resolve` is lexical and does not follow links, so a containment test
   * built on it clears a path that `Bun.file` then reads straight out of the
   * root. This repository is a live instance, since `claude/standards` and
   * `claude/snippets` are symlinks out of `claude/`.
   */
  it('should refuse a file reached through a symlink out of the root', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'canon-serve-outside-'))
    writeFileSync(join(outside, 'private.txt'), 'secret')
    symlinkSync(outside, join(ROOT, 'escape'), 'dir')
    const server = start(ROOT, { port: 0 })

    const status = await fetch(
      `http://${SERVE_HOST}:${server.port}/escape/private.txt`,
    ).then((response) => response.status)
    rmSync(outside, { recursive: true, force: true })

    expect(status).toBe(403)
  })

  /**
   * The directory branch appends the index after the request path has been
   * checked, so a real directory holding a linked index reaches the read on a
   * path nothing tested. The check sits immediately before the read for this
   * reason, rather than beside the path that produced it.
   */
  it('should refuse a directory whose index is a symlink out of the root', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'canon-serve-outside-'))
    writeFileSync(join(outside, 'secret.html'), '<h1>outside</h1>')
    mkdirSync(join(ROOT, 'folder'), { recursive: true })
    symlinkSync(
      join(outside, 'secret.html'),
      join(ROOT, 'folder', 'index.html'),
    )
    const server = start(ROOT, { port: 0 })

    const status = await fetch(
      `http://${SERVE_HOST}:${server.port}/folder/`,
    ).then((response) => response.status)
    rmSync(outside, { recursive: true, force: true })

    expect(status).toBe(403)
  })

  /**
   * The redirect fires on a directory, so answering it before containment is
   * tested reports that an out-of-root directory exists. One that does not
   * answers 404, and the pair is a fact about the filesystem outside the root
   * that a reader there should not be able to read.
   */
  it('should refuse an out-of-root directory rather than redirecting to it', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'canon-serve-outside-'))
    mkdirSync(join(outside, 'pages'), { recursive: true })
    symlinkSync(join(outside, 'pages'), join(ROOT, 'escape'), 'dir')
    const server = start(ROOT, { port: 0 })

    const response = await fetch(`http://${SERVE_HOST}:${server.port}/escape`, {
      redirect: 'manual',
    })
    rmSync(outside, { recursive: true, force: true })

    expect(response.status).toBe(403)
  })

  it('should serve a symlink that stays inside the root', async () => {
    seed('assets/course.css', 'body { color: red }')
    symlinkSync(join(ROOT, 'assets'), join(ROOT, 'shared'), 'dir')
    const server = start(ROOT, { port: 0 })

    const status = await fetch(
      `http://${SERVE_HOST}:${server.port}/shared/course.css`,
    ).then((response) => response.status)

    expect(status).toBe(200)
  })

  it('should refuse an entry that escapes the root', () => {
    const outcome = startServer(ROOT, { entry: '../../etc/passwd', port: 0 })

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('no-entry')
  })

  it('should answer 404 for a file that is not there', async () => {
    seed('index.html', '<h1>root</h1>')
    const server = start(ROOT, { port: 0 })

    const response = await fetch(
      `http://${SERVE_HOST}:${server.port}/absent.html`,
    )

    expect(response.status).toBe(404)
  })

  /**
   * An encoded separator rather than an encoded dot. The URL parser resolves
   * `..` and `%2e%2e` into the path before a handler sees it, so neither
   * reaches the containment test and both answer 404 for want of a file. An
   * encoded slash survives parsing intact and decodes into a traversal inside
   * the handler, which is the one shape that reaches the guard.
   */
  it('should answer 403 for a traversal built from an encoded separator', async () => {
    seed('index.html', '<h1>root</h1>')
    const server = start(ROOT, { port: 0 })

    /* Assembled rather than written whole, so the encoded separator does not
       run into the next word and read as a misspelling to the spell check. */
    const climb = `/..${'%2f'}..${'%2f'}escape.txt`

    const status = await rawRequest(server.port, climb)

    expect(status).toBe(403)
  })

  it('should answer 403 for a path carrying a NUL byte', async () => {
    seed('index.html', '<h1>root</h1>')
    const server = start(ROOT, { port: 0 })

    const status = await rawRequest(server.port, '/index.html%00.png')

    expect(status).toBe(403)
  })

  it('should bind the loopback interface rather than every address', () => {
    seed('index.html', '<h1>root</h1>')

    const server = start(ROOT, { port: 0 })

    expect(server.host).toBe('127.0.0.1')
  })

  it('should walk past a port already in use', () => {
    seed('index.html', '<h1>root</h1>')
    const first = start(ROOT, { port: DEFAULT_PORT })

    const second = start(ROOT, { port: DEFAULT_PORT })

    // Greater than rather than exactly one above, because the walk skips every
    // occupied port and this machine runs parallel worktree sessions that hold
    // ports of their own. Pinning the offset asserts that nothing else was
    // listening, which is a fact about the machine rather than about the walk.
    expect(second.port).toBeGreaterThan(first.port)
  })
})

describe('startServer with index', () => {
  it('should list a directory that holds no index page', async () => {
    seed('a.html', '<h1>a</h1>')
    const server = start(ROOT, { port: 0, index: true })

    const response = await fetch(`http://${SERVE_HOST}:${server.port}/`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(body).toContain('href="a.html"')
  })

  it('should answer 404 for the same directory without the option', async () => {
    seed('a.html', '<h1>a</h1>')
    const server = start(ROOT, { port: 0 })

    const response = await fetch(`http://${SERVE_HOST}:${server.port}/`)

    expect(response.status).toBe(404)
  })

  it('should serve an existing index page ahead of the listing', async () => {
    seed('index.html', '<h1>root</h1>')
    seed('a.html', '<h1>a</h1>')
    const server = start(ROOT, { port: 0, index: true })

    const body = await fetch(`http://${SERVE_HOST}:${server.port}/`).then((r) =>
      r.text(),
    )

    expect(body).toBe('<h1>root</h1>')
  })

  it('should list directories before files, each alphabetical', async () => {
    seed('b.html', 'b')
    seed('a.html', 'a')
    seed('zed/x.html', 'x')
    seed('alpha/x.html', 'x')
    const server = start(ROOT, { port: 0, index: true })

    const body = await fetch(`http://${SERVE_HOST}:${server.port}/`).then((r) =>
      r.text(),
    )
    const order = ['alpha/', 'zed/', 'a.html', 'b.html'].map((name) =>
      body.indexOf(`href="${name}"`),
    )

    expect(order).toEqual([...order].sort((x, y) => x - y))
    expect(order.every((position) => position >= 0)).toBe(true)
  })

  it('should link the parent below the root and not at it', async () => {
    seed('sub/x.html', 'x')
    const server = start(ROOT, { port: 0, index: true })
    const base = `http://${SERVE_HOST}:${server.port}`

    const atRoot = await fetch(`${base}/`).then((r) => r.text())
    const inSub = await fetch(`${base}/sub/`).then((r) => r.text())

    expect(atRoot).not.toContain('href="../"')
    expect(inSub).toContain('href="../"')
  })

  it('should hide dotfiles from the listing', async () => {
    seed('.hidden.html', 'h')
    seed('shown.html', 's')
    const server = start(ROOT, { port: 0, index: true })

    const body = await fetch(`http://${SERVE_HOST}:${server.port}/`).then((r) =>
      r.text(),
    )

    expect(body).not.toContain('.hidden.html')
    expect(body).toContain('shown.html')
  })

  it('should omit an entry that escapes the root through a symlink', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'canon-serve-outside-'))
    writeFileSync(join(outside, 'secret.txt'), 'secret')
    symlinkSync(join(outside, 'secret.txt'), join(ROOT, 'leak.txt'))
    seed('kept.html', 'k')
    const server = start(ROOT, { port: 0, index: true })

    const body = await fetch(`http://${SERVE_HOST}:${server.port}/`).then((r) =>
      r.text(),
    )
    rmSync(outside, { recursive: true, force: true })

    expect(body).not.toContain('leak.txt')
    expect(body).toContain('kept.html')
  })

  it('should refuse a directory that is a symlink out of the root', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'canon-serve-outside-'))
    writeFileSync(join(outside, 'secret.txt'), 'secret')
    symlinkSync(outside, join(ROOT, 'out'))
    const server = start(ROOT, { port: 0, index: true })

    const response = await fetch(`http://${SERVE_HOST}:${server.port}/out/`)
    rmSync(outside, { recursive: true, force: true })

    expect(response.status).toBe(403)
  })

  it('should escape a name carrying markup and encode its href', async () => {
    seed('<img src=x onerror=alert(1)>.html', 'x')
    seed('a"b.html', 'x')
    const server = start(ROOT, { port: 0, index: true })

    const body = await fetch(`http://${SERVE_HOST}:${server.port}/`).then((r) =>
      r.text(),
    )

    expect(body).not.toContain('<img')
    expect(body).toContain('&lt;img')
    expect(body).toContain('href="a%22b.html"')
  })

  it('should report the root as the link when no index page exists', () => {
    seed('a.html', 'a')

    const server = start(ROOT, { port: 0, index: true })

    expect(server.url).toBe(`http://${SERVE_HOST}:${server.port}/`)
    expect(server.entryExists).toBe(true)
  })

  it('should still warn for an explicit entry that is absent', () => {
    seed('a.html', 'a')

    const server = start(ROOT, { port: 0, index: true, entry: 'gone.html' })

    expect(server.entryExists).toBe(false)
  })
})
