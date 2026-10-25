import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readHealthPaths } from '@/pr/health'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-health-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function writeDeclaration(toml: string): void {
  mkdirSync(join(ROOT, 'canon', 'config'), { recursive: true })
  writeFileSync(join(ROOT, 'canon', 'config', 'local.toml'), toml)
}

describe('readHealthPaths', () => {
  it('should read no declaration when the file is absent', () => {
    expect(readHealthPaths(ROOT)).toEqual({ kind: 'none' })
  })

  it('should read a declared list of paths in order', () => {
    writeDeclaration('health = ["/api/health", "/ready"]\n')

    expect(readHealthPaths(ROOT)).toEqual({
      kind: 'paths',
      paths: ['/api/health', '/ready'],
    })
  })

  it('should read an empty list as no declaration', () => {
    writeDeclaration('health = []\n')

    expect(readHealthPaths(ROOT)).toEqual({ kind: 'none' })
  })

  it('should report a file that is not valid TOML as invalid', () => {
    writeDeclaration('health = [\n')

    expect(readHealthPaths(ROOT)).toEqual({
      kind: 'invalid',
      reason: 'canon/config/local.toml is not valid TOML',
    })
  })

  it.each([
    ['a path with no leading slash', 'health = ["api/health"]\n'],
    ['a full URL', 'health = ["http://example.com/health"]\n'],
    ['a protocol-relative host', 'health = ["//example.com/health"]\n'],
    ['a non-string entry', 'health = ["/api/health", 3]\n'],
    ['a string in place of a list', 'health = "/api/health"\n'],
    ['a missing key', 'heath = ["/api/health"]\n'],
  ])('should report a declaration with %s as invalid', (_label, toml) => {
    writeDeclaration(toml)

    expect(readHealthPaths(ROOT)).toEqual({
      kind: 'invalid',
      reason:
        'canon/config/local.toml needs health as a list of paths, each starting with a single /',
    })
  })
})
