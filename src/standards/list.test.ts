import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/project-root'
import { listStandardEntries } from '@/standards/list'
import { appliesTo } from '@/standards/scope'

let ROOT: string

function writeStandard(name: string, description: string, scope: string): void {
  const path = join(ROOT, 'standards', `${name}.md`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    `---\ntitle: T\ndescription: ${description}\n---\n\n# T\n\n## Scope\n\n${scope}\n`,
  )
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-standards-list-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('listStandardEntries', () => {
  it('should list a project-local standard labeled by its root', () => {
    writeStandard('local-only-zz', 'Local rules', 'Applies to `src/a.ts`.')

    const entry = listStandardEntries(ROOT).find(
      (each) => each.name === 'local-only-zz',
    )

    expect(entry).toMatchObject({
      description: 'Local rules',
      appliesTo: ['src/a.ts'],
      source: join('standards', 'local-only-zz.md'),
    })
  })

  it('should list a local override of a package name once, from the local file', () => {
    writeStandard('markdown', 'Overridden', 'Applies to `x.md`.')

    const matches = listStandardEntries(ROOT).filter(
      (each) => each.name === 'markdown',
    )

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      description: 'Overridden',
      source: join('standards', 'markdown.md'),
    })
    expect(matches[0]?.content).toContain('Overridden')
  })

  it('should list a package standard from a project with no standards folder', () => {
    const entry = listStandardEntries(ROOT).find(
      (each) => each.name === 'markdown',
    )

    expect(entry?.source).toBe(join('<canon>', 'standards', 'markdown.md'))
  })

  it('should list each name once and spell the toolkit root without a label when both roots are one folder', () => {
    const entries = listStandardEntries(PROJECT_ROOT)
    const names = entries.map((each) => each.name)

    expect(new Set(names).size).toBe(names.length)
    expect(entries[0]?.source).toBe(join('standards', `${names[0]}.md`))
  })
})

describe('appliesTo', () => {
  it('should read backticked paths from the first scope sentence', () => {
    const text = '## Scope\n\nApplies to `a.md` and `b/*.md`. Not `c.md`.\n'

    expect(appliesTo(text)).toEqual(['a.md', 'b/*.md'])
  })

  it('should read an attribute standard as every path', () => {
    const text = '## Scope\n\nThis is an attribute standard, not a file.\n'

    expect(appliesTo(text)).toEqual(['*'])
  })

  it('should give nothing for a statement that parses to no path', () => {
    expect(appliesTo('## Scope\n\nGoverns prose.\n')).toEqual([])
  })

  it('should give nothing when the standard has no scope section', () => {
    expect(appliesTo('# T\n\nBody.\n')).toEqual([])
  })
})
