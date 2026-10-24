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

const themed = (themes: string[]): string =>
  ['---', 'themes:', ...themes.map((theme) => `  - ${theme}`), '---', ''].join(
    '\n',
  ) + record(LEAD)

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

  it('reads a values record with no Property column as not applicable', () => {
    const values = [
      '# Design',
      'Rendered from `src/design/tokens.ts`.',
      '## Colors',
      '| Role | Intent | Value |',
      '| ---- | ------ | ----- |',
      '| accent | links | #2255cc |',
    ].join('\n\n')

    const audit = auditDesign(project(values))

    expect(audit.tokens).toMatchObject({ status: 'not-applicable' })
    expect(audit.clean).toBe(true)
  })

  it('returns no themes key for a record that declares none', () => {
    const audit = auditDesign(project(record(LEAD), CSS))

    expect(audit.tokens).not.toHaveProperty('themes')
  })

  it('reports a dark theme missing a property under its selector', () => {
    const css = `${CSS}\n:root[data-theme='dark'] { --color-accent: pink; }`
    const audit = auditDesign(
      project(themed(["':root'", '":root[data-theme=\'dark\']"']), css),
    )

    expect(audit.clean).toBe(false)
    expect(audit.tokens).toMatchObject({
      status: 'checked',
      missing: [],
      themes: [
        { selector: ':root', matched: true, missing: [] },
        {
          selector: ":root[data-theme='dark']",
          matched: true,
          missing: ['--color-ink'],
        },
      ],
    })
  })

  it('reports a declared selector that matches no block', () => {
    const audit = auditDesign(project(themed(["':root'", "'.night'"]), CSS))

    expect(audit.clean).toBe(false)
    expect(audit.tokens).toMatchObject({
      themes: [
        { selector: ':root', matched: true },
        { selector: '.night', matched: false },
      ],
    })
  })

  it('credits a root inside a declared media query to the query alone', () => {
    const media = '@media (prefers-color-scheme: dark)'
    const css = `${CSS}\n${media} { :root { --color-accent: pink; } }`
    const audit = auditDesign(project(themed(["':root'", `'${media}'`]), css))

    expect(audit.tokens).toMatchObject({
      themes: [
        { selector: ':root', matched: true, missing: [] },
        { selector: media, matched: true, missing: ['--color-ink'] },
      ],
    })
  })

  it('matches each member of a selector list and ignores quote style', () => {
    const css = `:root, .light { --color-accent: red; --color-ink: black; }\n[data-theme="dark"] { --color-accent: a; --color-ink: b; }`
    const audit = auditDesign(
      project(themed(["'.light'", '"[data-theme=\'dark\']"']), css),
    )

    expect(audit.tokens).toMatchObject({
      themes: [
        { selector: '.light', matched: true, missing: [] },
        { selector: "[data-theme='dark']", matched: true, missing: [] },
      ],
    })
  })

  it('credits every declared member of one selector list', () => {
    const css = ':root, .light { --color-accent: red; --color-ink: black; }'
    const audit = auditDesign(project(themed(["':root'", "'.light'"]), css))

    expect(audit.clean).toBe(true)
    expect(audit.tokens).toMatchObject({
      themes: [
        { selector: ':root', matched: true },
        { selector: '.light', matched: true },
      ],
    })
  })

  it('reads a flow-style themes list', () => {
    const css = `${CSS}\n.dark { --color-accent: pink; }`
    const source = `---\nthemes: [':root', ".dark"]\n---\n${record(LEAD)}`
    const audit = auditDesign(project(source, css))

    expect(audit.tokens).toMatchObject({
      themes: [
        { selector: ':root', matched: true, missing: [] },
        { selector: '.dark', matched: true, missing: ['--color-ink'] },
      ],
    })
  })

  it('drops a trailing comment from a list item', () => {
    const source = `---\nthemes:\n  - ':root' # light\n  - .dark # night\n---\n${record(LEAD)}`
    const css = `${CSS}\n.dark { --color-accent: a; --color-ink: b; }`
    const audit = auditDesign(project(source, css))

    expect(audit.tokens).toMatchObject({
      themes: [
        { selector: ':root', matched: true },
        { selector: '.dark', matched: true },
      ],
    })
  })

  it('does not match a bare root to a root with an attribute', () => {
    const css = `:root[data-theme='dark'] { --color-accent: a; --color-ink: b; }`
    const audit = auditDesign(project(themed(["':root'"]), css))

    expect(audit.tokens).toMatchObject({
      themes: [{ selector: ':root', matched: false }],
    })
  })

  it('matches a declared Tailwind theme block like any other prelude', () => {
    const css = '@theme { --color-accent: red; --color-ink: black; }'
    const audit = auditDesign(project(themed(["'@theme'"]), css))

    expect(audit.clean).toBe(true)
  })

  it('reads a project with no record as nothing to audit', () => {
    expect(auditDesign(project(null))).toMatchObject({
      record: null,
      tokens: null,
      clean: true,
    })
  })
})
