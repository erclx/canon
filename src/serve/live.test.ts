import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isLoopbackHost, LiveStream } from '@/serve/live'
import { SERVE_HOST } from '@/serve/static'

let ROOT = ''
const streams: LiveStream<unknown>[] = []

function watch<T>(
  map: (path: string) => T | undefined,
  onChange?: (payload: T) => void,
): LiveStream<T> {
  const stream = new LiveStream(ROOT, { map, onChange })
  streams.push(stream as LiveStream<unknown>)
  return stream
}

/** Reads the response body until it ends or the deadline passes. */
async function readFor(response: Response, ms: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('expected an event stream body')
  const decoder = new TextDecoder()
  const deadline = Date.now() + ms
  let seen = ''
  while (Date.now() < deadline) {
    const next = await Promise.race([
      reader.read(),
      new Promise<undefined>((settle) =>
        setTimeout(() => settle(undefined), deadline - Date.now()),
      ),
    ])
    if (next === undefined || next.done) break
    /* Read in-process, the body yields the strings the stream enqueued. */
    const chunk: unknown = next.value
    seen += typeof chunk === 'string' ? chunk : decoder.decode(next.value)
  }
  await reader.cancel()
  return seen
}

/**
 * Rewrites a file every 100ms until the condition holds or the deadline
 * passes. A recursive watcher on macOS goes live after it is constructed, so
 * the first write can land before it and raise nothing.
 */
async function writeUntil(
  path: string,
  condition: () => boolean,
  ms: number,
): Promise<void> {
  const deadline = Date.now() + ms
  let attempt = 0
  while (!condition() && Date.now() < deadline) {
    writeFileSync(path, String(attempt++))
    await new Promise((settle) => setTimeout(settle, 100))
  }
}

/** Long enough for a write to reach the watcher and its settle window to pass. */
const SETTLED_MS = 300

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-serve-live-'))
})

afterEach(() => {
  for (const stream of streams.splice(0)) stream.close()
  rmSync(ROOT, { recursive: true, force: true })
})

describe('LiveStream', () => {
  it('should collapse a burst of writes to one path into one event', async () => {
    const stream = watch((path) => ({ path }))
    const response = stream.open()

    writeFileSync(join(ROOT, 'page.html'), 'one')
    writeFileSync(join(ROOT, 'page.html'), 'two')
    writeFileSync(join(ROOT, 'page.html'), 'three')

    const seen = await readFor(response, SETTLED_MS)
    const paths = [...seen.matchAll(/^data: (.*)$/gm)].map(
      (frame) => (JSON.parse(frame[1] ?? '') as { path: string }).path,
    )
    /* The watched directory can report itself, so count only the path written. */
    expect(
      paths.filter((path) => path === 'page.html'),
      paths.join(', '),
    ).toHaveLength(1)
  })

  it('should send nothing for a path the mapper drops', async () => {
    const stream = watch((path) =>
      path.endsWith('.tmp') ? undefined : { path },
    )
    const response = stream.open()

    writeFileSync(join(ROOT, 'page.html.tmp'), 'staged')

    expect(await readFor(response, SETTLED_MS)).toBe(': open\n\n')
  })

  it('should hand a change to the listener rather than to clients when one is given', async () => {
    const heard: string[] = []
    const stream = watch(
      (path) => path,
      (path) => heard.push(path),
    )
    const response = stream.open()

    await writeUntil(
      join(ROOT, 'page.html'),
      () => heard.length > 0,
      SETTLED_MS * 10,
    )

    expect(await readFor(response, 50)).toBe(': open\n\n')
    expect(new Set(heard)).toEqual(new Set(['page.html']))
  })

  it('should send a payload to every open client', async () => {
    const stream = watch(() => undefined)
    const response = stream.open()

    stream.send({ reload: true })

    expect(await readFor(response, 100)).toContain('data: {"reload":true}\n\n')
  })

  it('should end every open stream on close', async () => {
    const stream = watch((path) => path)
    const reader = stream.open().body?.getReader()
    await reader?.read()

    stream.close()

    expect((await reader?.read())?.done).toBe(true)
  })
})

describe('isLoopbackHost', () => {
  it('should accept the loopback address on its own port', () => {
    expect(isLoopbackHost(`${SERVE_HOST}:8787`, 8787)).toBe(true)
  })

  it('should accept localhost on its own port', () => {
    expect(isLoopbackHost('localhost:8787', 8787)).toBe(true)
  })

  it('should refuse a rebound domain naming the same port', () => {
    expect(isLoopbackHost('evil.example:8787', 8787)).toBe(false)
  })

  it('should refuse a request carrying no Host', () => {
    expect(isLoopbackHost(null, 8787)).toBe(false)
  })
})
