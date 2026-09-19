import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext, Page } from 'playwright-core'
import { isBrowserMissing } from '@/browser/engine'
import { deriveSteps } from '@/demo/compile'
import type { DemoPlan, DemoStep } from '@/demo/compile'
import type { CursorSet } from '@/demo/pointer'
import { pointerSource } from '@/demo/pointer'

declare global {
  interface Window {
    __canon_demo_caption__?: (text: string) => void
  }
}

/**
 * Drives a running application and records what it did. Every browser reference
 * the demo feature adds lives here, and `src/commands/demo.ts` reaches it
 * through a dynamic import so no other command resolves the engine at startup.
 *
 * It imports `playwright-core` rather than `@playwright/test`, which stays a
 * development dependency the published tarball never carries. Shipping puts the
 * import in every target's dependency tree, and a target needs the driver
 * rather than a test runner and an assertion library. Every browser module here
 * takes the same import for that reason, `@/capture/render` included since it
 * started shipping too. Both are pinned to one version rather
 * than a range, because `bunx playwright install chromium` fetches the browser
 * revision the installed engine expects and a float would leave a target
 * resolving a binary its engine cannot launch.
 */

const POINTER_SIZE = 32
/**
 * Where the pointer starts. Any position inside the viewport works, since the
 * point is giving it one move to install and paint before it travels to the
 * first target. A corner keeps that first move out of the way of the content.
 */
const START = { x: 8, y: 8 }

/**
 * Whether any step will move the pointer. The injected element installs on
 * `DOMContentLoaded` and paints itself off-screen, so it costs nothing until
 * something moves it, and seeding `START` is what first makes it visible.
 *
 * A plan that only navigates, scrolls and holds has nothing to point at, and
 * seeding it anyway parked a cursor in the corner for the whole recording. That
 * reads as a stuck artifact rather than a pointer, which is the same defect as
 * resting it on a row of text, moved to a corner rather than fixed.
 *
 * `scroll` is absent deliberately. It is a targeted verb the compiler groups
 * with the rest, and it stopped moving the pointer when a scroll step began
 * leaving it where it was.
 */
function movesPointer(plan: DemoPlan): boolean {
  return plan.steps.some(
    (step) =>
      step.kind === 'click' || step.kind === 'fill' || step.kind === 'hover',
  )
}
const SETTLE_MS = 250
/** Round trips sampled to price one, on the page a step is actually about to move across. */
const CALIBRATION_STEPS = 8
/** DOM id the caption bar installs under, read back by `drive.e2e.test.ts`. */
export const CAPTION_ID = '__canon_demo_caption_bar__'

/**
 * The two output paths arrive resolved rather than as a root this re-resolves
 * against, because the plan already carries a directory and resolving it twice
 * nests the whole path inside itself.
 *
 * An absent path means the caller asked for that artifact not to be produced.
 */
export interface DriveOptions {
  readonly plan: DemoPlan
  readonly cursors: CursorSet
  readonly videoPath?: string
  readonly stillPath?: string
}

export type DriveResult =
  | {
      status: 'recorded'
      videoPath?: string
      stillPath?: string
      steps: number
      durationMs: number
    }
  | { status: 'failed'; reason: DriveRefusal; message: string }

export type DriveRefusal = 'browser-missing' | 'drive-failed'

interface DriveFailure {
  readonly status: 'failed'
  readonly reason: DriveRefusal
  readonly message: string
}

type Launch = { status: 'launched'; value: Browser } | DriveFailure

export async function drive(options: DriveOptions): Promise<DriveResult> {
  const { plan } = options

  const browser = await launch()
  if (browser.status === 'failed') return browser

  let videoDir: string | undefined
  let context: BrowserContext
  const started = Date.now()
  try {
    // Created after the launch, so a target with no browser binary does not
    // leave an empty directory behind for a run that never started, and inside
    // the try so a failure here closes the browser rather than leaking it.
    videoDir = options.videoPath
      ? mkdtempSync(join(tmpdir(), 'canon-demo-'))
      : undefined

    context = await browser.value.newContext({
      viewport: plan.viewport,
      ...(plan.colorScheme && { colorScheme: plan.colorScheme }),
      // Pointed the opposite way from a test. A recording wants the motion the
      // interface was designed with, where a test wants it suppressed.
      reducedMotion: 'no-preference',
      // `showActions` is deliberately not passed. Playwright's annotation draws
      // a dot on the interacted element and a title naming the API call it
      // made, and this recorder already supersedes both: the injected pointer
      // is a real cursor where the dot is a marker, and the caption bar carries
      // the beat's narration where the title carries `Mouse move`. Leaving it
      // on ran four overlays where two were wanted, and the two redundant ones
      // were the two a viewer reads as noise. `plan.annotations` survives as a
      // shape the type still carries and nothing now reads. It is not a record
      // of what a committed plan configured, because `parsePlan` has always
      // replaced it with the `ANNOTATIONS` constant rather than reading the
      // file's own values, so that path never existed to preserve.
      ...(videoDir
        ? {
            recordVideo: {
              dir: videoDir,
              size: plan.viewport,
            },
          }
        : {}),
    })
  } catch (error) {
    await browser.value.close()
    if (videoDir) rmSync(videoDir, { recursive: true, force: true })
    return failed('drive-failed', error)
  }

  let stillPath: string | undefined
  let videoPath: string | undefined

  try {
    await context.addInitScript({
      content: pointerSource(options.cursors, POINTER_SIZE),
    })
    await context.addInitScript({ content: captionInitScript() })
    const page = await context.newPage()
    const video = page.video()
    const pace: PointerPace = {}

    // The opening navigate is skipped when the plan already starts with one,
    // because a draft written around an opening verb compiles to a `navigate`
    // step for the same URL and the second load is a visible reload.
    if (plan.steps[0]?.kind !== 'navigate') {
      await page.goto(plan.url)
      if (movesPointer(plan)) {
        await page.mouse.move(START.x, START.y, { steps: 2 })
      }
    }

    for (const step of plan.steps) {
      await runStep(page, plan, step, pace)
      // The first marked step wins. One file holds one frame, so a plan a
      // person edited to mark several would otherwise write each over the last
      // and keep whichever ran last, with nothing saying so.
      if (step.still && options.stillPath && !stillPath) {
        stillPath = options.stillPath
        mkdirSync(dirname(stillPath), { recursive: true })
        await page.screenshot({ path: stillPath })
      }
    }

    await context.close()

    if (video && options.videoPath) {
      videoPath = options.videoPath
      mkdirSync(dirname(videoPath), { recursive: true })
      await video.saveAs(videoPath)
      // The engine keeps the auto-named recording beside the saved copy, so a
      // run that skipped this would leave two files for every demo.
      await video.delete()
    }
  } catch (error) {
    return failed('drive-failed', error)
  } finally {
    await browser.value.close()
    if (videoDir) rmSync(videoDir, { recursive: true, force: true })
  }

  return {
    status: 'recorded',
    ...(videoPath ? { videoPath } : {}),
    ...(stillPath ? { stillPath } : {}),
    steps: plan.steps.length,
    durationMs: Date.now() - started,
  }
}

/**
 * Reads the launch through `@/browser/engine`, which is where the separation
 * between a binary that was never installed and every other launch failure now
 * lives. It moved out of this file when `canon inventory` became the second
 * command needing it, rather than being copied.
 */
async function launch(): Promise<Launch> {
  try {
    return { status: 'launched', value: await chromium.launch() }
  } catch (error) {
    return failed(
      isBrowserMissing(error) ? 'browser-missing' : 'drive-failed',
      error,
    )
  }
}

/**
 * Holds the round trip once a step has measured it, so every `moveTo` after
 * the first reuses the same reading rather than re-timing on every move.
 */
export interface PointerPace {
  roundTripMs?: number
}

/**
 * Exported so `drive.e2e.test.ts` can drive one real step against a real
 * caption and read it back, which is the integration a full `drive()` call
 * cannot assert without decoding the video it writes.
 */
export async function runStep(
  page: Page,
  plan: DemoPlan,
  step: DemoStep,
  pace: PointerPace,
): Promise<void> {
  switch (step.kind) {
    case 'navigate':
      await page.goto(step.target || plan.url)
      if (movesPointer(plan)) {
        await page.mouse.move(START.x, START.y, { steps: 2 })
      }
      break
    case 'click':
      await moveTo(page, plan, step, pace)
      await page.mouse.down()
      await page.mouse.up()
      break
    case 'fill':
      await moveTo(page, plan, step, pace)
      await page.mouse.down()
      await page.mouse.up()
      await page.keyboard.type(step.text, { delay: plan.pointer.typeDelayMs })
      break
    case 'hover':
      await moveTo(page, plan, step, pace)
      break
    case 'scroll':
      // Centred rather than `scrollIntoViewIfNeeded`, which scrolls the least
      // it can and leaves a target taller than the remaining space flush
      // against the bottom edge. Measured on this repository's own recording at
      // 225 pixels of dead space above the content and 2 below, where centring
      // splits it 114 and 113. A recording frames its subject, so the least
      // scroll that technically reveals it is the wrong amount.
      await page
        .locator(step.target)
        .first()
        .evaluate((node) =>
          node.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            // Explicit, because this runs in the page where
            // `scrollIntoViewIfNeeded` ran through the debugging protocol and
            // was always instant. An in-page scroll honours the document's own
            // `scroll-behavior`, so a project setting it to `smooth` gets a
            // call that returns before the scroll finishes, with only
            // `SETTLE_MS` behind it. Nothing in this repository sets it, which
            // is exactly why the recorder cannot catch this on its own pages.
            behavior: 'instant',
          }),
        )
      await page.waitForTimeout(SETTLE_MS)
      // The pointer stays where it was. A scroll is not a pointing action, so
      // gliding the cursor to the target's centre parks it on top of whatever
      // the scroll just revealed and covers a row of it. A real session scrolls
      // with a wheel and leaves the cursor alone. On a plan that points at
      // nothing, `movesPointer` then keeps it off-screen for the whole run
      // rather than parked in a corner.
      break
    case 'wait':
    case 'hold':
      break
  }

  // Set after the action rather than before it, so the caption shows for the
  // hold that follows rather than for the page the action is about to leave.
  await setCaption(page, step.caption)
  if (step.waitFor) await page.locator(step.waitFor).first().waitFor()
  await page.waitForTimeout(step.holdMs)
}

/**
 * Timed on the page a `moveTo` is actually about to move across, never on the
 * blank page before it, since layout, paint, and page script are what a step
 * pays the round trip against and a blank page has none of the three.
 */
async function calibrateRoundTrip(page: Page): Promise<number> {
  const startedAt = Date.now()
  await page.mouse.move(START.x, START.y, { steps: CALIBRATION_STEPS })
  return (Date.now() - startedAt) / CALIBRATION_STEPS
}

/**
 * Travel is the whole point of driving the engine's pointer rather than calling
 * the element-clicking helper, which resolves a target and jumps to it. The
 * step count is what separates a cursor that glides from one that teleports.
 *
 * Resolving through a bounding box assumes the target is in the viewport, so a
 * target below the fold needs a `scroll` step ahead of it.
 */
async function moveTo(
  page: Page,
  plan: DemoPlan,
  step: DemoStep,
  pace: PointerPace,
): Promise<void> {
  pace.roundTripMs ??= await calibrateRoundTrip(page)
  const locator = page.locator(step.target).first()
  await locator.waitFor()
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${step.target} has no box to point at`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: deriveSteps(plan.pointer.travelMs, pace.roundTripMs),
  })
}

/**
 * Playwright's own `showActions` overlay names the API call it made, not the
 * beat's narration, so a caption needs an element of its own rather than
 * reusing that annotation. Runs alongside `pointerSource`, guarded the same
 * way against a page that already carries one.
 */
export function captionInitScript(): string {
  return `(() => {
  if (window.__canon_demo_caption__) return;

  let label;

  const install = () => {
    if (label || !document.body) return;
    const bar = document.createElement('div');
    bar.id = '${CAPTION_ID}';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText = [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:32px',
      'display:flex',
      'justify-content:center',
      'pointer-events:none',
      'z-index:2147483647',
    ].join(';');
    label = document.createElement('span');
    label.style.cssText = [
      'background:rgba(16,16,20,0.85)',
      'color:#f4f4f5',
      'font:600 20px/1.4 system-ui,sans-serif',
      'padding:10px 22px',
      'border-radius:8px',
      'max-width:80vw',
      'text-align:center',
      'display:none',
    ].join(';');
    bar.appendChild(label);
    document.body.appendChild(bar);
    window.__canon_demo_caption__ = (text) => {
      label.textContent = text || '';
      label.style.display = text ? 'inline-block' : 'none';
    };
  };

  if (document.readyState === 'loading') {
    addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();`
}

async function setCaption(page: Page, caption: string): Promise<void> {
  await page.evaluate((text) => {
    window.__canon_demo_caption__?.(text)
  }, caption)
}

function failed(reason: DriveRefusal, error: unknown): DriveFailure {
  return {
    status: 'failed',
    reason,
    message: error instanceof Error ? error.message : String(error),
  }
}
