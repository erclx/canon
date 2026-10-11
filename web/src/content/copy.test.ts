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
    expect(strings).toContain(copy.rules.head(7, 7))
    expect(strings).toContain(copy.skills.head(7))
    expect(strings).toContain(copy.field.commands(7, 7).used)
    expect(strings).toContain(copy.footer.columns[0]?.title)
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
