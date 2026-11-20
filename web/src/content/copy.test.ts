import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import * as copy from './copy'

const SAMPLE_COUNTS = [0, 1, 7]

function collectStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    found.push(value)
  } else if (typeof value === 'function') {
    const build = value as (...args: number[]) => unknown
    for (const count of SAMPLE_COUNTS) {
      collectStrings(build(count, count), found)
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, found)
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, found)
  }
  return found
}

describe('copy', () => {
  const strings = collectStrings(copy)

  it('should read every exported string, including those built from counts', () => {
    expect(strings).toContain(copy.guardrails.parts[1]?.verdict)
    expect(strings).toContain(copy.install.stages[0]?.line)
    expect(strings).toContain(copy.footer.read[0]?.label)
  })

  it('should carry no em dash in any string', () => {
    const offenders = strings.filter((text) => text.includes('—'))

    expect(offenders).toEqual([])
  })

  it('should carry no semicolon in any string', () => {
    const offenders = strings.filter((text) => text.includes(';'))

    expect(offenders).toEqual([])
  })
})

describe('worktreeCards', () => {
  it('should light only a folder the band names on every card', () => {
    const strays = copy.worktreeCards.filter(
      (card) => !copy.worktrees.band.dirs.includes(card.dir),
    )

    expect(copy.worktreeCards.length).toBeGreaterThan(0)
    expect(strays).toEqual([])
  })
})

describe('evidence', () => {
  it('should carry one checklist line per beat the film plan films', () => {
    const plan = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../film-plan.json'), 'utf8'),
    ) as { beats: unknown[] }

    expect(copy.evidence.checks).toHaveLength(plan.beats.length)
  })
})
