import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drive } from '@/driver/drive'
import { readDriverPlan, stepProbes } from '@/driver/steps'
import type { DriverPlan, DriverStep } from '@/driver/steps'

/**
 * Covers the two decisions the orchestrator makes before a browser is involved:
 * what the run document said, and which probes each step is owed. Both are pure
 * over their inputs, so they pin here rather than in the e2e suite, where a
 * launch failure would hide a parsing defect.
 */

const VIEWPORT = { width: 1440, heights: [900] }

function planSource(body: Record<string, unknown>): string {
  return JSON.stringify({ viewport: VIEWPORT, ...body })
}

const ONE_STEP = [{ name: 'open the menu', kind: 'click', target: '#menu' }]

describe('readDriverPlan', () => {
  it('should read the viewports, the probes, and the steps it names', () => {
    const read = readDriverPlan(
      planSource({ probes: ['focus'], steps: ONE_STEP }),
    )

    expect(read.kind).toBe('read')
    if (read.kind !== 'read') return
    expect(read.plan.viewports).toEqual([{ width: 1440, height: 900 }])
    expect(read.plan.probes).toEqual(['focus'])
    expect(read.plan.steps[0]).toEqual({
      name: 'open the menu',
      kind: 'click',
      target: '#menu',
    })
  })

  it('should run every probe but axe when the document names no list', () => {
    const read = readDriverPlan(planSource({ steps: ONE_STEP }))

    expect(read.kind).toBe('read')
    if (read.kind !== 'read') return
    expect(read.plan.probes).toEqual([
      'focus',
      'details',
      'diagram-geometry',
      'diagram-strokes',
    ])
  })

  it('should run axe when the document names it', () => {
    const read = readDriverPlan(
      planSource({ probes: ['axe'], steps: ONE_STEP }),
    )

    expect(read).toMatchObject({ kind: 'read', plan: { probes: ['axe'] } })
  })

  it('should refuse text that is not JSON', () => {
    const read = readDriverPlan('{ not json')

    expect(read).toMatchObject({ kind: 'refused', reason: 'unreadable-plan' })
  })

  it('should refuse a run carrying no step', () => {
    const read = readDriverPlan(planSource({ steps: [] }))

    expect(read).toMatchObject({ kind: 'refused', reason: 'no-steps' })
  })

  it('should refuse an empty probe list rather than measuring nothing', () => {
    const read = readDriverPlan(planSource({ probes: [], steps: ONE_STEP }))

    expect(read).toMatchObject({ kind: 'refused', reason: 'no-probes' })
  })

  it('should name the probes it ships when the run asks for one it does not', () => {
    const read = readDriverPlan(
      planSource({ probes: ['contrast'], steps: ONE_STEP }),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'unknown-probe' })
    if (read.kind !== 'refused') return
    expect(read.detail).toContain('diagram-strokes')
  })

  it('should refuse an empty probe list a single step names', () => {
    // The run-level empty list already refuses. A step-level one that did not
    // would run the step and measure nothing, and a pass reporting no findings
    // reads the same as one that looked.
    const read = readDriverPlan(
      planSource({ steps: [{ ...ONE_STEP[0], probes: [] }] }),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'no-probes' })
  })

  it('should refuse an unknown probe a single step names', () => {
    const read = readDriverPlan(
      planSource({
        steps: [{ ...ONE_STEP[0], probes: ['contrast'] }],
      }),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'unknown-probe' })
  })

  it('should refuse a step with no name, since a finding is attributed by it', () => {
    const read = readDriverPlan(
      planSource({ steps: [{ kind: 'click', target: '#menu' }] }),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should refuse a click with no target', () => {
    const read = readDriverPlan(
      planSource({ steps: [{ name: 'press it', kind: 'click' }] }),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should refuse a kind outside the vocabulary', () => {
    const read = readDriverPlan(
      planSource({ steps: [{ name: 'hover it', kind: 'hover', target: 'a' }] }),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-step' })
    if (read.kind !== 'refused') return
    expect(read.detail).toContain('hover')
  })

  it('should default a tab step to one press', () => {
    const read = readDriverPlan(
      planSource({ steps: [{ name: 'advance focus', kind: 'tab' }] }),
    )

    expect(read.kind).toBe('read')
    if (read.kind !== 'read') return
    expect(read.plan.steps[0]).toMatchObject({ kind: 'tab', count: 1 })
  })
})

describe('stepProbes', () => {
  const plan: DriverPlan = {
    probes: ['focus', 'details'],
    viewports: [{ width: 1440, height: 900 }],
    steps: [],
  }

  it('should fall to the run list where a step names none', () => {
    const step: DriverStep = { name: 'open', kind: 'click', target: '#menu' }

    expect(stepProbes(plan, step)).toEqual(['focus', 'details'])
  })

  it('should take the step list over the run list where it names one', () => {
    const step: DriverStep = {
      name: 'reach the diagram',
      kind: 'scroll',
      target: 'figure',
      probes: ['diagram-strokes'],
    }

    expect(stepProbes(plan, step)).toEqual(['diagram-strokes'])
  })
})

/**
 * Launches fake browsers, so the refusal is proved with no AppArmor and no
 * Chromium. A real start never gets past the launch here, and a reworded box
 * in a later engine falls this case back to `drive-failed`.
 */
describe('drive', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'canon-drive-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function fake(name: string, body: string): string {
    const path = join(dir, name)
    writeFileSync(path, `#!/bin/sh\n${body}\n`)
    chmodSync(path, 0o755)
    return path
  }

  const plan: DriverPlan = {
    viewports: [{ width: 800, height: 600 }],
    probes: ['focus'],
    steps: [{ name: 'hold', kind: 'wait', ms: 0 }],
  }

  it('should refuse as sandbox-blocked when the browser finds no usable sandbox', async () => {
    const executablePath = fake(
      'sandboxed',
      "echo '[1112/101500.000000:FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox!' >&2\nexit 1",
    )

    const result = await drive({ url: 'about:blank', plan, executablePath })

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'sandbox-blocked',
    })
  })

  it('should refuse as drive-failed when the browser dies for another reason', async () => {
    const executablePath = fake(
      'broken',
      "echo 'error while loading shared libraries: libnss3.so' >&2\nexit 1",
    )

    const result = await drive({ url: 'about:blank', plan, executablePath })

    expect(result).toMatchObject({ status: 'failed', reason: 'drive-failed' })
  })
})
