import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { groupByTreatment } from '@/inventory/group'
import { findSubject } from '@/inventory/subjects'
import { walk } from '@/inventory/walk'

/**
 * Drives a served application with two routes, because a walk that reads one
 * page proves nothing about the property this command exists to report, which
 * is how many different answers a site gives across all of them.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed. Run
 * it locally, or read the manual pass recorded with the feature.
 */

const QUERY = 'button, a[href]'

/** Two rings and one element with no treatment at all, spread over two routes. */
const PAGES: Record<string, string> = {
  '/': readFileSync(new URL('./fixtures/home.html', import.meta.url), 'utf8'),
  '/pricing': readFileSync(
    new URL('./fixtures/pricing.html', import.meta.url),
    'utf8',
  ),
}

async function browserAvailable(): Promise<boolean> {
  const { chromium } = await import('playwright-core')
  try {
    const browser = await chromium.launch()
    await browser.close()
    return true
  } catch {
    return false
  }
}

const hasBrowser = await browserAvailable()

describe.skipIf(!hasBrowser)('walk against a served application', () => {
  let server: { port: number; stop: () => void }

  beforeAll(() => {
    const served = Bun.serve({
      port: 0,
      fetch: (request) => {
        const body = PAGES[new URL(request.url).pathname]
        if (!body) return new Response('not found', { status: 404 })
        return new Response(body, { headers: { 'content-type': 'text/html' } })
      },
    })
    server = { port: Number(served.port), stop: () => served.stop(true) }
  })

  afterAll(() => {
    server.stop()
  })

  it('should group four elements across two routes by the answer each gives', async () => {
    const subject = findSubject('focus')
    expect(subject).toBeDefined()
    if (!subject) return

    const result = await walk({
      baseUrl: `http://127.0.0.1:${server.port}`,
      routes: ['/', '/pricing'],
      subject,
      query: QUERY,
    })

    expect(result.status).toBe('read')
    if (result.status !== 'read') return

    expect(result.readings).toHaveLength(4)
    expect(result.routes).toEqual([
      { route: '/', elements: 3 },
      { route: '/pricing', elements: 1 },
    ])

    const groups = groupByTreatment(result.readings)

    // Three elements share one ring across both routes and one has none, which
    // is two rows rather than the four a per-element listing would print.
    expect(groups).toHaveLength(2)
    expect(groups[0]?.count).toBe(3)
    expect(groups[0]?.routes).toEqual(['/', '/pricing'])
    expect(groups[0]?.treatment).toContain('outlineStyle solid')
    expect(groups[1]).toMatchObject({
      treatment: 'no visible change',
      count: 1,
      samples: ['button#quiet'],
    })
  }, 120_000)

  it('should refuse by naming the server rather than reporting an empty listing', async () => {
    const subject = findSubject('focus')
    if (!subject) return

    // A port the kernel handed out and then released refuses the connection.
    // A low reserved port would not: the engine blocks those before it
    // connects, which is a different failure and correctly not this one.
    const closed = Bun.serve({ port: 0, fetch: () => new Response('') })
    const port = Number(closed.port)
    closed.stop(true)

    const result = await walk({
      baseUrl: `http://127.0.0.1:${port}`,
      routes: ['/'],
      subject,
      query: QUERY,
    })

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'server-unreachable',
    })
  }, 120_000)
})
