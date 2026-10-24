import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drive } from '@/driver/drive'
import { readDriverPlan } from '@/driver/steps'

/**
 * Drives a served page through one interaction at two viewport heights, because
 * the property this command exists for cannot be shown at one height or in one
 * state. The fixture's defect is both: it needs the menu open, and it needs the
 * short viewport, so a run that skipped either reports the page clean.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed. Run
 * it locally, or read the manual pass recorded with the feature.
 */

/**
 * A menu whose open panel is pushed off the right edge only where the viewport
 * is short. Contrived in its mechanism and not in its shape: a layout that
 * reflows below a height breakpoint is ordinary, and the defect it hides is the
 * scroll rail that passed at one height and failed at two others.
 */
const PAGE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; font: 14px/1.4 system-ui, sans-serif; }
      details { display: inline-block; }
      summary { width: 13px; list-style: none; }
      .panel { margin-left: 0; width: 125px; }
      .panel a { display: block; height: 32px; line-height: 32px; }
      @media (max-height: 950px) {
        details[open] .panel { margin-left: 300px; }
      }
    </style>
  </head>
  <body>
    <details id="menu">
      <summary>=</summary>
      <div class="panel">
        <a href="#one">One</a>
        <a href="#two">Two</a>
        <a href="#three">Three</a>
      </div>
    </details>
  </body>
</html>`

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
      fetch: () =>
        new Response(PAGE, { headers: { 'content-type': 'text/html' } }),
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

  it('should refuse by naming the server rather than reporting no findings', async () => {
    const read = readDriverPlan(RUN)
    if (read.kind !== 'read') return

    // A port the kernel handed out and then released refuses the connection. A
    // low reserved port would not: the engine blocks those before it connects,
    // which is a different failure and correctly not this one.
    const closed = Bun.serve({ port: 0, fetch: () => new Response('') })
    const port = Number(closed.port)
    closed.stop(true)

    const result = await drive({
      url: `http://127.0.0.1:${port}/`,
      plan: read.plan,
    })

    // Nothing measured and nothing found read the same to a caller counting
    // findings, which is why an unreachable page refuses rather than returning
    // an empty report.
    expect(result).toMatchObject({
      status: 'failed',
      reason: 'server-unreachable',
    })
  }, 120_000)
})
