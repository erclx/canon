import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { auditDesign } from '@/design/audit'

const roots: string[] = []

const words = (count: number): string =>
  Array.from({ length: count }, (_, index) => `w${index}`).join(' ')

function project(record: string | null, css?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'design-audit-'))
  roots.push(root)
  if (record !== null) {
    mkdirSync(join(root, 'canon'), { recursive: true })
    writeFileSync(join(root, 'canon', 'DESIGN.md'), record)
  }
  if (css !== undefined) {
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'tokens.css'), css)
  }
  return root
}

const record = (lead: string, rule = '- Keep it short.'): string =>
  [
    '# Design',
    lead,
    '## Colors',
    rule,
    '| Role | Property | Intent |',
    '| ---- | -------- | ------ |',
    '| accent | `--color-accent` | links |',
    '| ink | `--color-ink` | text |',
  ].join('\n\n')

const LEAD = 'Values live in `src/tokens.css`.'
const CSS = ':root { --color-accent: red; --color-ink: black; }'

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true })
})

describe('auditDesign', () => {
  it('passes a clean record whose properties the stylesheet declares', () => {
    const audit = auditDesign(project(record(LEAD), CSS))

    expect(audit.clean).toBe(true)
    expect(audit.prose).toEqual([])
    expect(audit.tokens).toMatchObject({ status: 'checked', missing: [] })
  })

  it('reports an over-budget lead and a 27-word rule with their counts', () => {
    const audit = auditDesign(
      project(record(`${LEAD} ${words(45)}`, `- ${words(27)}`), CSS),
    )

    expect(audit.clean).toBe(false)
    expect(audit.prose).toEqual([
      'The lead holds 49 words against a cap of 40',
      'Colors rule 1 holds 27 words against a cap of 25',
    ])
  })

  it('reports a table property the stylesheet does not declare', () => {
    const audit = auditDesign(
      project(record(LEAD), ':root { --color-accent: red; }'),
    )

    expect(audit.clean).toBe(false)
    expect(audit.tokens).toMatchObject({
      status: 'checked',
      missing: ['--color-ink'],
    })
  })

  it('reports the token check as unchecked where the lead names no stylesheet', () => {
    const audit = auditDesign(project(record('Values live elsewhere.'), CSS))

    expect(audit.clean).toBe(false)
    expect(audit.tokens).toMatchObject({ status: 'unchecked' })
  })

  it('reports the token check as unchecked where the named stylesheet is absent', () => {
    const audit = auditDesign(project(record(LEAD)))

    expect(audit.tokens).toMatchObject({ status: 'unchecked' })
    expect(audit.clean).toBe(false)
  })

  it('reads a project with no record as nothing to audit', () => {
    expect(auditDesign(project(null))).toMatchObject({
      record: null,
      tokens: null,
      clean: true,
    })
  })
})
