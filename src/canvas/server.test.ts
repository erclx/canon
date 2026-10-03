import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

/** Reads the event stream until a chunk carries the needle, or times out. */
async function waitForEvent(
  body: ReadableStream<Uint8Array>,
  needle: string,
  timeoutMs = 3000,
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let seen = ''
  const deadline = Date.now() + timeoutMs
  try {
    while (Date.now() < deadline) {
      const next = await Promise.race([
        reader.read(),
        new Promise<undefined>((settle) =>
          setTimeout(() => settle(undefined), deadline - Date.now()),
        ),
      ])
      if (next === undefined || next.done) break
      seen += decoder.decode(next.value)
      if (seen.includes(needle)) return seen
    }
    return seen
  } finally {
    await reader.cancel()
  }
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-server-'))
})

afterEach(async () => {
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
      /<head><style data-canvas-tokens>[^<]*teal[^<]*<\/style><title>/,
    )
  })

  it('should inject into a frame that carries no head', async () => {
    seedTokens(':root { --color-text: teal; }')
    seed('drafts/bare.html', '<p>bare</p>')
    const server = start()

    const body = await (await get(server, '/frames/drafts/bare.html')).text()

    expect(body.indexOf('teal')).toBeLessThan(body.indexOf('<p>bare'))
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
    const response = await get(server, '/api/events')
    const body = response.body
    if (!body) throw new Error('expected an event stream body')

    const pending = waitForEvent(body, 'hero.html')
    await new Promise((settle) => setTimeout(settle, 100))
    seed('drafts/hero.html', '<p>two</p>')

    const seen = await pending
    expect(seen).toContain('"page":"drafts"')
    expect(seen).toContain('"file":"hero.html"')
  })
})
