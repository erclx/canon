/**
 * The take plan, reusing `canon drive`'s step kinds plus `move`, which films the
 * pointer's travel. `tab` is left out, since keyboard focus leaves no cursor.
 */

import { MODIFIERS, type Modifier, isModifier, parseKeys } from '@/take/keys'

/** How a beat is filmed: frame stepping, or Playwright's real-time screencast. */
export const ROUTES = ['step', 'screencast'] as const

export type Route = (typeof ROUTES)[number]

/** A window's size in CSS pixels. */
export interface Viewport {
  readonly width: number
  readonly height: number
}

/**
 * The window a beat films in when neither it nor the take names one. It is
 * also the largest allowed, since the stepper films at twice it and a larger
 * frame passes the stall limit on paint alone.
 */
export const DEFAULT_VIEWPORT: Viewport = { width: 1920, height: 1080 }

/** The smallest window a beat may film in. */
export const MIN_VIEWPORT: Viewport = { width: 320, height: 240 }

/** The keys held through a press, absent when none is. */
interface Held {
  readonly modifiers?: readonly Modifier[]
}

/**
 * True sends a press to whatever is on top at its point, for a layer built to
 * take it. Absent means a press whose point lands outside its target refuses.
 */
interface Through {
  readonly through?: true
}

/**
 * A move's milliseconds at its end with the camera aimed there, absent when the
 * move aims the camera nowhere.
 */
interface Aimed {
  readonly hold?: number
}

/**
 * A point in CSS pixels of the window, measured at the beat's own viewport. It
 * reaches what no top-document selector does, such as content in a frame or
 * under a layer taking every pointer event, and breaks when the layout shifts.
 */
export interface PointAim {
  readonly x: number
  readonly y: number
}

/** What a drag end aims at: a target, or a point. */
export type DragEnd = string | PointAim

type Press = { readonly target: string } | PointAim

export type TakeStep =
  | ({ readonly kind: 'move'; readonly target: string } & Aimed)
  | ({ readonly kind: 'move' } & PointAim & Aimed)
  | ({ readonly kind: 'click' | 'dblclick' } & Press & Held & Through)
  | ({
      readonly kind: 'drag'
      readonly from: DragEnd
      readonly to: DragEnd
    } & Held &
      Through)
  | { readonly kind: 'key'; readonly keys: string }
  | ({
      readonly kind: 'fill'
      readonly target: string
      readonly text: string
    } & Through)
  | { readonly kind: 'scroll'; readonly target: string; readonly dy: number }
  | { readonly kind: 'wait'; readonly ms: number }

const KINDS = [
  'move',
  'click',
  'dblclick',
  'drag',
  'key',
  'fill',
  'scroll',
  'wait',
] as const

export interface Beat {
  readonly name: string
  /**
   * The route asked for. A `step` beat that frame stepping cannot drive falls
   * back to `screencast` on its own, and the take's record says which ran.
   */
  readonly route: Route
  /**
   * False turns the camera's zoom off for this beat, while its track still
   * carries the cursor and the click ring. Absent means the zoom runs.
   */
  readonly push?: false
  /**
   * True films the page with its classic scrollbars drawn, which take 15 px of
   * layout width. Absent means they stay hidden.
   */
  readonly scrollbars?: true
  /**
   * Requests held pending or failed for the whole beat, applied before the
   * page loads, so a loading or error state stays on screen to be filmed.
   * Absent means no request is intercepted.
   */
  readonly network?: readonly NetworkRule[]
  /**
   * The window this beat films in, over the take's `--viewport` and the
   * default. Absent means the beat takes whichever of those applies.
   */
  readonly viewport?: Viewport
  /** Runs after the page loads and before the first frame is kept. */
  readonly setup: readonly TakeStep[]
  readonly steps: readonly TakeStep[]
}

/** What a beat does to a request the page makes. */
export const NETWORK_ACTIONS = ['hold', 'abort'] as const

export type NetworkAction = (typeof NETWORK_ACTIONS)[number]

export interface NetworkRule {
  /** The request's whole address, with `*` matching any run of characters. */
  readonly match: string
  readonly action: NetworkAction
}

export interface TakePlan {
  readonly beats: readonly Beat[]
}

export type TakePlanRefusal =
  | 'unreadable-plan'
  | 'no-beats'
  | 'bad-beat'
  | 'no-steps'
  | 'unknown-route'
  | 'bad-step'
  | 'bad-viewport'

export type TakePlanRead =
  | { readonly kind: 'read'; readonly plan: TakePlan }
  | {
      readonly kind: 'refused'
      readonly reason: TakePlanRefusal
      readonly detail: string
    }

class Refusal extends Error {
  constructor(
    readonly reason: TakePlanRefusal,
    detail: string,
  ) {
    super(detail)
  }
}

/**
 * Reads a take plan out of a JSON document, the same form `canon drive` reads
 * its run in, refusing the first thing a take could not perform.
 */
export function readTakePlan(source: string): TakePlanRead {
  let document: unknown
  try {
    document = JSON.parse(source)
  } catch (error) {
    return {
      kind: 'refused',
      reason: 'unreadable-plan',
      detail: error instanceof Error ? error.message : String(error),
    }
  }

  try {
    return { kind: 'read', plan: readPlan(document) }
  } catch (error) {
    if (!(error instanceof Refusal)) throw error
    return { kind: 'refused', reason: error.reason, detail: error.message }
  }
}

function readPlan(document: unknown): TakePlan {
  if (!isRecord(document)) {
    throw new Refusal('unreadable-plan', 'the document is not an object')
  }
  const { beats } = document
  const route = document.route ?? 'step'
  if (!ROUTES.includes(route as Route)) {
    throw new Refusal(
      'unknown-route',
      `the plan names route ${String(route)}. This build records on: ${ROUTES.join(', ')}.`,
    )
  }
  if (!Array.isArray(beats) || beats.length === 0) {
    throw new Refusal(
      'no-beats',
      'beats carries no entry, so nothing is filmed',
    )
  }
  return {
    beats: beats.map((entry, index) => readBeat(entry, index, route as Route)),
  }
}

function readBeat(entry: unknown, index: number, fallback: Route): Beat {
  const at = `beat ${index + 1}`
  if (!isRecord(entry)) throw new Refusal('bad-beat', `${at} is not an object`)

  const name = typeof entry.name === 'string' ? entry.name : ''
  if (!name) {
    throw new Refusal(
      'bad-beat',
      `${at} carries no name, and its clip is named by it`,
    )
  }

  const route = entry.route ?? fallback
  if (!ROUTES.includes(route as Route)) {
    throw new Refusal(
      'unknown-route',
      `${name} names route ${String(route)}. This build records on: ${ROUTES.join(', ')}.`,
    )
  }

  if (!Array.isArray(entry.steps) || entry.steps.length === 0) {
    throw new Refusal(
      'no-steps',
      `${name} names no step, so its take would film nothing`,
    )
  }
  if (entry.setup !== undefined && !Array.isArray(entry.setup)) {
    throw new Refusal('bad-beat', `${name} carries a setup that is not a list`)
  }
  if (entry.push !== undefined && typeof entry.push !== 'boolean') {
    throw new Refusal(
      'bad-beat',
      `${name} carries a push that is not true or false`,
    )
  }
  if (entry.scrollbars !== undefined && typeof entry.scrollbars !== 'boolean') {
    throw new Refusal(
      'bad-beat',
      `${name} carries a scrollbars that is not true or false`,
    )
  }

  const network = readNetwork(entry.network, name)
  const viewport = readBeatViewport(entry.viewport, name)

  return {
    name,
    route: route as Route,
    ...(entry.push === false ? { push: false as const } : {}),
    ...(entry.scrollbars === true ? { scrollbars: true as const } : {}),
    ...(network ? { network } : {}),
    ...(viewport ? { viewport } : {}),
    setup: (entry.setup ?? []).map((step: unknown, i: number) =>
      readStep(step, `${name}, setup step ${i + 1}`),
    ),
    steps: entry.steps.map((step: unknown, i: number) =>
      readStep(step, `${name}, step ${i + 1}`),
    ),
  }
}

function readStep(entry: unknown, at: string): TakeStep {
  if (!isRecord(entry)) throw new Refusal('bad-step', `${at} is not an object`)

  const target = typeof entry.target === 'string' ? entry.target : undefined
  if (target) refusePointString(target, at, 'target')
  const needTarget = (): string => {
    if (target) return target
    throw new Refusal('bad-step', `${at} is a ${entry.kind} with no target`)
  }

  switch (entry.kind) {
    case 'move': {
      const aimed = readHold(entry, at)
      if (target) return { kind: 'move', target, ...aimed }
      if (isNumber(entry.x) && isNumber(entry.y)) {
        return { kind: 'move', x: entry.x, y: entry.y, ...aimed }
      }
      throw new Refusal(
        'bad-step',
        `${at} is a move with neither a target nor an x and y`,
      )
    }
    case 'click':
    case 'dblclick': {
      const held = {
        ...readModifiers(entry.modifiers, at),
        ...readThrough(entry, at),
      }
      const point = 'x' in entry || 'y' in entry
      if (target && point) {
        throw new Refusal(
          'bad-step',
          `${at} is a ${entry.kind} carrying both a target and an x and y, so give it one aim`,
        )
      }
      if (target) return { kind: entry.kind, target, ...held }
      if (isNumber(entry.x) && isNumber(entry.y)) {
        return { kind: entry.kind, x: entry.x, y: entry.y, ...held }
      }
      throw new Refusal(
        'bad-step',
        `${at} is a ${entry.kind} with neither a target nor an x and y`,
      )
    }
    case 'drag':
      return {
        kind: 'drag',
        from: readDragEnd(entry.from, at, 'from'),
        to: readDragEnd(entry.to, at, 'to'),
        ...readModifiers(entry.modifiers, at),
        ...readThrough(entry, at),
      }
    case 'key': {
      if (typeof entry.keys !== 'string') {
        throw new Refusal('bad-step', `${at} is a key with no keys to press`)
      }
      const read = parseKeys(entry.keys)
      if (read.kind === 'refused') {
        throw new Refusal('bad-step', `${at} is a key where ${read.detail}`)
      }
      return { kind: 'key', keys: entry.keys }
    }
    case 'fill':
      if (typeof entry.text !== 'string') {
        throw new Refusal('bad-step', `${at} is a fill with no text`)
      }
      return {
        kind: 'fill',
        target: needTarget(),
        text: entry.text,
        ...readThrough(entry, at),
      }
    case 'scroll':
      if (!isNumber(entry.dy)) {
        throw new Refusal('bad-step', `${at} is a scroll with no dy in pixels`)
      }
      return { kind: 'scroll', target: needTarget(), dy: entry.dy }
    case 'wait':
      if (!isNumber(entry.ms) || entry.ms < 0) {
        throw new Refusal('bad-step', `${at} is a wait with no ms`)
      }
      return { kind: 'wait', ms: entry.ms }
    default:
      throw new Refusal(
        'bad-step',
        `${at} names kind ${String(entry.kind)}, which is not ${KINDS.join(', ')}`,
      )
  }
}

function readDragEnd(value: unknown, at: string, end: string): DragEnd {
  if (typeof value === 'string' && value) {
    refusePointString(value, at, end)
    return value
  }
  if (isRecord(value) && isNumber(value.x) && isNumber(value.y)) {
    return { x: value.x, y: value.y }
  }
  throw new Refusal(
    'bad-step',
    `${at} is a drag whose ${end} is neither a target nor an object with an x and y`,
  )
}

/**
 * Refuses a point written where a target goes, which would otherwise reach the
 * page as a selector and fail there a beat into the take.
 */
function refusePointString(value: string, at: string, field: string): void {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(
    value,
  )
  if (!match) return
  throw new Refusal(
    'bad-step',
    `${at} writes the point ${value} as its ${field}, which is read as a selector. Write it as { "x": ${match[1]}, "y": ${match[2]} }.`,
  )
}

function readNetwork(
  value: unknown,
  name: string,
): readonly NetworkRule[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length === 0) {
    throw new Refusal(
      'bad-beat',
      `${name} carries a network that is not a list of entries`,
    )
  }
  const rules: NetworkRule[] = []
  for (const [i, entry] of value.entries()) {
    const at = `${name}, network entry ${i + 1}`
    if (!isRecord(entry)) {
      throw new Refusal('bad-beat', `${at} is not an object`)
    }
    if (typeof entry.match !== 'string' || !entry.match) {
      throw new Refusal('bad-beat', `${at} carries no match pattern`)
    }
    if (!NETWORK_ACTIONS.includes(entry.action as NetworkAction)) {
      throw new Refusal(
        'bad-beat',
        `${at} names action ${String(entry.action)}, which is not ${NETWORK_ACTIONS.join(', ')}`,
      )
    }
    const { match } = entry
    if (rules.some((rule) => rule.match === match)) {
      throw new Refusal('bad-beat', `${at} names ${match} a second time`)
    }
    rules.push({ match, action: entry.action as NetworkAction })
  }
  return rules
}

function readBeatViewport(value: unknown, name: string): Viewport | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || !isNumber(value.width) || !isNumber(value.height)) {
    throw new Refusal(
      'bad-viewport',
      `${name} carries a viewport that is not a width and a height in pixels`,
    )
  }
  const viewport = { width: value.width, height: value.height }
  const problem = viewportProblem(viewport)
  if (problem) throw new Refusal('bad-viewport', `${name} carries ${problem}`)
  return viewport
}

export type ViewportRead =
  | { readonly kind: 'read'; readonly viewport: Viewport }
  | { readonly kind: 'refused'; readonly detail: string }

/** Reads a window size written as `<width>x<height>`, such as `1280x720`. */
export function parseViewport(text: string): ViewportRead {
  const match = /^(\d+)x(\d+)$/.exec(text.trim())
  if (!match) {
    return {
      kind: 'refused',
      detail: `${text} is not a size written as <width>x<height>, such as 1280x720`,
    }
  }
  const viewport = { width: Number(match[1]), height: Number(match[2]) }
  const problem = viewportProblem(viewport)
  return problem
    ? { kind: 'refused', detail: problem }
    : { kind: 'read', viewport }
}

/**
 * Says why a size cannot be filmed, or nothing when it can. Each side is even,
 * since the encoder refuses an odd dimension, and within the bounds above.
 */
function viewportProblem({ width, height }: Viewport): string | undefined {
  const size = `${width}x${height}`
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return `a viewport of ${size}, which is not whole pixels`
  }
  if (
    width < MIN_VIEWPORT.width ||
    height < MIN_VIEWPORT.height ||
    width > DEFAULT_VIEWPORT.width ||
    height > DEFAULT_VIEWPORT.height
  ) {
    return `a viewport of ${size}, outside ${MIN_VIEWPORT.width}x${MIN_VIEWPORT.height} to ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}`
  }
  if (width % 2 !== 0 || height % 2 !== 0) {
    return `a viewport of ${size}, with an odd side the encoder refuses`
  }
  return undefined
}

/** The window a beat films in: its own key, then the take's option, then the default. */
export function beatViewport(beat: Beat, option?: Viewport): Viewport {
  return beat.viewport ?? option ?? DEFAULT_VIEWPORT
}

function readHold(entry: Record<string, unknown>, at: string): Aimed {
  if (!('hold' in entry)) return {}
  if (!isNumber(entry.hold) || entry.hold < 0) {
    throw new Refusal(
      'bad-step',
      `${at} is a move whose hold is not a non-negative number of ms`,
    )
  }
  return { hold: entry.hold }
}

function readThrough(entry: Record<string, unknown>, at: string): Through {
  if (entry.through === undefined || entry.through === false) return {}
  if (entry.through !== true) {
    throw new Refusal(
      'bad-step',
      `${at} carries a through that is not true or false`,
    )
  }
  return { through: true }
}

function readModifiers(value: unknown, at: string): Held {
  if (value === undefined) return {}
  if (!Array.isArray(value)) {
    throw new Refusal('bad-step', `${at} carries modifiers that are not a list`)
  }
  const modifiers: Modifier[] = []
  for (const name of value) {
    if (!isModifier(name)) {
      throw new Refusal(
        'bad-step',
        `${at} holds ${String(name)}, which is not ${MODIFIERS.join(', ')}`,
      )
    }
    if (modifiers.includes(name)) {
      throw new Refusal('bad-step', `${at} holds ${name} twice`)
    }
    modifiers.push(name)
  }
  return modifiers.length > 0 ? { modifiers } : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
