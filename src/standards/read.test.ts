import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'
import {
  listStandards,
  readStandard,
  resolveStandard,
  standardRoots,
} from '@/standards/read'

/**
 * A root outside this repository is what separates the package copy from the
 * authoring root. Both resolve to the same directory when the CLI runs here, so
 * a fixture under the repository would pass whether the fallback exists or not.
 */
let ROOT: string

function writeStandard(relToRoot: string, content: string): void {
  const path = join(ROOT, relToRoot)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-standards-read-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('standardRoots', () => {
  it('should put the package corpus behind the authoring root and name no other', () => {
    expect(standardRoots(ROOT).map((each) => each.dir)).toEqual([
      join(ROOT, 'standards'),
      join(PROJECT_ROOT, 'standards'),
    ])
  })
})

describe('resolveStandard', () => {
  it('should ignore an installed copy, since no corpus installs any more', () => {
    writeStandard('.claude/standards/prose.md', '# Installed\n')
    writeStandard('standards/prose.md', '# Authored\n')

    expect(resolveStandard(ROOT, 'prose.md')).toEqual({
      path: join(ROOT, 'standards', 'prose.md'),
      source: join('standards', 'prose.md'),
    })
  })

  it('should prefer the authoring root over the package copy', () => {
    writeStandard('standards/prose.md', '# Authored\n')

    expect(resolveStandard(ROOT, 'prose.md')).toEqual({
      path: join(ROOT, 'standards', 'prose.md'),
      source: join('standards', 'prose.md'),
    })
  })

  it('should fall back to the package copy when the project installed none', () => {
    const resolved = resolveStandard(ROOT, 'markdown.md')

    expect(resolved).toEqual({
      path: join(PROJECT_ROOT, 'standards', 'markdown.md'),
      source: join('<canon>', 'standards', 'markdown.md'),
    })
  })

  it('should spell the package source so nothing joins it to a project root', () => {
    // The field promises a repo-relative path everywhere else, and a package
    // copy is the one source that promise cannot cover.
    expect(resolveStandard(ROOT, 'markdown.md')?.source).toContain('<canon>')
  })

  it('should take a name carrying no extension', () => {
    writeStandard('standards/prose.md', '# Authored\n')

    expect(resolveStandard(ROOT, 'prose')?.path).toBe(
      join(ROOT, 'standards', 'prose.md'),
    )
  })

  it('should return undefined for a name under no root', () => {
    expect(resolveStandard(ROOT, 'bogus')).toBeUndefined()
  })
})

describe('listStandards', () => {
  it('should name a project standard once when the package carries it too', () => {
    writeStandard('standards/markdown.md', '# Authored\n')
    const names = listStandards(ROOT)

    expect(names.filter((name) => name === 'markdown')).toEqual(['markdown'])
  })

  it('should name a project standard the package does not carry', () => {
    writeStandard('standards/house-style.md', '# House style\n')

    expect(listStandards(ROOT)).toContain('house-style')
  })

  it('should omit an installed copy left behind by an older toolkit', () => {
    writeStandard('.claude/standards/house-style.md', '# House style\n')

    expect(listStandards(ROOT)).not.toContain('house-style')
  })

  it('should omit the catalog index', () => {
    expect(listStandards(ROOT)).not.toContain('index')
  })
})

describe('readStandard', () => {
  it('should strip the frontmatter from the resolved copy', () => {
    writeStandard('standards/prose.md', '---\ntitle: Prose\n---\n# Prose\n')
    const resolved = resolveStandard(ROOT, 'prose')

    expect(resolved && readStandard(resolved)).toBe('# Prose\n')
  })
})
