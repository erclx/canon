import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type CanvasStarted, startCanvas } from '@/canvas/server'
import { SERVE_HOST } from '@/serve/static'

let ROOT = ''
const running: CanvasStarted[] = []

const SHELL_MARKER = '<p>shell</p>'

function start(): CanvasStarted {
  const outcome = startCanvas(ROOT, {
    port: 0,
    shell: new Response(SHELL_MARKER, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }),
    tokens: { isOwnCheckout: false },
  })
  if (!outcome.ok) throw new Error(`expected a server, got ${outcome.reason}`)
  running.push(outcome)
  return outcome
}

function seed(relativePath: string, body: string): void {
  const full = join(ROOT, '.canon', 'canvas', relativePath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, body)
}

function seedTokens(css: string): void {
  mkdirSync(join(ROOT, '.claude', 'design'), { recursive: true })
  writeFileSync(join(ROOT, '.claude', 'design', 'base.css'), css)
}

function get(server: CanvasStarted, path: string): Promise<Response> {
  return fetch(`http://${SERVE_HOST}:${server.port}${path}`)
}

interface EventReader {
  /** Everything read so far once it carries the needle, or at the deadline. */
  readonly until: (needle: string) => Promise<string>
}

const openReaders: ReadableStreamDefaultReader<Uint8Array>[] = []

/**
 * Opens the change stream and reads it on demand. One reader serves every
 * wait, so a test can wait for the open preamble and then for an event
 * without a pause between them.
 */
async function openEvents(
  server: CanvasStarted,
  timeoutMs = 3000,
): Promise<EventReader> {
  const response = await get(server, '/api/events')
  if (!response.body) throw new Error('expected an event stream body')
  const reader = response.body.getReader()
  openReaders.push(reader)
  const decoder = new TextDecoder()
  const deadline = Date.now() + timeoutMs
  let seen = ''

  return {
    until: async (needle) => {
      while (!seen.includes(needle) && Date.now() < deadline) {
        const next = await Promise.race([
          reader.read(),
          new Promise<undefined>((settle) =>
            setTimeout(() => settle(undefined), deadline - Date.now()),
          ),
        ])
        if (next === undefined || next.done) break
        seen += decoder.decode(next.value)
      }
      return seen
    },
  }
}

/** Sends a request line verbatim, so the Host header is the one written here. */
function statusWithHost(port: number, host: string): Promise<number> {
  return new Promise((settle, fail) => {
    const socket = connect(port, SERVE_HOST, () => {
      socket.write(
        `GET /api/pages HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
      )
    })
    let received = ''
    socket.on('data', (chunk) => {
      received += chunk.toString()
    })
    socket.on('error', fail)
    socket.on('close', () => {
      settle(Number(received.match(/^HTTP\/1\.[01] (\d{3})/)?.[1]))
    })
  })
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-server-'))
})

afterEach(async () => {
  await Promise.all(openReaders.splice(0).map((reader) => reader.cancel()))
  await Promise.all(running.splice(0).map((server) => server.stop()))
  rmSync(ROOT, { recursive: true, force: true })
})

describe('startCanvas', () => {
  it('should bind the loopback interface only', () => {
    const server = start()

    expect(server.host).toBe('127.0.0.1')
    expect(server.url).toBe(`http://127.0.0.1:${server.port}/`)
  })

  it('should serve the shell at the root', async () => {
    const server = start()

    const body = await (await get(server, '/')).text()

    expect(body).toBe(SHELL_MARKER)
  })

  it('should list pages, frames, and the token source as JSON', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await get(server, '/api/pages')
    const record = await response.json()

    expect(response.headers.get('content-type')).toContain('application/json')
    expect(record.pages).toEqual([
      expect.objectContaining({
        name: 'drafts',
        frames: [expect.objectContaining({ name: 'hero' })],
      }),
    ])
    expect(record.tokens).toMatchObject({ source: 'none' })
    expect(record.tokens.notice).toContain('.claude/design/base.css')
  })

  it('should inject the token stylesheet into the head of a frame', async () => {
    seedTokens(':root { --color-text: teal; }')
    seed(
      'drafts/hero.html',
      '<!doctype html><html><head><title>x</title></head><body>hero</body></html>',
    )
    const server = start()

    const body = await (await get(server, '/frames/drafts/hero.html')).text()

    expect(body).toMatch(
      /<head><style data-canvas-tokens[^>]*>[^<]*teal[^<]*<\/style><title>/,
    )
  })

  it('should stamp a frame with the hash of its file, tokens or none', async () => {
    const file = '<!doctype html><html><head></head><body>hero</body></html>'
    seed('drafts/hero.html', file)
    const server = start()

    const body = await (await get(server, '/frames/drafts/hero.html')).text()

    const hash = createHash('sha256').update(file).digest('hex')
    expect(body).toContain(`data-canvas-hash="${hash}"`)
  })

  it('should inject into a frame that carries no head', async () => {
    seedTokens(':root { --color-text: teal; }')
    seed('drafts/bare.html', '<p>bare</p>')
    const server = start()

    const body = await (await get(server, '/frames/drafts/bare.html')).text()

    expect(body.indexOf('teal')).toBeLessThan(body.indexOf('<p>bare'))
  })

  it('should keep the doctype first in a frame that carries no head', async () => {
    seed('drafts/bare.html', '<!DOCTYPE html>\n<p>bare</p>')
    const server = start()

    const body = await (await get(server, '/frames/drafts/bare.html')).text()

    expect(body.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(body.indexOf('data-canvas-hash')).toBeLessThan(
      body.indexOf('<p>bare'),
    )
  })

  it('should stamp a frame saved with a byte order mark with the hash of its bytes', async () => {
    const file =
      '\uFEFF<!doctype html><html><head></head><body>hero</body></html>'
    seed('drafts/hero.html', file)
    const server = start()

    const body = await (await get(server, '/frames/drafts/hero.html')).text()

    const hash = createHash('sha256').update(file).digest('hex')
    expect(body).toContain(`data-canvas-hash="${hash}"`)
  })

  it('should serve a frame asset without touching it', async () => {
    seed('drafts/logo.svg', '<svg></svg>')
    const server = start()

    const response = await get(server, '/frames/drafts/logo.svg')

    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    expect(await response.text()).toBe('<svg></svg>')
  })

  it('should answer 404 for a frame that does not exist', async () => {
    const server = start()

    const response = await get(server, '/frames/drafts/missing.html')

    expect(response.status).toBe(404)
  })

  it('should serve the chrome tokens from the toolkit module', async () => {
    const server = start()

    const css = await (await get(server, '/api/chrome.css')).text()

    expect(css).toContain('--color-background:')
  })

  it('should send a change event when a frame file is written', async () => {
    seed('drafts/hero.html', '<p>one</p>')
    const server = start()
    const events = await openEvents(server)
    await events.until(': open')

    seed('drafts/hero.html', '<p>two</p>')

    const seen = await events.until('hero.html')
    expect(seen).toContain('"page":"drafts"')
    expect(seen).toContain('"file":"hero.html"')
  })

  it('should send a change event when a page folder is added', async () => {
    const server = start()
    const events = await openEvents(server)
    await events.until(': open')

    mkdirSync(join(ROOT, '.canon', 'canvas', 'approved'))

    expect(await events.until('approved')).toContain(
      '{"page":"approved","file":""}',
    )
  })

  it('should refuse a request whose Host is not the loopback address', async () => {
    const server = start()

    const status = await statusWithHost(
      server.port,
      `evil.example:${server.port}`,
    )

    expect(status).toBe(403)
  })

  it('should answer a request addressed to localhost on its own port', async () => {
    const server = start()

    const status = await statusWithHost(server.port, `localhost:${server.port}`)

    expect(status).toBe(200)
  })

  it('should declare the vendored chrome font so it renders without an install', async () => {
    const server = start()

    const css = await (await get(server, '/api/chrome.css')).text()

    expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*['"]?Geist Variable/)
  })
})

function post(
  server: CanvasStarted,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`http://${SERVE_HOST}:${server.port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function layoutOf(page: string): { frames: Record<string, unknown> } {
  return JSON.parse(
    readFileSync(join(ROOT, '.canon', 'canvas', page, 'layout.json'), 'utf8'),
  )
}

describe('POST /api/frames/move', () => {
  it('should write the position through the shared layout writer', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(server, '/api/frames/move', {
      page: 'drafts',
      frame: 'hero',
      x: 200,
      y: 120,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      box: { x: 200, y: 120 },
    })
    expect(layoutOf('drafts').frames.hero).toMatchObject({ x: 200, y: 120 })
  })

  it('should keep a box another writer stored for a different frame', async () => {
    seed('drafts/a.html', '<p>a</p>')
    seed('drafts/b.html', '<p>b</p>')
    seed(
      'drafts/layout.json',
      JSON.stringify({
        frames: {
          a: { x: 0, y: 0, width: 400, height: 300 },
          b: { x: 9, y: 9, width: 400, height: 300 },
        },
      }),
    )
    const server = start()

    await post(server, '/api/frames/move', {
      page: 'drafts',
      frame: 'a',
      x: 50,
      y: 60,
    })

    expect(layoutOf('drafts').frames).toMatchObject({
      a: { x: 50, y: 60 },
      b: { x: 9, y: 9 },
    })
  })

  it('should answer 404 naming the reason for a frame that does not exist', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(server, '/api/frames/move', {
      page: 'drafts',
      frame: 'missing',
      x: 0,
      y: 0,
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: 'no-frame',
    })
  })

  it('should answer 400 for a body that is not a position', async () => {
    const server = start()

    const response = await post(server, '/api/frames/move', {
      page: 'drafts',
      frame: 'hero',
      x: 'left',
    })

    expect(response.status).toBe(400)
  })

  it('should answer 415 for a body that is not JSON', async () => {
    const server = start()

    const response = await post(
      server,
      '/api/frames/move',
      {},
      { 'content-type': 'text/plain' },
    )

    expect(response.status).toBe(415)
  })

  it('should refuse a request another origin sent', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(
      server,
      '/api/frames/move',
      { page: 'drafts', frame: 'hero', x: 1, y: 1 },
      { origin: 'https://evil.example' },
    )

    expect(response.status).toBe(403)
  })
})

describe('POST /api/selection', () => {
  it('should record the frame and report it in the page list', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(server, '/api/selection', {
      page: 'drafts',
      frame: 'hero',
    })
    const record = await (await get(server, '/api/pages')).json()

    expect(response.status).toBe(200)
    expect(record.selection).toEqual({ page: 'drafts', frame: 'hero' })
  })

  it('should clear the selection when the body names no frame', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()
    await post(server, '/api/selection', { page: 'drafts', frame: 'hero' })

    await post(server, '/api/selection', {})
    const record = await (await get(server, '/api/pages')).json()

    expect(record.selection).toBeUndefined()
  })

  it('should clear the selection when both fields are null', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()
    await post(server, '/api/selection', { page: 'drafts', frame: 'hero' })

    const response = await post(server, '/api/selection', {
      page: null,
      frame: null,
    })
    const record = await (await get(server, '/api/pages')).json()

    expect(response.status).toBe(200)
    expect(record.selection).toBeUndefined()
  })

  it('should report no selection once the selected frame is removed', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()
    await post(server, '/api/selection', { page: 'drafts', frame: 'hero' })
    rmSync(join(ROOT, '.canon', 'canvas', 'drafts', 'hero.html'))

    const record = await (await get(server, '/api/pages')).json()

    expect(record.selection).toBeUndefined()
  })

  it('should record an element and report it in the page list', async () => {
    seed(
      'drafts/hero.html',
      '<html><head></head><body><button>Go</button></body></html>',
    )
    const server = start()

    const response = await post(server, '/api/selection', {
      page: 'drafts',
      frame: 'hero',
      element: { index: 3, tag: 'button', count: 4 },
    })
    const record = await (await get(server, '/api/pages')).json()

    expect(response.status).toBe(200)
    expect(record.selection).toEqual({
      page: 'drafts',
      frame: 'hero',
      element: { index: 3, tag: 'button', stale: false },
    })
  })

  it('should answer 409 for an element the file does not hold', async () => {
    seed('drafts/hero.html', '<table><tr><td>a</td></tr></table>')
    const server = start()

    const response = await post(server, '/api/selection', {
      page: 'drafts',
      frame: 'hero',
      element: { index: 6, tag: 'td', count: 7 },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ reason: 'address-mismatch' })
  })

  it('should answer 400 for an element sent without its frame', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(server, '/api/selection', {
      element: { index: 0, tag: 'p', count: 1 },
    })

    expect(response.status).toBe(400)
  })

  it('should answer 400 for an element that is not an address', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(server, '/api/selection', {
      page: 'drafts',
      frame: 'hero',
      element: 'the button',
    })

    expect(response.status).toBe(400)
  })

  it('should answer 404 for a frame that does not exist', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(server, '/api/selection', {
      page: 'drafts',
      frame: 'missing',
    })

    expect(response.status).toBe(404)
  })

  it('should refuse a request another origin sent', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(
      server,
      '/api/selection',
      { page: 'drafts', frame: 'hero' },
      { origin: 'https://evil.example' },
    )

    expect(response.status).toBe(403)
  })
})
