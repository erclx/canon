import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { presentNames, resolveFolders } from '@/context/folders'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-folders-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seed(relativeDir: string, names: string[]): void {
  const dir = join(ROOT, relativeDir)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.md'),
    '---\ntitle: X\nsubtitle: Y\n---\n\n# X\n',
  )

  for (const name of names) {
    writeFileSync(
      join(dir, name),
      `---\ntitle: X\ndescription: Y\n---\n\n# X\n`,
    )
  }
}

describe('resolveFolders', () => {
  it('should resolve the default folders that are present', async () => {
    seed('.claude/context', ['ci.md'])
    seed('.claude/diagrams', ['components.md'])

    const folders = (await resolveFolders(ROOT)).folders

    expect(folders.map((folder) => folder.rel)).toEqual([
      '.claude/context',
      '.claude/diagrams',
    ])
  })

  it('should skip a default folder the project does not carry', async () => {
    seed('.claude/context', ['ci.md'])

    expect((await resolveFolders(ROOT)).folders).toHaveLength(1)
  })

  it('should audit a split domain as its own folder', async () => {
    seed('.claude/context', ['ci.md'])
    seed('.claude/context/claude-plugin', ['skills.md', 'overview.md'])

    const folders = (await resolveFolders(ROOT)).folders

    expect(folders.map((folder) => folder.rel)).toEqual([
      '.claude/context',
      '.claude/context/claude-plugin',
    ])
  })

  it('should exclude the index from a folder entry list', async () => {
    seed('.claude/context', ['ci.md', 'cli.md'])

    const [folder] = (await resolveFolders(ROOT)).folders

    expect(folder.entries.map((path) => basename(path))).toEqual([
      'ci.md',
      'cli.md',
    ])
  })

  it('should ignore a folder with entries but no index', async () => {
    mkdirSync(join(ROOT, '.claude/context'), { recursive: true })
    writeFileSync(join(ROOT, '.claude/context/ci.md'), '# CI\n')

    expect((await resolveFolders(ROOT)).folders).toEqual([])
  })

  it('should honor an explicit folder list', async () => {
    seed('.claude/context', ['ci.md'])
    seed('.claude/diagrams', ['components.md'])

    const { folders } = await resolveFolders(ROOT, ['diagrams'])

    expect(folders.map((folder) => folder.rel)).toEqual(['.claude/diagrams'])
  })

  it('should resolve a named folder at the project root', async () => {
    seed('docs', ['agents.md'])

    const { folders } = await resolveFolders(ROOT, ['docs'], {
      canResolveAtRoot: true,
    })

    expect(folders.map((folder) => folder.rel)).toEqual(['docs'])
    expect(folders[0].base).toBe('.')
  })

  it('should leave a root folder unresolved without the opt-in', async () => {
    seed('docs', ['agents.md'])

    const { folders, missing } = await resolveFolders(ROOT, ['docs'])

    expect(folders).toEqual([])
    expect(missing).toEqual(['docs'])
  })

  it('should skip a root folder carrying a default name on a default run', async () => {
    seed('wireframes', ['login.md'])

    expect((await resolveFolders(ROOT)).folders).toEqual([])
  })

  it('should audit a split domain under a root folder', async () => {
    seed('docs', ['agents.md'])
    seed('docs/reference', ['cli.md'])

    const { folders } = await resolveFolders(ROOT, ['docs'], {
      canResolveAtRoot: true,
    })

    expect(folders.map((folder) => folder.rel)).toEqual([
      'docs',
      'docs/reference',
    ])
  })

  it('should prefer the .claude folder over the root folder of the same name', async () => {
    seed('.claude/docs', ['agents.md'])
    seed('docs', ['agents.md'])

    const { folders } = await resolveFolders(ROOT, ['docs'], {
      canResolveAtRoot: true,
    })

    expect(folders.map((folder) => folder.rel)).toEqual(['.claude/docs'])
  })

  it('should report a name that resolves under neither base', async () => {
    seed('.claude/context', ['ci.md'])

    const { folders, missing } = await resolveFolders(ROOT, ['context', 'nope'])

    expect(folders.map((folder) => folder.rel)).toEqual(['.claude/context'])
    expect(missing).toEqual(['nope'])
  })

  it('should report every requested name when none resolves', async () => {
    expect((await resolveFolders(ROOT, ['nope', 'gone'])).missing).toEqual([
      'nope',
      'gone',
    ])
  })

  it('should resolve context under canon/ ahead of .claude/', async () => {
    seed('canon/context', ['ci.md'])
    seed('.claude/context', ['ci.md'])

    const { folders } = await resolveFolders(ROOT, ['context'])

    expect(folders.map((folder) => folder.rel)).toEqual(['canon/context'])
  })

  it('should resolve diagrams under .canon/ ahead of .claude/', async () => {
    seed('.canon/diagrams', ['components.md'])
    seed('.claude/diagrams', ['components.md'])

    const { folders } = await resolveFolders(ROOT, ['diagrams'])

    expect(folders.map((folder) => folder.rel)).toEqual(['.canon/diagrams'])
  })

  it('should fall back to .claude/ for context when canon/ carries nothing', async () => {
    seed('.claude/context', ['ci.md'])

    const { folders } = await resolveFolders(ROOT, ['context'])

    expect(folders.map((folder) => folder.rel)).toEqual(['.claude/context'])
  })
})

describe('presentNames', () => {
  it('should name each present folder once regardless of its split entries', async () => {
    seed('.claude/context', ['ci.md'])
    seed('.claude/context/claude-plugin', ['skills.md'])
    seed('.claude/diagrams', ['components.md'])

    expect(presentNames((await resolveFolders(ROOT)).folders)).toEqual([
      'context',
      'diagrams',
    ])
  })

  it('should omit a folder the project does not carry', async () => {
    seed('.claude/context', ['ci.md'])

    expect(presentNames((await resolveFolders(ROOT)).folders)).not.toContain(
      'wireframes',
    )
  })

  it('should omit a folder resolved at the project root', async () => {
    seed('docs', ['agents.md'])

    const { folders } = await resolveFolders(ROOT, ['docs'], {
      canResolveAtRoot: true,
    })

    expect(presentNames(folders)).toEqual([])
  })
})
