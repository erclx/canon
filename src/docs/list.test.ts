import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listDocs } from '@/docs/list'

let ROOT: string

function writeDoc(relToRoot: string, frontmatter: string): void {
  const path = join(ROOT, relToRoot)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `---\n${frontmatter}\n---\n\n# Body\n`)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-docs-list-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('listDocs', () => {
  it('should list a sibling file that declares a target-facing category', () => {
    writeDoc(
      'docs/sync.md',
      'description: Pull drift in\ncategory: Agent surface',
    )

    expect(listDocs(ROOT).docs).toEqual([
      {
        name: 'sync',
        description: 'Pull drift in',
        category: 'Agent surface',
        target: join('docs', 'sync.md'),
      },
    ])
  })

  it('should leave out a file whose category is not on the allowlist', () => {
    writeDoc('docs/flow.md', 'description: Method\ncategory: Workflow')
    writeDoc('docs/bare.md', 'description: No category')

    expect(listDocs(ROOT).docs).toEqual([])
  })

  it('should describe a split folder by its index subtitle', () => {
    writeDoc(
      'docs/agents/index.md',
      'subtitle: CLI catalog\ncategory: Agent surface\ndescription: ignored',
    )

    expect(listDocs(ROOT).docs[0]).toMatchObject({
      name: 'agents',
      description: 'CLI catalog',
      target: join('docs', 'agents', 'index.md'),
    })
  })

  it('should list a sub-area file by its bare name and its own category', () => {
    writeDoc(
      'docs/target/index.md',
      'subtitle: Target\ncategory: Domain references',
    )
    writeDoc(
      'docs/target/sync.md',
      'description: Sync\ncategory: Domain references',
    )
    writeDoc('docs/target/plain.md', 'description: No category')

    expect(listDocs(ROOT).docs.map((entry) => entry.name)).toEqual([
      'sync',
      'target',
    ])
  })

  it('should leave out an internal context topic and keep the rest', () => {
    writeDoc('canon/context/ci.md', 'description: Internal')
    writeDoc('canon/context/cli/index.md', 'subtitle: CLI domain')
    writeDoc('canon/context/web.md', 'description: Landing page')

    expect(listDocs(ROOT).context).toEqual([
      {
        name: 'cli',
        description: 'CLI domain',
        category: '',
        target: join('canon', 'context', 'cli', 'index.md'),
      },
      {
        name: 'web',
        description: 'Landing page',
        category: '',
        target: join('canon', 'context', 'web.md'),
      },
    ])
  })

  it('should return the value of a quoted description without the quotes', () => {
    writeDoc(
      'docs/quoted.md',
      'description: "Says: a colon"\ncategory: Agent surface',
    )

    expect(listDocs(ROOT).docs[0]?.description).toBe('Says: a colon')
  })

  it('should list docs and report no context for a root without a context folder', () => {
    writeDoc('docs/sync.md', 'description: Sync\ncategory: Agent surface')

    const catalog = listDocs(ROOT)

    expect(catalog.hasContext).toBe(false)
    expect(catalog.context).toEqual([])
    expect(catalog.docs).toHaveLength(1)
  })
})
