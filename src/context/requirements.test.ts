import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isOverWordCap,
  measureRequirements,
  readRequirementsWordCap,
  type RequirementsReport,
} from '@/context/requirements'

function makeReport(
  overrides: Partial<RequirementsReport> = {},
): RequirementsReport {
  return {
    rel: 'canon/REQUIREMENTS.md',
    words: 500,
    ...overrides,
  }
}

describe('reading the word cap a record states for itself', () => {
  it('should read a cap written in digits', () => {
    expect(readRequirementsWordCap('This record holds at most 600 words.')).toBe(
      600,
    )
  })

  it('should read nothing from a record stating no cap', () => {
    expect(
      readRequirementsWordCap('# Requirements\n\n## Worldview\n'),
    ).toBeUndefined()
  })
})

describe('the record word count against the cap', () => {
  it('should pass a record of exactly the cap', () => {
    expect(isOverWordCap(makeReport({ wordCap: 600, words: 600 }))).toBe(false)
  })

  it('should fail a record one word past the cap', () => {
    expect(isOverWordCap(makeReport({ wordCap: 600, words: 601 }))).toBe(true)
  })

  it('should never fail a record that states no cap', () => {
    expect(isOverWordCap(makeReport({ words: 9000 }))).toBe(false)
  })
})

describe('measuring the requirements record', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-requirements-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should report the cap and the word count of a record stating one', async () => {
    mkdirSync(join(root, 'canon'), { recursive: true })
    writeFileSync(
      join(root, 'canon', 'REQUIREMENTS.md'),
      '# Requirements\n\nThis record holds at most 600 words.\n',
    )

    const report = await measureRequirements(root)

    expect(report?.wordCap).toBe(600)
    expect(report?.words).toBe(9)
  })

  it('should report no cap for a record stating none', async () => {
    mkdirSync(join(root, 'canon'), { recursive: true })
    writeFileSync(join(root, 'canon', 'REQUIREMENTS.md'), '# Requirements\n')

    const report = await measureRequirements(root)

    expect(report?.wordCap).toBeUndefined()
  })

  it('should report nothing for a project carrying no record', async () => {
    expect(await measureRequirements(root)).toBeUndefined()
  })
})
