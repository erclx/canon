import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CREATION_ROOT,
  resolveSurfacePath,
  spell,
  SURFACE_ROOTS,
  surfaceDir,
  surfaceDirs,
} from '@/surface-root'

describe('resolveSurfacePath', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-surface-path-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should land a surface seed at canon/ in a fresh project', () => {
    expect(resolveSurfacePath(root, 'canon/context/ci.md')).toBe(
      join(root, 'canon', 'context', 'ci.md'),
    )
  })

  it('should land a surface seed beside the copy an unmoved project holds', () => {
    mkdirSync(join(root, '.claude', 'context'), { recursive: true })

    expect(resolveSurfacePath(root, 'canon/context/ci.md')).toBe(
      join(root, '.claude', 'context', 'ci.md'),
    )
  })

  it('should resolve a loose surface document by its own presence', () => {
    mkdirSync(join(root, '.claude'), { recursive: true })
    writeFileSync(join(root, '.claude', 'DESIGN.md'), 'x')

    expect(resolveSurfacePath(root, 'canon/DESIGN.md')).toBe(
      join(root, '.claude', 'DESIGN.md'),
    )
  })

  it('should join a path naming no surface entry as written', () => {
    expect(resolveSurfacePath(root, '.cspell/tech-stack.txt')).toBe(
      join(root, '.cspell', 'tech-stack.txt'),
    )
    expect(resolveSurfacePath(root, 'canon/config/x.toml')).toBe(
      join(root, 'canon', 'config', 'x.toml'),
    )
  })
})

describe('surface-root', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-surface-root-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reads canon/ ahead of .claude/ when both carry the surface', () => {
    mkdirSync(join(root, 'canon', 'context'), { recursive: true })
    mkdirSync(join(root, '.claude', 'context'), { recursive: true })

    expect(surfaceDir(root, 'context')).toBe(join(root, 'canon', 'context'))
  })

  it('falls back to .claude/ when canon/ carries nothing', () => {
    mkdirSync(join(root, '.claude', 'context'), { recursive: true })

    expect(surfaceDir(root, 'context')).toBe(join(root, '.claude', 'context'))
  })

  it('agrees with the head of the read order for creation', () => {
    expect(CREATION_ROOT).toBe('canon')
    expect(SURFACE_ROOTS[0]).toBe(CREATION_ROOT)
  })

  it('creates at canon/ when neither root carries the surface', () => {
    expect(surfaceDir(root, 'context')).toBe(join(root, 'canon', 'context'))
  })

  it('spells the stamp folder as config under canon/ and canon under .claude/', () => {
    expect(spell('canon', 'canon')).toBe('config')
    expect(spell('.claude', 'canon')).toBe('canon')
  })

  it('leaves every other entry spelled the same at both roots', () => {
    expect(spell('canon', 'context')).toBe('context')
    expect(spell('.claude', 'context')).toBe('context')
  })

  it('resolves the stamp folder at canon/config when canon/ has it', () => {
    mkdirSync(join(root, 'canon', 'config'), { recursive: true })

    expect(surfaceDir(root, 'canon')).toBe(join(root, 'canon', 'config'))
  })

  it('resolves the stamp folder at .claude/canon when only .claude/ has it', () => {
    mkdirSync(join(root, '.claude', 'canon'), { recursive: true })

    expect(surfaceDir(root, 'canon')).toBe(join(root, '.claude', 'canon'))
  })

  it('keeps creating the stamp folder under .claude/ until its own move lands', () => {
    expect(surfaceDir(root, 'canon')).toBe(join(root, '.claude', 'canon'))
  })

  it('reports both roots from surfaceDirs whether or not either exists', () => {
    expect(surfaceDirs(root, 'context')).toEqual([
      join(root, 'canon', 'context'),
      join(root, '.claude', 'context'),
    ])

    mkdirSync(join(root, '.claude', 'context'), { recursive: true })

    expect(surfaceDirs(root, 'context')).toEqual([
      join(root, 'canon', 'context'),
      join(root, '.claude', 'context'),
    ])
  })

  it('reports both roots for the stamp folder, respelled per root', () => {
    expect(surfaceDirs(root, 'canon')).toEqual([
      join(root, 'canon', 'config'),
      join(root, '.claude', 'canon'),
    ])
  })

  it('resolves a file entry the same way as a folder entry', () => {
    mkdirSync(join(root, '.claude'), { recursive: true })
    writeFileSync(join(root, '.claude', 'ARCHITECTURE.md'), 'x')

    expect(surfaceDir(root, 'ARCHITECTURE.md')).toBe(
      join(root, '.claude', 'ARCHITECTURE.md'),
    )
  })

  it('joins rest segments onto the resolved surface', () => {
    mkdirSync(join(root, 'canon', 'context'), { recursive: true })

    expect(surfaceDir(root, 'context', 'ci.md')).toBe(
      join(root, 'canon', 'context', 'ci.md'),
    )
  })
})
