import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveFrames } from '@/inventory/frames'
import { groupByTreatment } from '@/inventory/group'
import { findSubject } from '@/inventory/subjects'
import { walk } from '@/inventory/walk'

/**
 * Reads two board frame fixtures through the real walk, since what a value
 * subject reports depends on what the browser computes: the dark theme, a
 * pseudo-element's box, and a transition's duration exist nowhere else.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, the same as the route walk's suite. Run it locally.
 */

const FIXTURES = fileURLToPath(new URL('./fixtures/frames', import.meta.url))

const HERO = '01-hero/arm-1.html'
const CRAFT = '02-craft/arm-1.html'

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

async function read(subjectName: string) {
  const subject = findSubject(subjectName)
  const frames = resolveFrames([HERO, CRAFT], FIXTURES)
  if (!subject || frames.kind !== 'resolved') {
    throw new Error(`fixture setup failed for ${subjectName}`)
  }
  const result = await walk({
    targets: frames.frames,
    subject,
    query: '',
    frames: true,
  })
  if (result.status !== 'read') throw new Error(result.message)
  return { result, groups: groupByTreatment(result.readings) }
}

const valuesOf = (groups: readonly { treatment: string }[]): string[] =>
  groups.map((group) => group.treatment).sort()

describe.skipIf(!hasBrowser)('walk over board frames', () => {
  it('should read every frame light and then dark, under distinct labels', async () => {
    const { result } = await read('font-size')

    expect(result.targets.map((target) => target.location)).toEqual([
      HERO,
      `${HERO} (dark)`,
      CRAFT,
      `${CRAFT} (dark)`,
    ])
  }, 120_000)

  it('should count font size only where an element carries its own text', async () => {
    const { groups } = await read('font-size')

    expect(valuesOf(groups)).toEqual(['16px', '17px', '19px', '90px'])
  }, 120_000)

  it('should count a text input, which holds no text node, as carrying text', async () => {
    const { groups } = await read('color')

    const field = groups.find((group) => group.treatment === '#e6e6e6')
    expect(field?.samples).toEqual(['input', 'input'])
  }, 120_000)

  it('should read both themes, a pseudo-element, and skip transparent', async () => {
    const { groups } = await read('color')

    expect(valuesOf(groups)).toEqual([
      '#121211',
      '#121212',
      '#c2380e',
      '#e6e6e6',
      '#f2f2f0',
      '#ff6b42',
      '#ffffff',
    ])
    const accent = groups.find((group) => group.treatment === '#ff6b42')
    expect(accent?.samples).toEqual(['div.card::after'])
  }, 120_000)

  it('should read a pseudo-element radius beside the element radius', async () => {
    const { groups } = await read('radius')

    expect(valuesOf(groups)).toEqual(['12px', '2px'])
  }, 120_000)

  it('should write a computed shadow in the form the record normalizes to', async () => {
    const { groups } = await read('shadow')

    expect(valuesOf(groups)).toEqual(['rgba(0, 0, 0, 0.07) 0px 0px 0px 1px'])
  }, 120_000)

  it('should read transition durations in milliseconds', async () => {
    const { groups } = await read('duration')

    expect(valuesOf(groups)).toEqual(['120ms', '400ms'])
  }, 120_000)
})
