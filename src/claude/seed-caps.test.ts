import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readEntryCap, readRiskCap, readWordCap } from '@/context/architecture'
import { readRequirementsWordCap } from '@/context/requirements'
import { bodyLines } from '@/markdown/scan'

const ROOT = join(import.meta.dirname, '..', '..')

// No gate reads the seeds against the cap readers, so a clause respelled in a
// seed leaves every new target uncapped while the whole check stays green.
// These read the real files rather than stand-ins for that reason.
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

/**
 * The prose line stating the record's caps, fenced and commented lines left
 * out, since a clause in either is not one the record adopted.
 */
function capLine(source: string): string | undefined {
  return bodyLines(source).find(
    (line) =>
      !line.fenced &&
      !line.text.trimStart().startsWith('<!--') &&
      line.text.startsWith('This record holds at most'),
  )?.text
}

/** The body of a standard's first fenced `markdown` block, its template. */
function template(source: string): string {
  return source.match(/```markdown\n([\s\S]*?)\n```/)?.[1] ?? ''
}

describe('architecture seed', () => {
  const seed = read('tooling/claude/seeds/canon/ARCHITECTURE.md')

  it('should state all three caps on one prose line', () => {
    const line = capLine(seed) ?? ''

    expect({
      entry: readEntryCap(line),
      words: readWordCap(line),
      risks: readRiskCap(line),
    }).toEqual({ entry: 12, words: 150, risks: 6 })
  })

  it('should state the caps the standard template states', () => {
    const line = capLine(seed)

    expect(line).toBeDefined()
    expect(template(read('standards/architecture.md'))).toContain(line)
  })
})

describe('requirements seed', () => {
  const seed = read('tooling/claude/seeds/canon/REQUIREMENTS.md')

  it('should state the word cap on a prose line', () => {
    expect(readRequirementsWordCap(capLine(seed) ?? '')).toBe(600)
  })

  it('should state the cap the standard template states', () => {
    const line = capLine(seed)

    expect(line).toBeDefined()
    expect(template(read('standards/requirements.md'))).toContain(line)
  })
})
