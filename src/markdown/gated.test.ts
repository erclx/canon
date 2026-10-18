import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  appendGatedPrefix,
  GATED_CONFIG_REL,
  prefixShapeError,
  readGatedConfig,
} from '@/markdown/gated'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-gated-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeConfig(text: string): void {
  const path = join(root, GATED_CONFIG_REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

describe('readGatedConfig', () => {
  it('should read an absent file as absent', () => {
    expect(readGatedConfig(root)).toEqual({ kind: 'absent' })
  })

  it('should read an empty list as listing nothing', () => {
    writeConfig('[markdown]\ngated = []\n')
    expect(readGatedConfig(root)).toEqual({ kind: 'listed', prefixes: [] })
  })

  it('should refuse malformed TOML with the path named', () => {
    writeConfig('[markdown\ngated = ')
    const config = readGatedConfig(root)
    expect(config.kind).toBe('malformed')
    if (config.kind === 'malformed')
      expect(config.message).toContain(GATED_CONFIG_REL)
  })

  it('should refuse a gated value that is not a list of strings', () => {
    writeConfig('[markdown]\ngated = "docs/"\n')
    expect(readGatedConfig(root).kind).toBe('malformed')
  })
})

describe('prefixShapeError', () => {
  it('should accept a folder prefix ending in a slash', () => {
    expect(prefixShapeError(root, 'docs/')).toBeUndefined()
  })

  it('should refuse a prefix without a trailing slash naming no file', () => {
    expect(prefixShapeError(root, 'docs')).toContain('names no file')
  })

  it('should accept an exact path naming a file', () => {
    writeFileSync(join(root, 'README.md'), '# Readme\n')
    expect(prefixShapeError(root, 'README.md')).toBeUndefined()
  })
})

describe('appendGatedPrefix', () => {
  it('should create the file and append a prefix', () => {
    expect(appendGatedPrefix(root, [], 'docs/')).toBe('appended')
    expect(readGatedConfig(root)).toEqual({
      kind: 'listed',
      prefixes: ['docs/'],
    })
  })

  it('should write nothing for a duplicate prefix', () => {
    appendGatedPrefix(root, [], 'docs/')
    const before = readFileSync(join(root, GATED_CONFIG_REL), 'utf8')

    expect(appendGatedPrefix(root, ['docs/'], 'docs/')).toBe('present')
    expect(readFileSync(join(root, GATED_CONFIG_REL), 'utf8')).toBe(before)
  })
})
