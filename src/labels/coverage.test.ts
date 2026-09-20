import { describe, expect, it } from 'vitest'
import { resolveCoverage } from '@/labels/coverage'
import { join } from 'node:path'
import { parseLabelMap, readLabelMap } from '@/labels/map'

const FIXTURE = `
[domains]
cli = ["src/", "scripts/lib/"]
docs = ["docs/", "README.md"]

[declined]
release-managed = ["CHANGELOG.md", "package.json"]
generated = ["assets/evidence/hero.png"]
`

function fixtureMap() {
  const map = parseLabelMap(FIXTURE)
  if (map.kind !== 'map') throw new Error('fixture map did not parse')
  return map
}

describe('resolveCoverage', () => {
  it('should collect the distinct labels a changed set earns, in map order', () => {
    const coverage = resolveCoverage(fixtureMap(), [
      'docs/index.md',
      'src/cli.ts',
      'src/ui.ts',
    ])

    expect(coverage.labels).toEqual(['cli', 'docs'])
    expect(coverage.uncovered).toEqual([])
    expect(coverage.declined).toEqual([])
  })

  it('should name every path no row reaches when the set earns nothing', () => {
    const coverage = resolveCoverage(fixtureMap(), [
      'apps/web/page.tsx',
      'infra/main.tf',
    ])

    expect(coverage.labels).toEqual([])
    expect(coverage.uncovered).toEqual(['apps/web/page.tsx', 'infra/main.tf'])
  })

  it('should report a declined path as a decision rather than a gap', () => {
    const coverage = resolveCoverage(fixtureMap(), [
      'CHANGELOG.md',
      'assets/evidence/hero.png',
    ])

    expect(coverage.uncovered).toEqual([])
    expect(coverage.declined).toEqual([
      { path: 'CHANGELOG.md', reason: 'release-managed' },
      { path: 'assets/evidence/hero.png', reason: 'generated' },
    ])
  })

  it('should separate a declined path from an uncovered one in the same set', () => {
    const coverage = resolveCoverage(fixtureMap(), [
      'package.json',
      'infra/main.tf',
    ])

    expect(coverage.declined).toEqual([
      { path: 'package.json', reason: 'release-managed' },
    ])
    expect(coverage.uncovered).toEqual(['infra/main.tf'])
  })

  it('should match prefixes anchored at the start of the path', () => {
    const coverage = resolveCoverage(fixtureMap(), ['.claude/src/cli.ts'])

    expect(coverage.labels).toEqual([])
    expect(coverage.uncovered).toEqual(['.claude/src/cli.ts'])
  })

  it('should give a path claimed by two rows both labels', () => {
    const map = parseLabelMap(`
[domains]
cli = ["src/"]
tests = ["src/labels/"]
`)
    if (map.kind !== 'map') throw new Error('map did not parse')

    expect(resolveCoverage(map, ['src/labels/map.ts']).labels).toEqual([
      'cli',
      'tests',
    ])
  })

  it('should label a path a domain row and a declined row both claim', () => {
    const map = parseLabelMap(`
[domains]
repo = ["package.json"]

[declined]
release-managed = ["package.json"]
`)
    if (map.kind !== 'map') throw new Error('map did not parse')

    const coverage = resolveCoverage(map, ['package.json'])
    expect(coverage.labels).toEqual(['repo'])
    expect(coverage.declined).toEqual([])
  })

  it('should report nothing for an empty changed set', () => {
    const coverage = resolveCoverage(fixtureMap(), [])

    expect(coverage.labels).toEqual([])
    expect(coverage.declined).toEqual([])
    expect(coverage.uncovered).toEqual([])
  })
})

describe("resolveCoverage against the map's newest rows", () => {
  function newestRowsMap() {
    const map = parseLabelMap(`
[domains]
ci = [".github/", "scripts/core/", ".husky/", ".claude/hooks/", ".claude/settings.json"]

[declined]
formatting = [".prettierignore"]
`)
    if (map.kind !== 'map') throw new Error('fixture map did not parse')
    return map
  }

  it('should match .claude/settings.json against the prefix added for it', () => {
    const coverage = resolveCoverage(newestRowsMap(), ['.claude/settings.json'])

    expect(coverage.labels).toEqual(['ci'])
    expect(coverage.uncovered).toEqual([])
  })

  it('should match .prettierignore against the declined prefix added for it', () => {
    const coverage = resolveCoverage(newestRowsMap(), ['.prettierignore'])

    expect(coverage.declined).toEqual([
      { path: '.prettierignore', reason: 'formatting' },
    ])
    expect(coverage.uncovered).toEqual([])
  })

  it('should still report a path outside every row as uncovered', () => {
    const coverage = resolveCoverage(newestRowsMap(), ['infra/main.tf'])

    expect(coverage.labels).toEqual([])
    expect(coverage.uncovered).toEqual(['infra/main.tf'])
  })
})

describe("resolveCoverage against the repository's own map", () => {
  function repositoryMap() {
    const map = readLabelMap(join(import.meta.dirname, '..', '..'))
    if (map.kind !== 'map') throw new Error('repository map did not parse')
    return map
  }

  it('should decline a light sibling, its stamp, and a home frame the real config names by stem', () => {
    const coverage = resolveCoverage(repositoryMap(), [
      'assets/evidence/hero-light.png',
      'assets/evidence/hero-light.stamp',
      'assets/captures/hero-light.html',
      'assets/evidence/home/frame-1.png',
    ])

    expect(coverage.uncovered).toEqual([])
    expect(coverage.declined).toHaveLength(4)
  })
})

describe('resolveCoverage with stem prefixes', () => {
  const stemMap = () => {
    const map = parseLabelMap(`
[domains]
docs = ["docs/"]

[declined]
generated = ["assets/evidence/hero", "assets/evidence/home/"]
rides-with-generated = ["assets/captures/hero"]
`)
    if (map.kind !== 'map') throw new Error('stem map did not parse')
    return map
  }

  it('should decline a light sibling of a declared frame, its stamp, and its capture', () => {
    const coverage = resolveCoverage(stemMap(), [
      'assets/evidence/hero-light.png',
      'assets/evidence/hero-light.stamp',
      'assets/captures/hero-light.html',
      'assets/captures/hero.html.tmpl',
    ])

    expect(coverage.uncovered).toEqual([])
    expect(coverage.declined).toEqual([
      { path: 'assets/evidence/hero-light.png', reason: 'generated' },
      { path: 'assets/evidence/hero-light.stamp', reason: 'generated' },
      {
        path: 'assets/captures/hero-light.html',
        reason: 'rides-with-generated',
      },
      {
        path: 'assets/captures/hero.html.tmpl',
        reason: 'rides-with-generated',
      },
    ])
  })

  it('should decline a path under a declined folder prefix', () => {
    const coverage = resolveCoverage(stemMap(), [
      'assets/evidence/home/frame-3.png',
    ])

    expect(coverage.uncovered).toEqual([])
    expect(coverage.declined).toEqual([
      { path: 'assets/evidence/home/frame-3.png', reason: 'generated' },
    ])
  })
})
