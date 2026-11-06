import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computeIndex } from '@/indexes/render'

let root: string

function writeIndex(dir: string, title: string, subtitle: string): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.md'),
    `---\ntitle: ${title}\nsubtitle: ${subtitle}\n---\n\nplaceholder\n`,
  )
}

function writeEntry(
  dir: string,
  name: string,
  fields: Record<string, string>,
): void {
  const block = Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  writeFileSync(join(dir, name), `---\n${block}\n---\n\nbody\n`)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-render-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('computeIndex', () => {
  it('should report invalid YAML and no missing field for a block that will not parse', async () => {
    writeIndex(root, 'Tasks', 'One line each')
    writeEntry(root, 'bad.md', {
      title: "'Trim the Board's ad page'",
      description: 'Demo',
    })

    const result = await computeIndex(root)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(
      `frontmatter is not valid YAML in ${join(root, 'bad.md')}: `,
    )
  })

  it('should still report the missing fields for a file with no block', async () => {
    writeIndex(root, 'Tasks', 'One line each')
    writeFileSync(join(root, 'bare.md'), '# Heading\n')

    const result = await computeIndex(root)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain(
      'missing frontmatter field "title"',
    )
    expect(result.errors.join('\n')).not.toContain('not valid YAML')
  })

  it('should render a flat list when no sibling declares a category', async () => {
    writeIndex(root, 'Wiki', 'Reference pages')
    writeEntry(root, 'alpha.md', { title: 'Alpha', description: 'First page' })
    writeEntry(root, 'beta.md', { title: 'Beta', description: 'Second page' })

    const result = await computeIndex(root)

    expect(result).toEqual({
      ok: true,
      content:
        '---\ntitle: Wiki\nsubtitle: Reference pages\n---\n\n# Wiki\n\nReference pages\n\n' +
        '- [Alpha](alpha.md): First page\n- [Beta](beta.md): Second page\n',
    })
  })

  it('should group entries under sorted category headings', async () => {
    writeIndex(root, 'Docs', 'One line each')
    writeEntry(root, 'one.md', {
      title: 'One',
      description: 'First',
      category: 'Zebra',
    })
    writeEntry(root, 'two.md', {
      title: 'Two',
      description: 'Second',
      category: 'Alpha',
    })

    const result = await computeIndex(root)

    expect(result.ok && result.content).toContain(
      '## Alpha\n\n- [Two](two.md): Second\n\n## Zebra\n\n- [One](one.md): First\n',
    )
  })

  it('should list a nested folder index as a sub-catalog', async () => {
    writeIndex(root, 'Parent', 'Top level')
    writeEntry(root, 'page.md', { title: 'Page', description: 'A page' })
    writeIndex(join(root, 'child'), 'Child', 'Nested catalog')

    const result = await computeIndex(root)

    expect(result.ok && result.content).toContain(
      '- [Child](child/index.md): Nested catalog\n',
    )
  })

  it('should sort a sub-catalog among the sibling files, not after them', async () => {
    writeIndex(root, 'Parent', 'Top level')
    writeEntry(root, 'alpha.md', { title: 'Alpha', description: 'First' })
    writeEntry(root, 'zebra.md', { title: 'Zebra', description: 'Last' })
    writeIndex(join(root, 'middle'), 'Middle', 'Nested catalog')

    const result = await computeIndex(root)

    expect(result.ok && result.content).toContain(
      '- [Alpha](alpha.md): First\n- [Middle](middle/index.md): Nested catalog\n- [Zebra](zebra.md): Last\n',
    )
  })

  it('should separate sub-catalogs with their own heading when categories exist', async () => {
    writeIndex(root, 'Parent', 'Top level')
    writeEntry(root, 'page.md', {
      title: 'Page',
      description: 'A page',
      category: 'Group',
    })
    writeIndex(join(root, 'child'), 'Child', 'Nested catalog')

    const result = await computeIndex(root)

    expect(result.ok && result.content).toContain(
      '\n## Sub-catalogs\n\n- [Child](child/index.md): Nested catalog\n',
    )
  })

  it('should report every sibling missing a required field', async () => {
    writeIndex(root, 'Docs', 'One line each')
    writeEntry(root, 'bad.md', { title: 'NoDescription' })

    const result = await computeIndex(root)

    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors[0]).toContain('description')
  })

  it('should report a missing subtitle on the index itself', async () => {
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'index.md'), '---\ntitle: Docs\n---\n\nbody\n')

    const result = await computeIndex(root)

    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors.join()).toContain('subtitle')
  })

  it('should emit only a heading and subtitle for an empty folder', async () => {
    writeIndex(root, 'Empty', 'Nothing here yet')

    const result = await computeIndex(root)

    expect(result).toEqual({
      ok: true,
      content:
        '---\ntitle: Empty\nsubtitle: Nothing here yet\n---\n\n# Empty\n\nNothing here yet\n',
    })
  })
})
