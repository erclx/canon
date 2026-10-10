import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildCatalog, renderCatalog } from '@/upstream/catalog'

const CHECKOUT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

let ROOT: string

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

function skill(corpus: string, name: string, description: string): void {
  write(
    `${corpus}/${name}/SKILL.md`,
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
  )
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-catalog-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('buildCatalog', () => {
  it('should fill every section from the checkout', () => {
    const catalog = buildCatalog(CHECKOUT)

    expect(catalog.skills.length).toBeGreaterThan(0)
    expect(catalog.internalSkills.length).toBeGreaterThan(0)
    expect(catalog.verbs.length).toBeGreaterThan(0)
    expect(catalog.hooks.length).toBeGreaterThan(0)
    expect(catalog.gate.length).toBeGreaterThan(0)
  })

  it('should list a skill added to a temp tree under its corpus', () => {
    skill('claude/skills', 'fresh-one', 'Does a fresh thing. And more.')
    skill('.claude/skills', 'internal-fresh', 'Internal thing')

    const catalog = buildCatalog(ROOT)

    expect(catalog.skills).toEqual([
      { name: 'fresh-one', text: 'Does a fresh thing' },
    ])
    expect(catalog.internalSkills).toEqual([
      { name: 'internal-fresh', text: 'Internal thing' },
    ])
  })

  it('should report a skill with no description rather than dropping the row', () => {
    skill('claude/skills', 'bare', '')

    const catalog = buildCatalog(ROOT)

    expect(catalog.skills).toEqual([{ name: 'bare', text: '' }])
    expect(catalog.gaps).toContain('claude/skills/bare: no description')
  })

  it('should report a skill folder with no SKILL.md', () => {
    mkdirSync(join(ROOT, 'claude/skills/hollow'), { recursive: true })

    const catalog = buildCatalog(ROOT)

    expect(catalog.gaps).toContain('claude/skills/hollow: no SKILL.md')
  })

  it('should take a hook description from its first comment line', () => {
    write(
      '.claude/hooks/guard.sh',
      '#!/usr/bin/env bash\n\n# Stops a write to scratch.\n#\n# More.\nexit 0\n',
    )

    const catalog = buildCatalog(ROOT)

    expect(catalog.hooks).toEqual([
      { name: 'guard.sh', text: 'Stops a write to scratch.' },
    ])
  })
})

describe('renderCatalog', () => {
  it('should render a heading per section and one line per entry', () => {
    skill('claude/skills', 'fresh-one', 'Does a thing')

    const out = renderCatalog(buildCatalog(ROOT))

    expect(out).toContain('### Plugin skills (claude/skills/)')
    expect(out).toContain('- fresh-one: Does a thing')
    expect(out).toContain('### CLI verbs')
    expect(out).toContain('### Gate')
  })
})
