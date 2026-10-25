import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveCoverage } from '@/labels/coverage'
import { parseLabelMap } from '@/labels/map'
import {
  configFiles,
  listStacks,
  loadManifest,
  seedFiles,
} from '@/tooling/manifest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const SEED_MAP = join(
  REPO_ROOT,
  'tooling',
  'base',
  'seeds',
  'canon',
  'config',
  'pr-labels.toml',
)

/**
 * Paths a stack writes that are the target's own code, which a seeded row
 * would only guess at. The target labels them with a row of its own.
 */
function isProjectCode(path: string): boolean {
  return path.startsWith('src/') || path === 'smoke_test.go'
}

describe('the base seed label map', () => {
  // Seeds do not merge across the stack chain, so every stack inherits this
  // one map. A stack adding a config it does not reach fails here rather than
  // reading as uncovered on that stack's first target pull request.
  it('should reach every path a stack installs, outside project code', () => {
    const map = parseLabelMap(readFileSync(SEED_MAP, 'utf8'))
    if (map.kind !== 'map') throw new Error(`seed map refused: ${map.reason}`)

    const uncovered: Record<string, string[]> = {}
    for (const stack of listStacks(REPO_ROOT)) {
      const manifest = loadManifest(REPO_ROOT, stack)
      if (manifest === undefined) continue
      const paths = [...configFiles(manifest), ...seedFiles(manifest)]
      const missed = resolveCoverage(map, paths).uncovered.filter(
        (path) => !isProjectCode(path),
      )
      if (missed.length > 0) uncovered[stack] = missed
    }

    expect(uncovered).toEqual({})
  })
})
