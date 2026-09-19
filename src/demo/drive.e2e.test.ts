import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseDraft } from '@/demo/beats'
import type { DemoPlan } from '@/demo/compile'
import { compilePlan } from '@/demo/compile'
import { DEFAULT_CURSORS } from '@/demo/cursors'
import { CAPTION_ID, captionInitScript, drive, runStep } from '@/demo/drive'

/**
 * Every spike behind this feature drove a file on disk, which left a port, a
 * dev server, and a wait on a live element unproven. This drives a served
 * application instead, because both use cases involve one.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed. Run
 * it locally, or read the manual pass recorded with the feature.
 */

const APP = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Board</title>
    <style>
      body { font: 16px system-ui; margin: 0; padding: 48px; background: #101014; color: #f4f4f5; }
      input { font: inherit; padding: 12px 16px; width: 320px; }
      button { font: inherit; padding: 12px 20px; cursor: pointer; }
      #output:empty { display: none; }
      #output { margin-top: 24px; padding: 16px; background: #1e1e24; }
    </style>
  </head>
  <body>
    <h1>Board</h1>
    <input id="title" placeholder="Card title" />
    <button id="add">Add card</button>
    <div id="output"></div>
    <script>
      fetch('/scheme-seen?dark=' + matchMedia('(prefers-color-scheme: dark)').matches)
      document.getElementById('add').addEventListener('click', () => {
        const value = document.getElementById('title').value
        document.getElementById('output').textContent = value ? 'Added ' + value : ''
      })
    </script>
  </body>
</html>`

const DRAFT = `# Screencast: Board demo

## 3. Beat sheet

### Beat 1: Cold open

- On screen: The empty board
- Action: navigate
- Watch for: The board paints
- Emphasis: none
- Caption: An empty board

### Beat 2: Hero moment

- On screen: A card being named
- Action: type
- Watch for: The title appears in the field
- Emphasis: none
- Caption: Name the card

### Beat 3: Payoff

- On screen: The card on the board
- Action: click
- Watch for: The card lands
- Emphasis: none
- Caption: And it lands
`

/**
 * Shortens the seeded timing so the suite is not paced for a human watching it.
 * The compile path still supplies the values, which is what keeps this a test of
 * the plan rather than of a hand-written object.
 */
function quicken(plan: DemoPlan, url: string, targets: string[]): DemoPlan {
  return {
    ...plan,
    url,
    pointer: { travelMs: 80, typeDelayMs: 20 },
    steps: plan.steps.map((step, index) => ({
      ...step,
      target: targets[index] ?? '',
      text: step.kind === 'fill' ? 'Ship it' : '',
      waitFor: index === plan.steps.length - 1 ? '#output' : '',
      holdMs: 120,
    })),
  }
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

describe.skipIf(!hasBrowser)('drive against a served application', () => {
  let server: { port: number; stop: () => void }
  let root: string
  const schemesSeen: string[] = []

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-demo-e2e-'))
    const served = Bun.serve({
      port: 0,
      fetch: (request) => {
        const url = new URL(request.url)
        if (url.pathname === '/scheme-seen') {
          schemesSeen.push(url.searchParams.get('dark') ?? '')
          return new Response('ok')
        }
        return new Response(APP, { headers: { 'content-type': 'text/html' } })
      },
    })
    server = { port: Number(served.port), stop: () => served.stop(true) }
  })

  afterAll(() => {
    server.stop()
  })

  it('should write a recording and a still from one driven run', async () => {
    const parsed = parseDraft(DRAFT)
    expect(parsed.status).toBe('parsed')
    if (parsed.status !== 'parsed') return

    const plan = quicken(
      compilePlan(parsed.draft, { slug: 'board', outDir: 'demos' }),
      `http://127.0.0.1:${server.port}/`,
      ['', '#title', '#add'],
    )
    writeFileSync(join(root, 'plan.json'), JSON.stringify(plan))

    const result = await drive({
      plan,
      cursors: DEFAULT_CURSORS,
      videoPath: join(root, 'demos', 'board.webm'),
      stillPath: join(root, 'demos', 'board.png'),
    })

    expect(result).toMatchObject({ status: 'recorded', steps: 3 })
    if (result.status !== 'recorded') return

    expect(statSync(result.videoPath ?? '').size).toBeGreaterThan(1000)
    expect(statSync(result.stillPath ?? '').size).toBeGreaterThan(1000)
    // The engine keeps its auto-named copy beside the saved one unless the
    // run deletes it, so one name here is the assertion.
    expect(
      readdirSync(join(root, 'demos')).filter((name) => name.endsWith('.webm')),
    ).toEqual(['board.webm'])
  }, 180_000)

  it('should write a still on its own when the run is asked for no video', async () => {
    const parsed = parseDraft(DRAFT)
    if (parsed.status !== 'parsed') return

    const plan = quicken(
      compilePlan(parsed.draft, { slug: 'frame', outDir: 'frames' }),
      `http://127.0.0.1:${server.port}/`,
      ['', '#title', '#add'],
    )

    const result = await drive({
      plan,
      cursors: DEFAULT_CURSORS,
      stillPath: join(root, 'frames', 'frame.png'),
    })

    expect(result).toMatchObject({ status: 'recorded' })
    if (result.status !== 'recorded') return
    expect(result.videoPath).toBeUndefined()
    expect(readFileSync(result.stillPath ?? '').byteLength).toBeGreaterThan(
      1000,
    )
  }, 180_000)

  it('should start the page in the color scheme the plan sets, with no click beat', async () => {
    const parsed = parseDraft(DRAFT)
    if (parsed.status !== 'parsed') return

    const plan = {
      ...quicken(
        compilePlan(parsed.draft, { slug: 'scheme', outDir: 'frames' }),
        `http://127.0.0.1:${server.port}/`,
        ['', '#title', '#add'],
      ),
      colorScheme: 'dark' as const,
    }
    schemesSeen.length = 0

    const result = await drive({
      plan,
      cursors: DEFAULT_CURSORS,
      stillPath: join(root, 'frames', 'scheme.png'),
    })

    expect(result).toMatchObject({ status: 'recorded' })
    expect(schemesSeen[0]).toBe('true')
  }, 180_000)

  it('should draw a caption once the overlay script sets one', async () => {
    const { chromium } = await import('playwright-core')
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.addInitScript({ content: captionInitScript() })
      await page.goto('about:blank')

      await page.evaluate((text) => {
        window.__canon_demo_caption__?.(text)
      }, 'Name the card')

      const shown = await page.evaluate(
        (id) => document.getElementById(id)?.textContent,
        CAPTION_ID,
      )

      expect(shown).toBe('Name the card')
    } finally {
      await browser.close()
    }
  }, 30_000)

  it("should draw a beat's own caption after drive runs its step", async () => {
    const parsed = parseDraft(DRAFT)
    if (parsed.status !== 'parsed') return

    const plan = quicken(
      compilePlan(parsed.draft, { slug: 'hero-caption', outDir: 'frames' }),
      `http://127.0.0.1:${server.port}/`,
      ['', '#title', '#add'],
    )
    const heroStep = plan.steps.find((step) => step.still)
    expect(heroStep?.caption).toBe('Name the card')
    if (!heroStep) return

    const { chromium } = await import('playwright-core')
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.addInitScript({ content: captionInitScript() })
      await page.goto(plan.url)

      await runStep(page, plan, heroStep, {})

      const shown = await page.evaluate(
        (id) => document.getElementById(id)?.textContent,
        CAPTION_ID,
      )

      expect(shown).toBe(heroStep.caption)
    } finally {
      await browser.close()
    }
  }, 30_000)
})
