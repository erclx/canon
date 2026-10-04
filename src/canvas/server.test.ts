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
import { IMPLIED_ATTRIBUTE, TOKENS_ATTRIBUTE } from '@/canvas/address'
import { moveFrame } from '@/canvas/content'
import { editFrameAtIndex } from '@/canvas/edit'
import { EDITING_FILE, EDITING_TTL_MS, markEditing } from '@/canvas/editing'
import { type CanvasStarted, injectTokens, startCanvas } from '@/canvas/server'
import { SERVE_HOST } from '@/serve/static'

let ROOT = ''
const running: CanvasStarted[] = []

const SHELL_MARKER = '<p>shell</p>'

function start(port = 0): CanvasStarted {
  const outcome = startCanvas(ROOT, {
    port,
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

const STYLE = `<style ${TOKENS_ATTRIBUTE}>:root{}</style>`

describe('injectTokens', () => {
  it('should put the style first in a head the file states and mark nothing', () => {
    const html =
      '<!doctype html><html lang="en"><head><title>t</title></head><body><p>a</p></body></html>'

    const served = injectTokens(html, ':root{}')

    expect(served).toBe(
      `<!doctype html><html lang="en"><head>${STYLE}<title>t</title></head><body><p>a</p></body></html>`,
    )
  })

  it('should write a marked head right after an html the file states', () => {
    const html = '<!doctype html><html lang="en"><body><p>a</p></body></html>'

    const served = injectTokens(html, ':root{}')

    expect(served).toBe(
      `<!doctype html><html lang="en"><head ${IMPLIED_ATTRIBUTE}>${STYLE}<body><p>a</p></body></html>`,
    )
  })

  it('should write a marked html, head, and body after the doctype of a fragment', () => {
    const served = injectTokens('<!doctype html><h1>x</h1>', ':root{}')

    expect(served).toBe(
      `<!doctype html><html ${IMPLIED_ATTRIBUTE}><head ${IMPLIED_ATTRIBUTE}>${STYLE}<body ${IMPLIED_ATTRIBUTE}><h1>x</h1>`,
    )
  })

  it('should write the marked wrapper first in a fragment with no doctype', () => {
    const served = injectTokens('<h1>x</h1>', ':root{}')

    expect(served).toBe(
      `<html ${IMPLIED_ATTRIBUTE}><head ${IMPLIED_ATTRIBUTE}>${STYLE}<body ${IMPLIED_ATTRIBUTE}><h1>x</h1>`,
    )
  })

  it('should land ahead of a leading comment rather than inside it', () => {
    const served = injectTokens('<!-- <head> --><h1>x</h1>', ':root{}')

    expect(served).toBe(
      `<html ${IMPLIED_ATTRIBUTE}><head ${IMPLIED_ATTRIBUTE}>${STYLE}<!-- <head> --><body ${IMPLIED_ATTRIBUTE}><h1>x</h1>`,
    )
  })

  it('should keep the head content a fragment leads with inside the marked head', () => {
    const served = injectTokens(
      '<meta charset="utf-8"><style>h1:first-child{color:red}</style>\n<h1>x</h1>',
      ':root{}',
    )

    expect(served).toBe(
      `<html ${IMPLIED_ATTRIBUTE}><head ${IMPLIED_ATTRIBUTE}>${STYLE}<meta charset="utf-8"><style>h1:first-child{color:red}</style>\n<body ${IMPLIED_ATTRIBUTE}><h1>x</h1>`,
    )
  })

  it('should open the marked body ahead of text a fragment leads with', () => {
    const served = injectTokens('<title>t</title>Hello <b>x</b>', ':root{}')

    expect(served).toBe(
      `<html ${IMPLIED_ATTRIBUTE}><head ${IMPLIED_ATTRIBUTE}>${STYLE}<title>t</title><body ${IMPLIED_ATTRIBUTE}>Hello <b>x</b>`,
    )
  })

  it('should open the marked body at the end of a fragment holding only head content', () => {
    const served = injectTokens('<title>t</title>', ':root{}')

    expect(served).toBe(
      `<html ${IMPLIED_ATTRIBUTE}><head ${IMPLIED_ATTRIBUTE}>${STYLE}<title>t</title><body ${IMPLIED_ATTRIBUTE}>`,
    )
  })

  it('should mark only the html when the file states its head and body', () => {
    const served = injectTokens(
      '<head><title>t</title></head><body><p>a</p></body>',
      ':root{}',
    )

    expect(served).toBe(
      `<html ${IMPLIED_ATTRIBUTE}><head>${STYLE}<title>t</title></head><body><p>a</p></body>`,
    )
  })
})

describe('startCanvas', () => {
  it('should bind the loopback interface only', () => {
    const server = start()

    expect(server.host).toBe('127.0.0.1')
    expect(server.url).toBe(`http://127.0.0.1:${server.port}/`)
  })

  it('should walk past a port another canvas already holds', () => {
    const first = start()

    const second = start(first.port)

    // Greater than rather than exactly one above, because the walk skips every
    // occupied port and parallel sessions on this machine hold ports of their
    // own.
    expect(second.port).toBeGreaterThan(first.port)
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

  it('should list the tokens the frames resolve, grouped by kind', async () => {
    seedTokens(':root { --color-accent: teal; --space-sm: 4px; }')
    const server = start()

    const record = await (await get(server, '/api/pages')).json()

    expect(record.tokens.groups).toEqual([
      { kind: 'color', tokens: [{ name: '--color-accent', value: 'teal' }] },
      { kind: 'spacing', tokens: [{ name: '--space-sm', value: '4px' }] },
    ])
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

describe('POST /api/frames/resize', () => {
  it('should write the box through the shared layout writer', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(server, '/api/frames/resize', {
      page: 'drafts',
      frame: 'hero',
      x: 10,
      y: 20,
      width: 800,
      height: 600,
    })

    expect(response.status).toBe(200)
    expect(layoutOf('drafts').frames.hero).toEqual({
      x: 10,
      y: 20,
      width: 800,
      height: 600,
    })
  })

  it('should answer 400 naming the reason for a zero height', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(server, '/api/frames/resize', {
      page: 'drafts',
      frame: 'hero',
      x: 0,
      y: 0,
      width: 400,
      height: 0,
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: 'invalid-size',
    })
  })

  it('should answer 400 for a body that carries no size', async () => {
    const server = start()

    const response = await post(server, '/api/frames/resize', {
      page: 'drafts',
      frame: 'hero',
      x: 0,
      y: 0,
    })

    expect(response.status).toBe(400)
  })

  it('should refuse a request another origin sent', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()

    const response = await post(
      server,
      '/api/frames/resize',
      { page: 'drafts', frame: 'hero', x: 0, y: 0, width: 9, height: 9 },
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

const EDIT_FRAME = '<html><head></head><body><h1>Hero</h1></body></html>'

function hashOf(body: string): string {
  return createHash('sha256').update(body).digest('hex')
}

function frameFile(page: string, frame: string): string {
  return readFileSync(
    join(ROOT, '.canon', 'canvas', page, `${frame}.html`),
    'utf8',
  )
}

function editBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    page: 'drafts',
    frame: 'hero',
    element: { index: 3, tag: 'h1', count: 4, hash: hashOf(EDIT_FRAME) },
    property: 'color',
    value: 'blue',
    ...overrides,
  }
}

describe('POST /api/frames/edit', () => {
  it('should write the change into the frame file and answer its new hash', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    const response = await post(
      server,
      '/api/frames/edit',
      editBody({ value: 'var(--color-accent)' }),
    )

    const written = frameFile('drafts', 'hero')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      hash: hashOf(written),
    })
    expect(written).toContain('<h1 style="color: var(--color-accent)">')
  })

  it('should answer 409 and write nothing for an edit made before the file changed', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    const response = await post(
      server,
      '/api/frames/edit',
      editBody({
        element: { index: 3, tag: 'h1', count: 4, hash: hashOf('older') },
      }),
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ reason: 'stale-address' })
    expect(frameFile('drafts', 'hero')).toBe(EDIT_FRAME)
  })

  it('should answer 400 for an element sent without the hash it was served with', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    const response = await post(
      server,
      '/api/frames/edit',
      editBody({ element: { index: 3, tag: 'h1', count: 4 } }),
    )

    expect(response.status).toBe(400)
  })

  it('should answer 400 for a property outside the basic set', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    const response = await post(
      server,
      '/api/frames/edit',
      editBody({ property: 'box-shadow', value: 'none' }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ reason: 'invalid-edit' })
  })

  it('should answer 409 for text on an element holding other elements', async () => {
    const nested = '<html><head></head><body><p>a <b>b</b></p></body></html>'
    seed('drafts/hero.html', nested)
    const server = start()

    const response = await post(
      server,
      '/api/frames/edit',
      editBody({
        element: { index: 3, tag: 'p', count: 5, hash: hashOf(nested) },
        property: 'text',
        value: 'flat',
      }),
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ reason: 'not-text-only' })
  })

  it('should refuse a request another origin sent', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    const response = await post(server, '/api/frames/edit', editBody(), {
      origin: 'https://evil.example',
    })

    expect(response.status).toBe(403)
    expect(frameFile('drafts', 'hero')).toBe(EDIT_FRAME)
  })
})

describe('editing marks', () => {
  it('should report a live mark in the page list', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const now = new Date()
    markEditing(ROOT, 'drafts', 'hero', 'builder', now)
    const server = start()

    const record = await (await get(server, '/api/pages')).json()

    expect(record.editing).toEqual([
      {
        page: 'drafts',
        frame: 'hero',
        by: 'builder',
        until: new Date(now.getTime() + EDITING_TTL_MS).toISOString(),
      },
    ])
  })

  it('should leave an expired mark out of the page list', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    markEditing(
      ROOT,
      'drafts',
      'hero',
      'builder',
      new Date(Date.now() - EDITING_TTL_MS - 1000),
    )
    const server = start()

    const record = await (await get(server, '/api/pages')).json()

    expect(record.editing).toEqual([])
  })

  it('should send a change event when a mark is written', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    const server = start()
    const events = await openEvents(server)
    await events.until(': open')

    markEditing(ROOT, 'drafts', 'hero', 'builder', new Date())

    expect(await events.until(EDITING_FILE)).toContain(
      `{"page":"${EDITING_FILE}","file":""}`,
    )
  })
})

async function historyFlags(server: CanvasStarted): Promise<unknown> {
  return (await (await get(server, '/api/pages')).json()).history
}

describe('undo history', () => {
  it('should report nothing to undo before any edit', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    expect(await historyFlags(server)).toEqual({
      canUndo: false,
      canRedo: false,
    })
  })

  it('should undo a shell edit and report it can redo', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()
    await post(server, '/api/frames/edit', editBody())

    const response = await post(server, '/api/history/undo', {})

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      outcome: 'applied',
      history: { canUndo: false, canRedo: true },
    })
    expect(frameFile('drafts', 'hero')).toBe(EDIT_FRAME)
  })

  it('should redo an undone edit', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()
    await post(server, '/api/frames/edit', editBody())
    const edited = frameFile('drafts', 'hero')
    await post(server, '/api/history/undo', {})

    const response = await post(server, '/api/history/redo', {})

    expect(await response.json()).toMatchObject({ outcome: 'applied' })
    expect(frameFile('drafts', 'hero')).toBe(edited)
  })

  it('should merge two edits sharing a step into one undo', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()
    const first = await post(
      server,
      '/api/frames/edit',
      editBody({ property: 'width', value: '10px', step: 'drag' }),
    )
    const { hash } = await first.json()
    await post(
      server,
      '/api/frames/edit',
      editBody({
        element: { index: 3, tag: 'h1', count: 4, hash },
        property: 'height',
        value: '20px',
        step: 'drag',
      }),
    )

    await post(server, '/api/history/undo', {})

    expect(frameFile('drafts', 'hero')).toBe(EDIT_FRAME)
    expect(await historyFlags(server)).toEqual({
      canUndo: false,
      canRedo: true,
    })
  })

  it('should drop the entry and write nothing once the element changed', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()
    await post(server, '/api/frames/edit', editBody())
    const rewritten = frameFile('drafts', 'hero').replace('blue', 'green')
    seed('drafts/hero.html', rewritten)

    const response = await post(server, '/api/history/undo', {})

    expect(await response.json()).toEqual({
      ok: true,
      outcome: 'dropped',
      history: { canUndo: false, canRedo: false },
    })
    expect(frameFile('drafts', 'hero')).toBe(rewritten)
  })

  it('should record nothing for a refused edit', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    await post(server, '/api/frames/edit', editBody({ property: 'margin' }))

    expect(await historyFlags(server)).toMatchObject({ canUndo: false })
  })

  it('should record nothing for an edit made outside the server', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    editFrameAtIndex(ROOT, 'drafts', 'hero', 3, {
      property: 'color',
      value: 'blue',
    })

    expect(await historyFlags(server)).toMatchObject({ canUndo: false })
  })

  it('should undo a frame move and drop the box restore once the layout moved on', async () => {
    seed('drafts/hero.html', '<p>hero</p>')
    seed(
      'drafts/layout.json',
      JSON.stringify({
        frames: { hero: { x: 0, y: 0, width: 400, height: 300 } },
      }),
    )
    const server = start()
    await post(server, '/api/frames/move', {
      page: 'drafts',
      frame: 'hero',
      x: 50,
      y: 60,
    })
    await post(server, '/api/frames/resize', {
      page: 'drafts',
      frame: 'hero',
      x: 50,
      y: 60,
      width: 200,
      height: 100,
    })

    await post(server, '/api/history/undo', {})
    expect(layoutOf('drafts').frames.hero).toEqual({
      x: 50,
      y: 60,
      width: 400,
      height: 300,
    })
    moveFrame(ROOT, 'drafts', 'hero', { x: 90, y: 90 })
    const response = await post(server, '/api/history/undo', {})

    expect(await response.json()).toMatchObject({ outcome: 'dropped' })
    expect(layoutOf('drafts').frames.hero).toMatchObject({ x: 90, y: 90 })
  })

  it('should answer empty when there is nothing to undo', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    const response = await post(server, '/api/history/undo', {})

    expect(await response.json()).toMatchObject({ outcome: 'empty' })
  })

  it('should refuse an undo another origin sent', async () => {
    seed('drafts/hero.html', EDIT_FRAME)
    const server = start()

    const response = await post(
      server,
      '/api/history/undo',
      {},
      { origin: 'https://evil.example' },
    )

    expect(response.status).toBe(403)
  })
})
