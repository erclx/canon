import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildRulesPayload, listRuleFiles } from '@/gov/payload'

let ROOT: string
let RULES: string

function writeRule(relToRoot: string, content: string): string {
  const path = join(RULES, relToRoot)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return path
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-gov-payload-'))
  RULES = join(ROOT, '.claude', 'rules')
  mkdirSync(RULES, { recursive: true })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('listRuleFiles', () => {
  it('should sort rules by path', () => {
    writeRule('core/testing.md', 'a')
    writeRule('core/000-const.md', 'b')
    writeRule('lang/100-ts.md', 'c')

    expect(listRuleFiles(RULES)).toEqual([
      join(RULES, 'core/000-const.md'),
      join(RULES, 'core/testing.md'),
      join(RULES, 'lang/100-ts.md'),
    ])
  })

  it('should include a rule at the root of the rules directory', () => {
    writeRule('900-loose.md', 'a')

    expect(listRuleFiles(RULES)).toEqual([join(RULES, '900-loose.md')])
  })
})

describe('buildRulesPayload', () => {
  it('should wrap each rule in a tag named after its file', () => {
    const file = writeRule('core/000-const.md', '---\ntitle: X\n---\n# Body\n')

    expect(buildRulesPayload([file])).toBe(
      '<rule name="000-const">\n# Body\n</rule>\n',
    )
  })

  it('should separate consecutive rules with one blank line', () => {
    const first = writeRule('core/000-a.md', '# A\n')
    const second = writeRule('core/010-b.md', '# B\n')

    expect(buildRulesPayload([first, second])).toBe(
      '<rule name="000-a">\n# A\n</rule>\n\n<rule name="010-b">\n# B\n</rule>\n',
    )
  })

  it('should trim blank lines from both ends of a rule body', () => {
    const file = writeRule('core/000-a.md', '---\nt: 1\n---\n\n\n# A\n\n\n')

    expect(buildRulesPayload([file])).toBe(
      '<rule name="000-a">\n# A\n</rule>\n',
    )
  })

  it('should preserve blank lines inside a rule body', () => {
    const file = writeRule('core/000-a.md', '# A\n\n## B\n')

    expect(buildRulesPayload([file])).toBe(
      '<rule name="000-a">\n# A\n\n## B\n</rule>\n',
    )
  })

  it('should produce a single trailing newline', () => {
    const file = writeRule('core/000-a.md', '# A\n')

    expect(buildRulesPayload([file]).endsWith('</rule>\n')).toBe(true)
  })
})
