import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHROMIUM_REVISION, browsersRoot } from '@/browser/agent-cli'

/**
 * Drives `canon browser swipe` end to end against a served pinned section,
 * since only a real browser shows whether a protocol touch drag fires touch
 * listeners and moves the page. The pinned CLI refuses a `file:` address, so
 * the fixture is served over http.
 *
 * The suite needs Chromium revision 1247 and skips without it. The E2E Suites
 * job in verify.yml installs that revision through the agent CLI and fails
 * before any suite starts when it is missing.
 */

const PAGE = readFileSync(
  new URL('./fixtures/pinned.html', import.meta.url),
  'utf8',
)
const CLI = fileURLToPath(new URL('../cli.ts', import.meta.url))
const SESSION = `-s=canon-swipe-e2e-${process.pid}`

// The CLI writes snapshots under the folder it runs in, so it runs from a
// scratch folder rather than leaving them in the checkout.
let scratch = ''

const hasChromium = existsSync(
  `${browsersRoot(process.env, process.platform, homedir())}/chromium-${CHROMIUM_REVISION}`,
)

interface Events {
  touchstart: number
  touchmove: number
  touchend: number
  wheel: number
}

async function browser(...words: string[]): Promise<string> {
  const child = Bun.spawn(['bun', CLI, 'browser', SESSION, ...words], {
    cwd: scratch,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (code !== 0) throw new Error(`browser ${words[0]} exited ${code}: ${err}`)
  return out.trim()
}

/** `--raw eval` prints a returned string JSON-encoded, so decode twice. */
async function read<T>(expression: string): Promise<T> {
  const raw = await browser('--raw', 'eval', `JSON.stringify(${expression})`)
  return JSON.parse(JSON.parse(raw) as string) as T
}

async function startAt(y: number): Promise<void> {
  await browser(
    '--raw',
    'eval',
    `(scrollTo(0, ${y}), window.__events = { touchstart: 0, touchmove: 0, touchend: 0, wheel: 0, scroll: 0 }, 0)`,
  )
}

describe.skipIf(!hasChromium)('canon browser swipe on a served page', () => {
  let server: { port: number; stop: () => void }

  beforeAll(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'canon-swipe-e2e-'))
    const served = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(PAGE, { headers: { 'content-type': 'text/html' } }),
    })
    server = { port: Number(served.port), stop: () => served.stop(true) }
    await browser('open', '--mobile', `http://127.0.0.1:${server.port}/`)
  }, 120_000)

  afterAll(async () => {
    await browser('close').catch(() => '')
    server.stop()
    rmSync(scratch, { recursive: true, force: true })
  })

  it('should fire touch events and scroll the page down for a positive dy', async () => {
    await startAt(900)

    const printed = await browser('--raw', 'swipe', '180', '600', '400')

    const events = await read<Events>('window.__events')
    expect(events.touchstart).toBe(1)
    expect(events.touchend).toBe(1)
    expect(events.touchmove).toBeGreaterThan(0)
    expect(events.wheel).toBe(0)
    const scrolled = JSON.parse(printed) as { y: number }
    expect(scrolled.y).toBeGreaterThan(900)
    expect(await read<number>('scrollY')).toBe(scrolled.y)
  }, 60_000)

  it('should scroll the page up for a negative dy', async () => {
    await startAt(1500)

    await browser('--raw', 'swipe', '180', '200', '-400')

    const events = await read<Events>('window.__events')
    expect(events.touchstart).toBe(1)
    expect(await read<number>('scrollY')).toBeLessThan(1500)
  }, 60_000)
})
