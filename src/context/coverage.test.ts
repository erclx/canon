import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  hasCoverageFindings,
  measureCoverage,
  readRoots,
  type RootDeclaration,
} from '@/context/coverage'
import type { AuditedFolder } from '@/context/folders'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-coverage-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function write(rel: string, content = ''): string {
  const path = join(ROOT, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return path
}

function entry(rel: string, layout: string): string {
  return write(
    rel,
    `# Entry\n\n## Overview\n\nx\n\n## Layout\n\n${layout}\n\n## Gotchas\n\n- \`src/trap/\` is cited here\n`,
  )
}

function folderOf(...entries: string[]): AuditedFolder[] {
  return [
    {
      name: 'context',
      base: 'canon',
      rel: 'canon/context',
      indexPath: join(ROOT, 'canon/context/index.md'),
      entries,
      nested: false,
    },
  ]
}

function measured(declaration: RootDeclaration, folders: AuditedFolder[]) {
  const report = measureCoverage(ROOT, declaration, folders)
  if (report.kind !== 'measured') {
    throw new Error(`expected measured, got ${report.kind}`)
  }
  return report.findings
}

function mkdirs(...rels: string[]): void {
  for (const rel of rels) mkdirSync(join(ROOT, rel), { recursive: true })
}

const SRC: RootDeclaration = { kind: 'roots', patterns: ['src'] }

describe('measureCoverage', () => {
  it('reports a folder no Layout names', () => {
    mkdirs('src/alpha', 'src/beta')
    const a = entry('canon/context/a.md', '### `src/alpha/`\n\n- one')

    expect(measured(SRC, folderOf(a)).unnamed).toEqual(['src/beta'])
  })

  it('reports an H3 in two entries and ignores a bullet citation', () => {
    mkdirs('src/alpha', 'src/beta')
    const a = entry(
      'canon/context/a.md',
      '### `src/alpha/`\n\n- cites `src/beta/`',
    )
    const b = entry(
      'canon/context/b.md',
      '### `src/alpha/`\n\n- two\n\n### `src/beta/`\n\n- own',
    )

    const findings = measured(SRC, folderOf(a, b))
    expect(findings.doubled).toEqual([
      {
        folder: 'src/alpha',
        rels: ['canon/context/a.md', 'canon/context/b.md'],
      },
    ])
    expect(findings.unnamed).toEqual([])
  })

  it('counts each folder on an Other folders line and skips Gotchas citations', () => {
    mkdirs('src/one', 'src/two', 'src/trap')
    const a = entry(
      'canon/context/a.md',
      '### Other folders\n\n- `src/one/` and `src/two/` own x',
    )

    expect(measured(SRC, folderOf(a)).unnamed).toEqual(['src/trap'])
  })

  it('excludes hidden folders and node_modules, and counts an empty folder', () => {
    mkdirs('src/.cache', 'src/node_modules', 'src/bare')
    const a = entry('canon/context/a.md', '- nothing')

    expect(measured(SRC, folderOf(a)).unnamed).toEqual(['src/bare'])
  })

  it('expands a glob and reports a root or glob matching nothing', () => {
    mkdirs('packages/x/src/core', 'packages/y/src/util')
    const a = entry('canon/context/a.md', '### `packages/x/src/core/`')

    const findings = measured(
      { kind: 'roots', patterns: ['packages/*/src', 'missing/*'] },
      folderOf(a),
    )
    expect(findings.unnamed).toEqual(['packages/y/src/util'])
    expect(findings.missingRoots).toEqual(['missing/*'])
  })

  it('reports no code root and an explicit opt-out without gating', () => {
    expect(measureCoverage(ROOT, { kind: 'none' }, [])).toEqual({
      kind: 'no-root',
    })
    expect(measureCoverage(ROOT, { kind: 'opted-out' }, [])).toEqual({
      kind: 'opted-out',
    })
    expect(hasCoverageFindings({ kind: 'no-root' })).toBe(false)
  })

  it('carries an invalid declaration through as a gating finding', () => {
    const report = measureCoverage(
      ROOT,
      { kind: 'invalid', reason: 'roots must be a list of strings' },
      [],
    )

    expect(report).toEqual({
      kind: 'invalid',
      reason: 'roots must be a list of strings',
    })
    expect(hasCoverageFindings(report)).toBe(true)
  })
})

describe('readRoots', () => {
  it('falls back to src when present and none when absent', () => {
    expect(readRoots(ROOT)).toEqual({ kind: 'none' })
    mkdirs('src')
    expect(readRoots(ROOT)).toEqual({ kind: 'roots', patterns: ['src'] })
  })

  it('reads a declared list and treats an empty one as an opt-out', () => {
    write('canon/config/context.toml', 'roots = ["lib", "packages/*/src"]\n')
    expect(readRoots(ROOT)).toEqual({
      kind: 'roots',
      patterns: ['lib', 'packages/*/src'],
    })

    write('canon/config/context.toml', 'roots = []\n')
    expect(readRoots(ROOT)).toEqual({ kind: 'opted-out' })
  })

  it('reports a malformed declaration instead of falling back to src', () => {
    mkdirs('src')
    write('canon/config/context.toml', 'roots = [\n')

    const declaration = readRoots(ROOT)
    expect(declaration.kind).toBe('invalid')
  })

  it.each([
    ['a string', 'roots = "src"\n'],
    ['a non-string entry', 'roots = ["src", 3]\n'],
    ['a missing key', 'root = ["src"]\n'],
  ])('reports a declaration with %s as invalid', (_label, toml) => {
    mkdirs('src')
    write('canon/config/context.toml', toml)

    expect(readRoots(ROOT).kind).toBe('invalid')
  })
})
