import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drive } from '@/driver/drive'
import { readDriverPlan } from '@/driver/steps'

/**
 * Drives a served page through one interaction at two viewport heights, since the
 * fixture's defect needs both the open menu and the short viewport. The suite
 * skips without a browser binary, so read the verify.yml E2E job for whether it passed.
 */

/**
 * A menu whose open panel is pushed off the right edge only where the viewport is
 * short. Contrived in mechanism, not in shape: a reflow below a height breakpoint is ordinary.
 */
const PAGE = readFileSync(
  new URL('./fixtures/reflow.html', import.meta.url),
  'utf8',
)

/**
 * Text that clears contrast on the light background and fails on the dark one,
 * themed through `prefers-color-scheme`, so a run that renders one scheme
 * reports either a pass or a failure with no theme to place it under.
 */
const DARK_CONTRAST = readFileSync(
  new URL('./fixtures/dark-contrast.html', import.meta.url),
  'utf8',
)

const RUN = JSON.stringify({
  viewport: { width: 390, heights: [900, 1200] },
  probes: ['details'],
  steps: [{ name: 'open the menu', kind: 'click', target: '#menu summary' }],
})

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

describe.skipIf(!hasBrowser)('drive against a served application', () => {
  let server: { port: number; stop: () => void }

  beforeAll(() => {
    const served = Bun.serve({
      port: 0,
      fetch: (request) =>
        new Response(
          new URL(request.url).pathname === '/dark-contrast'
            ? DARK_CONTRAST
            : PAGE,
          { headers: { 'content-type': 'text/html' } },
        ),
    })
    server = { port: Number(served.port), stop: () => served.stop(true) }
  })

  afterAll(() => {
    server.stop()
  })

  it('should find at one height what the other reports clean', async () => {
    const read = readDriverPlan(RUN)
    expect(read.kind).toBe('read')
    if (read.kind !== 'read') return

    const result = await drive({
      url: `http://127.0.0.1:${server.port}/`,
      plan: read.plan,
    })

    expect(result.status).toBe('driven')
    if (result.status !== 'driven') return

    // One pass per height, each carrying the step that produced it.
    expect(result.passes).toEqual([
      { viewport: '390x900', step: 'open the menu', probes: 1, findings: 1 },
      { viewport: '390x1200', step: 'open the menu', probes: 1, findings: 0 },
    ])

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      probe: 'details',
      step: 'open the menu',
      viewport: '390x900',
    })
    expect(result.findings[0]?.detail).toContain('outside the viewport')
  }, 120_000)

  it('should place each axe finding with its rule and gate', async () => {
    const read = readDriverPlan(
      JSON.stringify({
        viewport: { width: 390, heights: [900] },
        probes: ['axe'],
        steps: [
          { name: 'open the menu', kind: 'click', target: '#menu summary' },
        ],
      }),
    )
    if (read.kind !== 'read') return

    const result = await drive({
      url: `http://127.0.0.1:${server.port}/`,
      plan: read.plan,
    })

    expect(result.status).toBe('driven')
    if (result.status !== 'driven') return

    // The fixture carries no `lang` and no `<title>`, and both are gate rules.
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          probe: 'axe',
          rule: 'html-has-lang',
          gate: true,
          step: 'open the menu',
          viewport: '390x900',
        }),
        expect.objectContaining({ rule: 'document-title', gate: true }),
      ]),
    )
  }, 120_000)

  it('should place a contrast failure under the one scheme that paints it', async () => {
    const read = readDriverPlan(
      JSON.stringify({
        viewport: { width: 390, heights: [900] },
        colorScheme: ['light', 'dark'],
        probes: ['axe'],
        steps: [{ name: 'arrive', kind: 'wait', ms: 0 }],
      }),
    )
    expect(read.kind).toBe('read')
    if (read.kind !== 'read') return

    const result = await drive({
      url: `http://127.0.0.1:${server.port}/dark-contrast`,
      plan: read.plan,
    })

    expect(result.status).toBe('driven')
    if (result.status !== 'driven') return

    const contrast = result.findings.filter(
      (finding) => finding.rule === 'color-contrast',
    )
    expect(contrast).toHaveLength(1)
    expect(contrast[0]).toMatchObject({
      viewport: '390x900',
      colorScheme: 'dark',
    })

    // The background is how a reader tells a page with no second theme apart.
    expect(result.passes).toEqual([
      expect.objectContaining({
        colorScheme: 'light',
        background: 'rgb(255, 255, 255)',
      }),
      expect.objectContaining({
        colorScheme: 'dark',
        background: 'rgb(51, 51, 51)',
      }),
    ])
  }, 120_000)

  it('should add no scheme to a pass or a finding when the run names none', async () => {
    const read = readDriverPlan(RUN)
    if (read.kind !== 'read') return

    const result = await drive({
      url: `http://127.0.0.1:${server.port}/`,
      plan: read.plan,
    })

    expect(result.status).toBe('driven')
    if (result.status !== 'driven') return
    expect(result.passes[0]).not.toHaveProperty('colorScheme')
    expect(result.passes[0]).not.toHaveProperty('background')
    expect(result.findings[0]).not.toHaveProperty('colorScheme')
  }, 120_000)

  it('should refuse by naming the server rather than reporting no findings', async () => {
    const read = readDriverPlan(RUN)
    if (read.kind !== 'read') return

    // A port handed out and released refuses the connection, unlike a reserved port the engine blocks.
    const closed = Bun.serve({ port: 0, fetch: () => new Response('') })
    const port = Number(closed.port)
    closed.stop(true)

    const result = await drive({
      url: `http://127.0.0.1:${port}/`,
      plan: read.plan,
    })

    // Nothing measured reads like nothing found, so an unreachable page refuses rather than reporting empty.
    expect(result).toMatchObject({
      status: 'failed',
      reason: 'server-unreachable',
    })
  }, 120_000)
})
