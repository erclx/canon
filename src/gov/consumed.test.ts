import {
  existsSync,
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
  consumedRecordPath,
  internalRulesDir,
  listInternalRules,
  readConsumedRecord,
  regenConsumedRules,
} from '@/gov/consumed'
import {
  canonRulesDir,
  installedInternalRulesDir,
  rulesSourceDir,
} from '@/gov/install'

let root: string

function write(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

function seedRule(relPath: string, body: string): void {
  write(join(rulesSourceDir(root), relPath), body)
}

function seedInternalRule(relPath: string, body: string): void {
  write(join(internalRulesDir(root), relPath), body)
}

function seedStack(name: string, body: string): void {
  write(join(root, 'governance', 'stacks', `${name}.toml`), body)
}

function seedRecord(body: string): void {
  write(consumedRecordPath(root), body)
}

function canonPath(...segments: string[]): string {
  return join(canonRulesDir(root), ...segments)
}

function internalPath(...segments: string[]): string {
  return join(installedInternalRulesDir(root), ...segments)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-gov-consumed-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('readConsumedRecord', () => {
  it('should read the stack and extras the record names', () => {
    seedRecord('stack = "node"\nadd = ["testing-ts"]\n')

    expect(readConsumedRecord(root)).toEqual({
      stack: 'node',
      add: ['testing-ts'],
    })
  })

  it('should default extras to empty when the record omits them', () => {
    seedRecord('stack = "base"\n')

    expect(readConsumedRecord(root)).toEqual({ stack: 'base', add: [] })
  })

  it('should return undefined when no record exists', () => {
    expect(readConsumedRecord(root)).toBeUndefined()
  })

  it('should return undefined when the record names no stack', () => {
    seedRecord('add = ["testing-ts"]\n')

    expect(readConsumedRecord(root)).toBeUndefined()
  })
})

describe('listInternalRules', () => {
  it('should list an internal rule with the subfolder it was authored in', () => {
    seedInternalRule(join('claude', '595-tooling.md'), 'T')

    expect(listInternalRules(root)).toEqual([
      {
        rule: '595-tooling',
        src: join(internalRulesDir(root), 'claude', '595-tooling.md'),
        subdir: 'claude',
      },
    ])
  })

  it('should return an empty list when no internal rules exist', () => {
    expect(listInternalRules(root)).toEqual([])
  })
})

describe('regenConsumedRules', () => {
  beforeEach(() => {
    seedStack('base', 'extends = ""\nrules = ["000-constitution"]\n')
    seedStack('node', 'extends = "base"\nrules = ["typescript"]\n')
    seedRule(join('core', '000-constitution.md'), 'C')
    seedRule(join('lang', 'typescript.md'), 'TS')
    seedRule(join('lib', 'testing-ts.md'), 'TEST')
    seedRecord('stack = "node"\nadd = ["testing-ts"]\n')
  })

  it('should install the resolved stack into the authored subfolders', async () => {
    const result = await regenConsumedRules(root)

    expect(result).toEqual({
      ok: true,
      installed: [
        join('.claude', 'rules', 'canon', 'core', '000-constitution.md'),
        join('.claude', 'rules', 'canon', 'lang', 'typescript.md'),
        join('.claude', 'rules', 'canon', 'lib', 'testing-ts.md'),
      ],
    })
  })

  it('should install an internal rule under internal/, beside the stack rules under canon/', async () => {
    seedInternalRule(join('claude', '595-tooling.md'), 'T')

    const result = await regenConsumedRules(root)

    expect(result.ok).toBe(true)
    expect(existsSync(internalPath('claude', '595-tooling.md'))).toBe(true)
    expect(existsSync(canonPath('core', '000-constitution.md'))).toBe(true)
  })

  it('should delete a destination file no source accounts for, in either subtree', async () => {
    write(canonPath('claude', '999-orphan.md'), 'stale')
    write(internalPath('claude', '999-orphan.md'), 'stale')

    await regenConsumedRules(root)

    expect(existsSync(canonPath('claude', '999-orphan.md'))).toBe(false)
    expect(existsSync(internalPath('claude', '999-orphan.md'))).toBe(false)
  })

  it('should overwrite a destination file that drifted from its source', async () => {
    write(canonPath('core', '000-constitution.md'), 'drifted')

    await regenConsumedRules(root)

    expect(readFileSync(canonPath('core', '000-constitution.md'), 'utf8')).toBe(
      'C',
    )
  })

  it('should refuse when the record names a stack with no definition', async () => {
    seedRecord('stack = "ghost"\n')

    expect(await regenConsumedRules(root)).toEqual({
      ok: false,
      reason: 'Stack not found: ghost',
    })
  })

  it('should refuse when a resolved rule has no source file', async () => {
    seedRecord('stack = "node"\nadd = ["999-ghost"]\n')

    expect(await regenConsumedRules(root)).toEqual({
      ok: false,
      reason: 'No source for: 999-ghost',
    })
  })

  it('should refuse when an internal rule shadows a stack rule', async () => {
    seedInternalRule(join('lang', 'typescript.md'), 'SHADOW')

    expect(await regenConsumedRules(root)).toEqual({
      ok: false,
      reason: 'Internal rules shadow stack rules: typescript',
    })
  })

  it('should leave the destination untouched when it refuses', async () => {
    write(canonPath('core', '000-constitution.md'), 'existing')
    seedRecord('stack = "ghost"\n')

    await regenConsumedRules(root)

    expect(readFileSync(canonPath('core', '000-constitution.md'), 'utf8')).toBe(
      'existing',
    )
  })

  it('should refuse when no record exists', async () => {
    rmSync(consumedRecordPath(root))

    expect(await regenConsumedRules(root)).toEqual({
      ok: false,
      reason: `No stack recorded at ${join('internal', 'governance.toml')}`,
    })
  })
})
