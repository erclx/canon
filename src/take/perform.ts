import {
  type Box,
  FPS,
  type LogEvent,
  type Point,
  VIEWPORT,
  along,
  travelMs,
} from '@/take/log'
import { type Chord, type Modifier, isModifier, parseKeys } from '@/take/keys'
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

/** How long a drag holds still after its press, so the viewer sees the grab land. */
const GRAB_MS = 150

export type PointerInput =
  | {
      readonly type: 'move'
      readonly x: number
      readonly y: number
      /** True while a drag holds the left button down. */
      readonly held?: true
      readonly modifiers?: readonly Modifier[]
    }
  | {
      readonly type: 'down' | 'up'
      readonly x: number
      readonly y: number
      /** Which press of a run this is, 2 being a double click's second. */
      readonly clickCount: number
      readonly modifiers?: readonly Modifier[]
    }
  | {
      readonly type: 'wheel'
      readonly x: number
      readonly y: number
      readonly dy: number
    }

/** One key going down or coming up. */
export interface KeyInput {
  readonly type: 'down' | 'up'
  readonly key: string
  /** The modifiers held once this input lands, so a modifier's own down counts it. */
  readonly modifiers: readonly Modifier[]
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
  /** Sends one key down or up and lets one frame pass. */
  press(input: KeyInput): Promise<void>
  /** Evaluates an expression in the page. */
  evaluate<T>(expression: string): Promise<T>
}

/** A target the pointer cannot reach, which refuses rather than films a guess. */
export class TargetRefused extends Error {
  /** The page as it stood when the lookup failed, as a JPEG, when the route caught one. */
  still?: Buffer

  constructor(
    readonly target: string,
    message: string,
  ) {
    super(message)
  }
}

/** A target that resolved to nothing. */
export class TargetMissing extends TargetRefused {
  constructor(target: string) {
    super(target, `nothing on the page matches ${target}`)
  }
}

/**
 * A target whose center lies outside the window, so the pointer would aim at
 * a point the clip never shows. A plan reaches it with a scroll step first.
 */
export class TargetOffscreen extends TargetRefused {
  constructor(
    target: string,
    readonly at: Point,
  ) {
    super(
      target,
      `${target} is centered at (${Math.round(at.x)}, ${Math.round(at.y)}), outside the ${VIEWPORT.width}x${VIEWPORT.height} window, so a scroll step must reach it first`,
    )
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
      case 'dblclick':
        await click(
          stage,
          state,
          await boxOf(stage, step.target),
          step.modifiers ?? [],
          step.kind === 'dblclick' ? 2 : 1,
        )
        break
      case 'drag':
        await drag(
          stage,
          state,
          await boxOf(stage, step.from),
          await boxOf(stage, step.to),
          step.modifiers ?? [],
        )
        break
      case 'key': {
        const read = parseKeys(step.keys)
        if (read.kind === 'refused') throw new Error(read.detail)
        const start = stage.now()
        await pressChord(stage, read.chord)
        state.log?.push({
          t: start,
          kind: 'key',
          keys: step.keys,
          ms: stage.now() - start,
        })
        break
      }
      case 'fill': {
        const box = await boxOf(stage, step.target)
        await click(stage, state, box, [], 1)
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
        const start = stage.now()
        let sent = 0
        await paced(stage, frames, async (frame) => {
          const want = along(
            { x: 0, y: 0 },
            { x: 0, y: step.dy },
            frame / frames,
          ).y
          await stage.pointer({ type: 'wheel', ...at, dy: want - sent })
          sent = want
        })
        state.log?.push({
          t: start,
          kind: 'scroll',
          at,
          dx: 0,
          dy: step.dy,
          ms: stage.now() - start,
        })
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
  held?: { readonly modifiers: readonly Modifier[] },
): Promise<void> {
  const from = state.pointer
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1) return
  const frames = Math.max(1, Math.round(travelMs(from, to) / FRAME_MS))
  const pressed = held
    ? { held: true as const, ...withModifiers(held.modifiers) }
    : {}
  const start = stage.now()
  await paced(stage, frames, async (frame) => {
    state.pointer = along(from, to, frame / frames)
    await stage.pointer({ type: 'move', ...state.pointer, ...pressed })
  })
  state.pointer = to
  state.log?.push({ t: start, kind: 'move', from, to, ms: stage.now() - start })
}

/**
 * Runs a motion planned as `frames` inputs, sending each at the frame the
 * stage's clock has reached, so a page slower than a frame per input skips the
 * points it is behind on and the motion still ends near its planned length. A
 * clock advancing one frame per input, as the stepper's does, gets every frame.
 */
async function paced(
  stage: Stage,
  frames: number,
  input: (frame: number) => Promise<void>,
): Promise<void> {
  const start = stage.now()
  for (let frame = 0; frame < frames;) {
    const reached = Math.round((stage.now() - start) / FRAME_MS)
    frame = Math.min(frames, Math.max(frame + 1, reached + 1))
    await input(frame)
  }
}

async function click(
  stage: Stage,
  state: Performance,
  box: Box,
  modifiers: readonly Modifier[],
  count: number,
): Promise<void> {
  const at = center(box)
  await moveTo(stage, state, at)
  await holding(stage, modifiers, async () => {
    state.log?.push({
      t: stage.now(),
      kind: 'click',
      at,
      box,
      ...withModifiers(modifiers),
      ...(count > 1 ? { count } : {}),
    })
    for (let clickCount = 1; clickCount <= count; clickCount += 1) {
      const press = { ...at, clickCount, ...withModifiers(modifiers) }
      await stage.pointer({ type: 'down', ...press })
      await stage.pointer({ type: 'up', ...press })
    }
  })
}

/**
 * Presses on the source, holds a moment so the page reads a grab rather than
 * a click, glides held to the target, and releases there. The drop target is
 * read before the press, so a page that moves it once a drag starts is
 * dropped on where it stood.
 */
async function drag(
  stage: Stage,
  state: Performance,
  box: Box,
  drop: Box,
  modifiers: readonly Modifier[],
): Promise<void> {
  const from = center(box)
  const to = center(drop)
  await moveTo(stage, state, from)
  await holding(stage, modifiers, async () => {
    const start = stage.now()
    const press = { clickCount: 1, ...withModifiers(modifiers) }
    await stage.pointer({ type: 'down', ...from, ...press })
    await stage.hold(GRAB_MS)
    await moveTo(stage, state, to, { modifiers })
    await stage.pointer({ type: 'up', ...to, ...press })
    state.log?.push({
      t: start,
      kind: 'drag',
      from,
      to,
      box,
      drop,
      ...withModifiers(modifiers),
      ms: stage.now() - start,
    })
  })
}

/**
 * Presses each modifier in order, runs the inputs they hold, and releases them
 * in reverse, so a page reads every input between as modified on both routes.
 */
async function holding(
  stage: Stage,
  modifiers: readonly Modifier[],
  inputs: () => Promise<void>,
): Promise<void> {
  for (const [i, key] of modifiers.entries()) {
    await stage.press({
      type: 'down',
      key,
      modifiers: modifiers.slice(0, i + 1),
    })
  }
  await inputs()
  for (const [i, key] of [...modifiers.entries()].reverse()) {
    await stage.press({ type: 'up', key, modifiers: modifiers.slice(0, i) })
  }
}

/** Presses a chord's key inside its modifiers, counting a modifier key as held while down. */
async function pressChord(stage: Stage, chord: Chord): Promise<void> {
  const { key, modifiers } = chord
  await holding(stage, modifiers, async () => {
    const down = isModifier(key) ? [...modifiers, key] : modifiers
    await stage.press({ type: 'down', key, modifiers: down })
    await stage.press({ type: 'up', key, modifiers })
  })
}

function withModifiers(modifiers: readonly Modifier[]): {
  modifiers?: readonly Modifier[]
} {
  return modifiers.length > 0 ? { modifiers } : {}
}

function center(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function boxOf(stage: Stage, target: string): Promise<Box> {
  const box = await stage.evaluate<Box | null>(boxExpression(target))
  if (!box) throw new TargetMissing(target)
  const at = center(box)
  if (at.x < 0 || at.x > VIEWPORT.width || at.y < 0 || at.y > VIEWPORT.height) {
    throw new TargetOffscreen(target, at)
  }
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
