import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAP_REL, parseLabelMap, readLabelMap } from '@/labels/map'

describe('parseLabelMap', () => {
  it('should read the domain rows in the order the map declares them', () => {
    const map = parseLabelMap(`
[domains]
cli = ["src/", "scripts/lib/"]
docs = ["docs/"]
`)

    expect(map).toEqual({
      kind: 'map',
      domains: [
        { label: 'cli', prefixes: ['src/', 'scripts/lib/'] },
        { label: 'docs', prefixes: ['docs/'] },
      ],
      declined: [],
    })
  })

  it('should read the declined rows keyed by the reason they carry', () => {
    const map = parseLabelMap(`
[domains]
cli = ["src/"]

[declined]
release-managed = ["CHANGELOG.md"]
`)

    expect(map.kind === 'map' && map.declined).toEqual([
      { reason: 'release-managed', prefixes: ['CHANGELOG.md'] },
    ])
  })

  it('should refuse a map carrying no domains table', () => {
    expect(parseLabelMap('[declined]\ngenerated = ["a"]\n')).toEqual({
      kind: 'refused',
      reason: 'no-domains',
    })
  })

  it('should refuse a map whose domains table has no usable row', () => {
    expect(parseLabelMap('[domains]\ncli = []\n')).toEqual({
      kind: 'refused',
      reason: 'no-domains',
    })
  })

  it('should refuse text TOML cannot parse', () => {
    expect(parseLabelMap('[domains\ncli = ')).toEqual({
      kind: 'refused',
      reason: 'unreadable-map',
    })
  })

  it('should skip a row whose value is not a list of prefixes', () => {
    const map = parseLabelMap(`
[domains]
cli = ["src/"]
broken = "docs/"
`)

    expect(map.kind === 'map' && map.domains).toEqual([
      { label: 'cli', prefixes: ['src/'] },
    ])
  })
})

describe('readLabelMap', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-labels-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should read the map a project declares', () => {
    const path = join(root, MAP_REL)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '[domains]\ncli = ["src/"]\n')

    expect(readLabelMap(root).kind).toBe('map')
  })

  it('should answer a project with no map as an absence rather than a fault', () => {
    expect(readLabelMap(root)).toEqual({ kind: 'refused', reason: 'no-map' })
  })

  it('should fall back to .claude/canon/pr-labels.toml for a project that has not moved', () => {
    const path = join(root, '.claude', 'canon', 'pr-labels.toml')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '[domains]\ncli = ["src/"]\n')

    expect(readLabelMap(root).kind).toBe('map')
  })

  it('should prefer canon/config/pr-labels.toml over the legacy path when both exist', () => {
    const legacyPath = join(root, '.claude', 'canon', 'pr-labels.toml')
    mkdirSync(dirname(legacyPath), { recursive: true })
    writeFileSync(legacyPath, '[domains]\nold = ["legacy/"]\n')

    const path = join(root, MAP_REL)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '[domains]\ncli = ["src/"]\n')

    const result = readLabelMap(root)
    expect(result.kind === 'map' ? result.domains[0]?.label : undefined).toBe(
      'cli',
    )
  })
})
