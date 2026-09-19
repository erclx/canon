import type { Beat, Draft } from '@/demo/beats'

/**
 * Turns the human-facing draft into the machine-facing plan. The two are
 * separate artifacts on purpose: a beat carries no target, no wait condition,
 * and no timing, and putting those four fields on every beat would destroy the
 * property the draft was designed around. See
 * `.canon/groundwork/38-demo-recorder/06-decision.md`.
 *
 * A compiled plan is committed rather than scratch, because the timing below is
 * a starting point the operator tunes and the draft cannot reproduce a tuned
 * value.
 */

/** Hand-tuned in spike 2 against one fixture. Nothing establishes them in general. */
const POINTER_TRAVEL_MS = 400
const TYPE_DELAY_MS = 110
const HOLD_MS = 600
const FINAL_HOLD_MS = 1200

/**
 * A step is a round trip to the browser, so a fixed count reproduces the
 * defect under a new name if it does not respond to the round-trip cost
 * measured at drive time. The bounds guard the extremes a bad measurement
 * could produce: too few steps teleports rather than glides, and a
 * near-zero measured cost cannot be trusted enough to let the count run
 * away.
 *
 * Measured on 2026-08-26 against a served fixture, post-navigation: 10
 * rounds of `page.mouse.move` averaged 16.6 milliseconds a step, well short
 * of either bound at the 400 millisecond default (about 24 steps). A
 * machine landing under `POINTER_TRAVEL_MS / MAX_POINTER_STEPS`, 3.33
 * milliseconds a step here, hits the cap and stops responding to a faster
 * one still. Nothing measured here establishes where a real machine sits
 * relative to that boundary in general.
 */
export const MIN_POINTER_STEPS = 6
export const MAX_POINTER_STEPS = 120

/**
 * Pure on purpose: the round-trip cost comes from a real browser and can
 * only be measured at drive time, so this takes it as an argument rather
 * than measuring it itself, which is what keeps it testable against a
 * stubbed cost.
 */
export function deriveSteps(travelMs: number, roundTripMs: number): number {
  if (roundTripMs <= 0) return MAX_POINTER_STEPS
  const steps = Math.round(travelMs / roundTripMs)
  return Math.min(MAX_POINTER_STEPS, Math.max(MIN_POINTER_STEPS, steps))
}

const VIEWPORT = { width: 1280, height: 720 } as const
const ANNOTATIONS = {
  durationMs: 900,
  position: 'bottom-right',
  fontSize: 22,
} as const

export type StepKind =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'hover'
  | 'scroll'
  | 'wait'
  | 'hold'

/** Verbs that point at an element, so a plan without a target cannot run. */
const TARGETED: ReadonlySet<StepKind> = new Set<StepKind>([
  'click',
  'fill',
  'hover',
  'scroll',
])

const VERBS: Record<string, StepKind> = {
  navigate: 'navigate',
  open: 'navigate',
  visit: 'navigate',
  load: 'navigate',
  click: 'click',
  press: 'click',
  tap: 'click',
  submit: 'click',
  toggle: 'click',
  type: 'fill',
  fill: 'fill',
  enter: 'fill',
  input: 'fill',
  hover: 'hover',
  scroll: 'scroll',
  wait: 'wait',
  pause: 'wait',
  settle: 'wait',
}

export interface DemoStep {
  readonly beat: number
  readonly name: string
  readonly kind: StepKind
  readonly target: string
  readonly text: string
  readonly waitFor: string
  readonly holdMs: number
  readonly caption: string
  readonly still: boolean
  readonly note?: string
}

export type ColorScheme = 'light' | 'dark'

export interface DemoPlan {
  readonly slug: string
  readonly title: string
  readonly url: string
  readonly viewport: { readonly width: number; readonly height: number }
  readonly colorScheme?: ColorScheme
  readonly output: { readonly video: string; readonly still: string }
  readonly pointer: { readonly travelMs: number; readonly typeDelayMs: number }
  readonly annotations: typeof ANNOTATIONS
  readonly steps: readonly DemoStep[]
}

export interface CompileOptions {
  readonly slug: string
  readonly outDir: string
}

export function compilePlan(draft: Draft, options: CompileOptions): DemoPlan {
  const stillAt = heroIndex(draft.beats)
  return {
    slug: options.slug,
    title: draft.title,
    url: '',
    viewport: VIEWPORT,
    output: {
      video: `${options.outDir}/${options.slug}.webm`,
      still: `${options.outDir}/${options.slug}.png`,
    },
    pointer: { travelMs: POINTER_TRAVEL_MS, typeDelayMs: TYPE_DELAY_MS },
    annotations: ANNOTATIONS,
    steps: draft.beats.map((beat, position) =>
      compileStep(beat, {
        still: position === stillAt,
        last: position === draft.beats.length - 1,
      }),
    ),
  }
}

function compileStep(
  beat: Beat,
  place: { still: boolean; last: boolean },
): DemoStep {
  const verb = firstVerb(beat.action)
  const kind = verb ? VERBS[verb] : undefined
  const step: DemoStep = {
    beat: beat.index,
    name: beat.name,
    kind: kind ?? 'hold',
    target: '',
    text: '',
    waitFor: '',
    holdMs: place.last ? FINAL_HOLD_MS : HOLD_MS,
    caption: beat.caption,
    still: place.still,
  }

  if (kind) return step
  return {
    ...step,
    note: `no step maps to the verb "${beat.action.trim()}", so this beat only waits`,
  }
}

/**
 * The draft specifies one verb per beat, and a hand-edited beat reads as a
 * phrase often enough that matching only the whole field would refuse work a
 * reader can see is a click. The first recognized word wins.
 */
function firstVerb(action: string): string | undefined {
  return action
    .toLowerCase()
    .split(/[^a-z]+/)
    .find((word) => word in VERBS)
}

/**
 * The still is a landing frame, so it wants the beat the draft calls the hero
 * rather than an arbitrary one. Falling back to the last beat rather than the
 * first is deliberate: a demo's final state is the payoff, and a cold open is
 * usually an empty screen.
 */
function heroIndex(beats: readonly Beat[]): number {
  const named = beats.findIndex((beat) => /hero/i.test(beat.name))
  return named === -1 ? beats.length - 1 : named
}

export type PlanParse =
  | { status: 'parsed'; plan: DemoPlan }
  | { status: 'failed'; reason: string }

/**
 * Validates a plan read off disk. The file is hand-edited between being
 * compiled and being run, which is the whole reason it is committed rather than
 * regenerated, so every field is checked here rather than trusted.
 *
 * An absent field takes the seeded default and a present one is kept, so a
 * plan that dropped a timing block still runs while a tuned one is never
 * overwritten.
 */
export function parsePlan(text: string): PlanParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'unreadable json',
    }
  }

  if (!isRecord(raw)) return { status: 'failed', reason: 'not a json object' }
  if (!Array.isArray(raw.steps))
    return { status: 'failed', reason: 'steps is not an array' }
  if (!raw.steps.length) return { status: 'failed', reason: 'steps is empty' }

  const steps: DemoStep[] = []
  for (const [index, entry] of raw.steps.entries()) {
    const step = parseStep(entry, index)
    if ('reason' in step) return { status: 'failed', reason: step.reason }
    steps.push(step.step)
  }

  const colorScheme = parseColorScheme(raw.colorScheme)
  if (colorScheme.status === 'failed') return colorScheme

  const slug = asText(raw.slug)
  const output = isRecord(raw.output) ? raw.output : {}
  const pointer = isRecord(raw.pointer) ? raw.pointer : {}
  const viewport = isRecord(raw.viewport) ? raw.viewport : {}

  return {
    status: 'parsed',
    plan: {
      slug,
      title: asText(raw.title),
      url: asText(raw.url),
      viewport: {
        width: asNumber(viewport.width, VIEWPORT.width),
        height: asNumber(viewport.height, VIEWPORT.height),
      },
      ...(colorScheme.value && { colorScheme: colorScheme.value }),
      output: {
        video: asText(output.video) || `demos/${slug || 'demo'}.webm`,
        still: asText(output.still) || `demos/${slug || 'demo'}.png`,
      },
      pointer: {
        travelMs: asNumber(pointer.travelMs, POINTER_TRAVEL_MS),
        typeDelayMs: asNumber(pointer.typeDelayMs, TYPE_DELAY_MS),
      },
      annotations: ANNOTATIONS,
      steps,
    },
  }
}

function parseColorScheme(
  value: unknown,
):
  | { status: 'ok'; value?: ColorScheme }
  | { status: 'failed'; reason: string } {
  if (value === undefined) return { status: 'ok' }
  if (value === 'light' || value === 'dark') return { status: 'ok', value }
  return {
    status: 'failed',
    reason: `colorScheme is ${JSON.stringify(value)}, which is not light or dark`,
  }
}

function parseStep(
  entry: unknown,
  index: number,
): { step: DemoStep } | { reason: string } {
  if (!isRecord(entry)) return { reason: `steps[${index}] is not an object` }

  const kind = asText(entry.kind)
  if (!isStepKind(kind)) {
    return {
      reason: `steps[${index}].kind is "${kind}", which is not a step this can drive`,
    }
  }

  const step: DemoStep = {
    beat: asNumber(entry.beat, index + 1),
    name: asText(entry.name),
    kind,
    target: asText(entry.target),
    text: asText(entry.text),
    waitFor: asText(entry.waitFor),
    holdMs: asNumber(entry.holdMs, HOLD_MS),
    caption: asText(entry.caption),
    still: entry.still === true,
  }
  const note = asText(entry.note)
  return { step: note ? { ...step, note } : step }
}

function isStepKind(value: string): value is StepKind {
  return (
    value === 'navigate' ||
    value === 'click' ||
    value === 'fill' ||
    value === 'hover' ||
    value === 'scroll' ||
    value === 'wait' ||
    value === 'hold'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Names every field a person still has to fill before the plan can drive
 * anything. Compile reports these and run refuses on them, so an unfilled plan
 * fails at the point it is written rather than part-way through a recording.
 */
export function unresolved(plan: DemoPlan): string[] {
  const missing: string[] = plan.url.trim() ? [] : ['url']
  plan.steps.forEach((step, index) => {
    if (TARGETED.has(step.kind) && !step.target.trim()) {
      missing.push(`steps[${index}].target`)
    }
  })
  return missing
}
