import type { Page } from 'playwright-core'
import {
  type ViewportSpec,
  type ViewportRefusal,
  resolveViewports,
} from '@/driver/probes/viewport'

/**
 * The interaction vocabulary a caller writes a run in, and the runner that
 * performs one step of it.
 *
 * It carries no pointer travel and no caption, since a measurement wants the
 * page in the next state as directly as the engine can put it there, and every
 * millisecond of travel is a millisecond a probe is not reading.
 */

/** How long a transition is given to finish before anything measures the result. */
const SETTLE_MS = 250

/**
 * The probes a step can ask for. A fixed catalog rather than the pluggable
 * subject system `@/inventory/subjects` carries, because every lesson behind
 * these was a probe running at the wrong moment or trusting the wrong signal,
 * rather than a probe a project needed to author for itself.
 */
export const PROBE_NAMES = [
  'focus',
  'details',
  'diagram-geometry',
  'diagram-strokes',
] as const

export type ProbeName = (typeof PROBE_NAMES)[number]

/**
 * One thing a probe measured and judged wrong. The step and the viewport are
 * filled in by the orchestrator rather than by the probe, since a probe runs
 * with no knowledge of which pass it is on and a finding is unreadable without
 * both. A `measured` row carries what a reader needs to check the judgment
 * without rerunning the probe.
 */
export interface Finding {
  readonly probe: ProbeName
  readonly selector: string
  readonly detail: string
  readonly measured: string
}

/** A finding once the run has said where it happened. */
export interface PlacedFinding extends Finding {
  readonly step: string
  readonly viewport: string
}

interface StepCommon {
  /** What the step did, carried onto every finding it produced. */
  readonly name: string
  /** Overrides the run-level list for this step alone. */
  readonly probes?: readonly ProbeName[]
}

export type DriverStep = StepCommon &
  (
    | { readonly kind: 'click'; readonly target: string }
    | { readonly kind: 'scroll'; readonly target: string }
    | { readonly kind: 'fill'; readonly target: string; readonly text: string }
    | { readonly kind: 'tab'; readonly count: number }
    | { readonly kind: 'wait'; readonly ms: number }
  )

export interface DriverPlan {
  /** Runs after every step that names no list of its own. */
  readonly probes: readonly ProbeName[]
  readonly viewports: readonly {
    readonly width: number
    readonly height: number
  }[]
  readonly steps: readonly DriverStep[]
}

export type PlanRefusal =
  | 'unreadable-plan'
  | 'no-steps'
  | 'no-probes'
  | 'unknown-probe'
  | 'bad-step'
  | ViewportRefusal

export type PlanRead =
  | { readonly kind: 'read'; readonly plan: DriverPlan }
  | {
      readonly kind: 'refused'
      readonly reason: PlanRefusal
      readonly detail: string
    }

function refused(reason: PlanRefusal, detail: string): PlanRead {
  return { kind: 'refused', reason, detail }
}

/**
 * Reads a run out of a JSON document. A file rather than a config key at the
 * project root, and JSON rather than the TOML `canon inventory` declares its
 * routes in, because a route catalog is state a project holds and an
 * interaction sequence is a script written for one question.
 */
export function readDriverPlan(source: string): PlanRead {
  let document: unknown
  try {
    document = JSON.parse(source)
  } catch (error) {
    return refused(
      'unreadable-plan',
      error instanceof Error ? error.message : String(error),
    )
  }

  if (typeof document !== 'object' || document === null) {
    return refused('unreadable-plan', 'the document is not an object')
  }

  const record = document as Record<string, unknown>

  const viewports = resolveViewports(
    record.viewport as ViewportSpec | undefined,
  )
  if (viewports.kind === 'refused') {
    return refused(viewports.reason, viewports.detail)
  }

  const probes = readProbeList(record.probes)
  if (typeof probes === 'string') return refused('unknown-probe', probes)
  if (probes.length === 0) {
    return refused(
      'no-probes',
      'probes names no probe, so every step would run and measure nothing',
    )
  }

  if (!Array.isArray(record.steps) || record.steps.length === 0) {
    return refused('no-steps', 'steps carries no entry, so nothing is driven')
  }

  const steps: DriverStep[] = []
  for (const [index, entry] of record.steps.entries()) {
    const step = readStep(entry, index)
    if (typeof step === 'string') return refused('bad-step', step)
    if (step.probes) {
      const named = readProbeList(step.probes)
      if (typeof named === 'string') return refused('unknown-probe', named)
      // Refused for the same reason the run-level list is. An empty list here
      // silently runs the step and measures nothing, and a pass reporting zero
      // findings is indistinguishable from one that looked.
      if (named.length === 0) {
        return refused(
          'no-probes',
          `${step.name} names an empty probe list, so the step would run and measure nothing`,
        )
      }
    }
    steps.push(step)
  }

  return {
    kind: 'read',
    plan: { probes, viewports: viewports.viewports, steps },
  }
}

/** Returns the parsed list, or the message naming what failed. */
function readProbeList(value: unknown): ProbeName[] | string {
  if (value === undefined) return [...PROBE_NAMES]
  if (!Array.isArray(value)) return 'probes is not a list'

  const names: ProbeName[] = []
  for (const entry of value) {
    if (!isProbeName(entry)) {
      return `no probe named ${String(entry)}. This build ships: ${PROBE_NAMES.join(', ')}.`
    }
    names.push(entry)
  }
  return names
}

function isProbeName(value: unknown): value is ProbeName {
  return typeof value === 'string' && PROBE_NAMES.includes(value as ProbeName)
}

/** Returns the parsed step, or the message naming what failed. */
function readStep(entry: unknown, index: number): DriverStep | string {
  const at = `step ${index + 1}`
  if (typeof entry !== 'object' || entry === null)
    return `${at} is not an object`

  const step = entry as Record<string, unknown>
  const name = typeof step.name === 'string' ? step.name : undefined
  if (!name) return `${at} carries no name, and a finding is attributed by it`

  const probes = step.probes as readonly ProbeName[] | undefined
  const common = { name, ...(probes ? { probes } : {}) }
  const target = typeof step.target === 'string' ? step.target : undefined

  switch (step.kind) {
    case 'click':
      if (!target) return `${at} is a click with no target`
      return { ...common, kind: 'click', target }
    case 'scroll':
      if (!target) return `${at} is a scroll with no target`
      return { ...common, kind: 'scroll', target }
    case 'fill':
      if (!target) return `${at} is a fill with no target`
      if (typeof step.text !== 'string') return `${at} is a fill with no text`
      return { ...common, kind: 'fill', target, text: step.text }
    case 'tab':
      return {
        ...common,
        kind: 'tab',
        count: typeof step.count === 'number' ? step.count : 1,
      }
    case 'wait':
      if (typeof step.ms !== 'number') return `${at} is a wait with no ms`
      return { ...common, kind: 'wait', ms: step.ms }
    default:
      return `${at} names kind ${String(step.kind)}, which is not click, scroll, fill, tab, or wait`
  }
}

/** The probes this step asks for, which is the run's list unless it names one. */
export function stepProbes(
  plan: DriverPlan,
  step: DriverStep,
): readonly ProbeName[] {
  return step.probes ?? plan.probes
}

/**
 * Performs one step and lets whatever it started settle. The settle is the
 * step's rather than each probe's, because a transition runs once and every
 * probe after it would otherwise pay for the same wait again.
 */
export async function runStep(page: Page, step: DriverStep): Promise<void> {
  switch (step.kind) {
    case 'click':
      await page.locator(step.target).first().click()
      break
    case 'scroll':
      await page.locator(step.target).first().scrollIntoViewIfNeeded()
      break
    case 'fill':
      await page.locator(step.target).first().fill(step.text)
      break
    case 'tab':
      for (let press = 0; press < step.count; press += 1) {
        await page.keyboard.press('Tab')
      }
      break
    case 'wait':
      await page.waitForTimeout(step.ms)
      return
  }

  await page.waitForTimeout(SETTLE_MS)
}
