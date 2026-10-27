/**
 * The take plan: the beats a take films, each a list of steps. It reuses
 * `canon drive`'s kind names for the steps the two share and adds `move`,
 * since a take films the pointer's travel and a drive skips it. `tab` is left
 * out because a take draws its cursor from the log, and focus moved by the
 * keyboard leaves nothing in the log to draw.
 */

import { MODIFIERS, type Modifier, isModifier, parseKeys } from '@/take/keys'

/** How a beat is filmed: frame stepping, or Playwright's real-time screencast. */
export const ROUTES = ['step', 'screencast'] as const

export type Route = (typeof ROUTES)[number]

/** The keys held through a press, absent when none is. */
interface Held {
  readonly modifiers?: readonly Modifier[]
}

export type TakeStep =
  | { readonly kind: 'move'; readonly target: string }
  | { readonly kind: 'move'; readonly x: number; readonly y: number }
  | ({ readonly kind: 'click'; readonly target: string } & Held)
  | ({ readonly kind: 'dblclick'; readonly target: string } & Held)
  | ({
      readonly kind: 'drag'
      readonly from: string
      readonly to: string
    } & Held)
  | { readonly kind: 'key'; readonly keys: string }
  | { readonly kind: 'fill'; readonly target: string; readonly text: string }
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
  /** Runs after the page loads and before the first frame is kept. */
  readonly setup: readonly TakeStep[]
  readonly steps: readonly TakeStep[]
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

  return {
    name,
    route: route as Route,
    ...(entry.push === false ? { push: false as const } : {}),
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
  const needTarget = (): string => {
    if (target) return target
    throw new Refusal('bad-step', `${at} is a ${entry.kind} with no target`)
  }

  switch (entry.kind) {
    case 'move':
      if (target) return { kind: 'move', target }
      if (isNumber(entry.x) && isNumber(entry.y)) {
        return { kind: 'move', x: entry.x, y: entry.y }
      }
      throw new Refusal(
        'bad-step',
        `${at} is a move with neither a target nor an x and y`,
      )
    case 'click':
    case 'dblclick':
      return {
        kind: entry.kind,
        target: needTarget(),
        ...readModifiers(entry.modifiers, at),
      }
    case 'drag':
      if (typeof entry.from !== 'string' || !entry.from) {
        throw new Refusal('bad-step', `${at} is a drag with no from target`)
      }
      if (typeof entry.to !== 'string' || !entry.to) {
        throw new Refusal('bad-step', `${at} is a drag with no to target`)
      }
      return {
        kind: 'drag',
        from: entry.from,
        to: entry.to,
        ...readModifiers(entry.modifiers, at),
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
      return { kind: 'fill', target: needTarget(), text: entry.text }
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
