import {
  type Box,
  FPS,
  type LogEvent,
  type Point,
  along,
  travelMs,
} from '@/take/log'
import type { TakeStep } from '@/take/plan'

/**
 * Performs a beat's steps through a stage and logs what the edit needs. The
 * choreography sits here once, and each capture route supplies the stage, being
 * how an input reaches the page and how clip time passes, so a beat moves the
 * same way whichever route filmed it.
 */

const FRAME_MS = 1000 / FPS

/** The gap between keys, slow enough that a viewer reads each one land. */
const KEY_MS = 90

/** How long a scroll's wheel travel runs. */
const SCROLL_MS = 900

export type PointerInput =
  | {
      readonly type: 'move' | 'down' | 'up'
      readonly x: number
      readonly y: number
    }
  | {
      readonly type: 'wheel'
      readonly x: number
      readonly y: number
      readonly dy: number
    }

export interface Stage {
  /** Milliseconds on the clip's own clock. */
  now(): number
  /** Lets `ms` of clip time pass. */
  hold(ms: number): Promise<void>
  /** Sends one pointer input and lets one frame pass. */
  pointer(input: PointerInput): Promise<void>
  /** Types one character into the focused field and lets one frame pass. */
  key(text: string): Promise<void>
  /** Evaluates an expression in the page. */
  evaluate<T>(expression: string): Promise<T>
}

/** A target that resolved to nothing, which refuses rather than films a guess. */
export class TargetMissing extends Error {
  /** The page as it stood when the lookup failed, as a JPEG, when the route caught one. */
  still?: Buffer

  constructor(readonly target: string) {
    super(`nothing on the page matches ${target}`)
  }
}

export interface Performance {
  pointer: Point
  /** Omitted for setup steps, which run before the clip starts. */
  readonly log?: LogEvent[]
}

export async function performSteps(
  stage: Stage,
  steps: readonly TakeStep[],
  state: Performance,
): Promise<void> {
  for (const step of steps) {
    switch (step.kind) {
      case 'move':
        await moveTo(
          stage,
          state,
          'target' in step ? center(await boxOf(stage, step.target)) : step,
        )
        break
      case 'click':
        await click(stage, state, await boxOf(stage, step.target))
        break
      case 'fill': {
        const box = await boxOf(stage, step.target)
        await click(stage, state, box)
        const start = stage.now()
        for (const character of step.text) {
          await stage.key(character)
          await stage.hold(KEY_MS - FRAME_MS)
        }
        state.log?.push({
          t: start,
          kind: 'type',
          at: state.pointer,
          box,
          chars: step.text.length,
          ms: stage.now() - start,
        })
        break
      }
      case 'scroll': {
        const at = center(await boxOf(stage, step.target))
        await moveTo(stage, state, at)
        const frames = Math.round(SCROLL_MS / FRAME_MS)
        state.log?.push({
          t: stage.now(),
          kind: 'scroll',
          at,
          dx: 0,
          dy: step.dy,
          ms: frames * FRAME_MS,
        })
        let sent = 0
        for (let frame = 1; frame <= frames; frame += 1) {
          const want = along(
            { x: 0, y: 0 },
            { x: 0, y: step.dy },
            frame / frames,
          ).y
          await stage.pointer({ type: 'wheel', ...at, dy: want - sent })
          sent = want
        }
        break
      }
      case 'wait':
        await stage.hold(step.ms)
        break
    }
  }
}

async function moveTo(
  stage: Stage,
  state: Performance,
  to: Point,
): Promise<void> {
  const from = state.pointer
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1) return
  const frames = Math.max(1, Math.round(travelMs(from, to) / FRAME_MS))
  state.log?.push({
    t: stage.now(),
    kind: 'move',
    from,
    to,
    ms: frames * FRAME_MS,
  })
  for (let frame = 1; frame <= frames; frame += 1) {
    state.pointer = along(from, to, frame / frames)
    await stage.pointer({ type: 'move', ...state.pointer })
  }
  state.pointer = to
}

async function click(
  stage: Stage,
  state: Performance,
  box: Box,
): Promise<void> {
  const at = center(box)
  await moveTo(stage, state, at)
  state.log?.push({ t: stage.now(), kind: 'click', at, box })
  await stage.pointer({ type: 'down', ...at })
  await stage.pointer({ type: 'up', ...at })
}

function center(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function boxOf(stage: Stage, target: string): Promise<Box> {
  const box = await stage.evaluate<Box | null>(boxExpression(target))
  if (!box) throw new TargetMissing(target)
  return box
}

/**
 * Finds a target's box in CSS pixels, reading `text=<words>` as the first
 * innermost element with a size whose whole text is those words, so a hidden
 * copy earlier in the page cannot shadow a visible one, and anything else as a
 * CSS selector.
 * It runs inside the page so both routes resolve a target the same way, and a
 * match with no size counts as missing, since a click on it would land on
 * whatever sits behind.
 */
export function boxExpression(target: string): string {
  return `(() => {
    const target = ${JSON.stringify(target)}
    let element = null
    if (target.startsWith('text=')) {
      const want = target.slice(5).trim()
      const matches = [...document.querySelectorAll('body *')].filter(
        (node) => node.textContent.trim() === want,
      )
      const innermost = matches.filter((node) => !matches.some((other) => other !== node && node.contains(other)))
      element = innermost.find((node) => {
        const rect = node.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }) ?? null
    } else {
      element = document.querySelector(target)
    }
    if (!element) return null
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })()`
}
