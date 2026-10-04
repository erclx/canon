import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'
import { readReference, referenceRoots, resolveReference } from '@/tooling/read'

/**
 * A root outside this repository is what separates the package copy from the
 * authoring root. Both resolve to the same directory when the CLI runs here, so
 * a fixture under the repository would pass whether the fallback exists or not.
 */
let ROOT: string

function writeReference(relToRoot: string, content: string): void {
  const path = join(ROOT, relToRoot)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-tooling-read-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('referenceRoots', () => {
  it('should put the package corpus behind the authoring root and name no other', () => {
    expect(referenceRoots(ROOT).map((each) => each.dir)).toEqual([
      join(ROOT, 'tooling'),
      join(PROJECT_ROOT, 'tooling'),
    ])
  })
})

describe('resolveReference', () => {
  it('should prefer the authoring root over the package copy', () => {
    writeReference('tooling/base/reference.md', '# Authored\n')

    expect(resolveReference(ROOT, 'base')).toEqual({
      path: join(ROOT, 'tooling', 'base', 'reference.md'),
      source: join('tooling', 'base', 'reference.md'),
    })
  })

  it('should fall back to the package copy when the project authors none', () => {
    const resolved = resolveReference(ROOT, 'base')

    expect(resolved).toEqual({
      path: join(PROJECT_ROOT, 'tooling', 'base', 'reference.md'),
      source: join('<canon>', 'tooling', 'base', 'reference.md'),
    })
  })

  it('should spell the package source so nothing joins it to a project root', () => {
    // The field promises a repo-relative path everywhere else, and a package
    // copy is the one source that promise cannot cover.
    expect(resolveReference(ROOT, 'base')?.source).toContain('<canon>')
  })

  it('should return undefined for a stack under no root', () => {
    expect(resolveReference(ROOT, 'bogus')).toBeUndefined()
  })
})

describe('readReference', () => {
  it('should read the resolved copy verbatim', () => {
    writeReference('tooling/base/reference.md', '# Base\n')
    const resolved = resolveReference(ROOT, 'base')

    expect(resolved && readReference(resolved)).toBe('# Base\n')
  })
})
