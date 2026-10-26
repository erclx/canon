import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { probeFrames, transcode } from '@/take/encode'
import { FPS, type LogEvent, START, VIEWPORT } from '@/take/log'
import { type PointerInput, type Stage, performSteps } from '@/take/perform'
import type { Beat } from '@/take/plan'
import { HOLD_MS } from '@/take/stepper'

/**
 * Films a beat in real time through Playwright's screencast, for a page frame
 * stepping cannot drive. It runs at the viewport's own 1920x1080, so it goes
 * soft under a zoom where a stepped take stays sharp, and its frames land when
 * the page paints rather than one per step.
 */

const FRAME_MS = 1000 / FPS

const SETTLE_MS = 2500

export interface ScreencastTake {
  readonly frames: number
  readonly events: readonly LogEvent[]
}

export async function filmScreencast(request: {
  readonly url: string
  readonly beat: Beat
  readonly clip: string
}): Promise<ScreencastTake> {
  const scratch = mkdtempSync(join(tmpdir(), 'canon-take-cast-'))
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: VIEWPORT })
    await page.goto(request.url, { waitUntil: 'load' })
    await page.waitForTimeout(SETTLE_MS)

    const stageOn = (clock: () => number): Stage => ({
      now: clock,
      hold: (ms) => page.waitForTimeout(ms),
      pointer: async (input) => {
        const sent = clock()
        await send(page.mouse, input)
        const spent = clock() - sent
        if (spent < FRAME_MS) await page.waitForTimeout(FRAME_MS - spent)
      },
      key: async (text) => {
        await page.keyboard.insertText(text)
        await page.waitForTimeout(FRAME_MS)
      },
      evaluate: (expression) => page.evaluate(expression),
    })

    const live = stageOn(() => performance.now())
    await performSteps(live, request.beat.setup, { pointer: START })
    if (request.beat.setup.length > 0) await live.hold(1000)
    await page.mouse.move(START.x, START.y)

    const webm = join(scratch, 'take.webm')
    const events: LogEvent[] = []
    await page.screencast.start({ path: webm, size: VIEWPORT, fps: FPS })
    const started = performance.now()
    const recording = stageOn(() => performance.now() - started)
    await recording.hold(HOLD_MS)
    await performSteps(recording, request.beat.steps, {
      pointer: START,
      log: events,
    })
    await recording.hold(HOLD_MS)
    await page.screencast.stop()

    await transcode(webm, request.clip, FPS)
    return { frames: await probeFrames(request.clip), events }
  } finally {
    await browser.close()
    rmSync(scratch, { recursive: true, force: true })
  }
}

type Mouse = import('playwright-core').Mouse

async function send(mouse: Mouse, input: PointerInput): Promise<void> {
  switch (input.type) {
    case 'move':
      return mouse.move(input.x, input.y)
    case 'down':
      return mouse.down()
    case 'up':
      return mouse.up()
    case 'wheel':
      return mouse.wheel(0, input.dy)
  }
}
