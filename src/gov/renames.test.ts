import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { indexSourceRules } from '@/gov/adapter'
import {
  loadRenames,
  type Renames,
  resolveSuccessor,
  successorResolver,
} from '@/gov/renames'

const REPO_ROOT = join(import.meta.dirname, '..', '..')

let TOOLKIT: string

function writeFixture(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function sourceIndex(...names: string[]): Map<string, string> {
  return new Map(names.map((name) => [name, `/rules/core/${name}.md`]))
}

function renames(entries: Record<string, string>): Renames {
  return new Map(Object.entries(entries))
}

function isChainCyclic(ledger: Renames, start: string): boolean {
  const visited = new Set<string>()
  let current: string | undefined = start
  while (current !== undefined) {
    if (visited.has(current)) return true
    visited.add(current)
    current = ledger.get(current)
  }
  return false
}

beforeEach(() => {
  TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-gov-renames-'))
})

afterEach(() => {
  rmSync(TOOLKIT, { recursive: true, force: true })
})

describe('loadRenames', () => {
  it('should read a missing ledger as empty', () => {
    expect(loadRenames(TOOLKIT).size).toBe(0)
  })

  it('should map each old basename to its new one', () => {
    writeFixture(
      join(TOOLKIT, 'governance/renames.toml'),
      '[renamed]\n"010-old" = "020-new"\n',
    )

    expect(loadRenames(TOOLKIT)).toEqual(renames({ '010-old': '020-new' }))
  })

  it('should drop a value that is not a string', () => {
    writeFixture(
      join(TOOLKIT, 'governance/renames.toml'),
      '[renamed]\n"010-old" = 3\n"011-old" = "021-new"\n',
    )

    expect(loadRenames(TOOLKIT)).toEqual(renames({ '011-old': '021-new' }))
  })
})

describe('resolveSuccessor', () => {
  it('should follow a chain to its terminal name', () => {
    const ledger = renames({ a: 'b', b: 'c' })

    expect(resolveSuccessor(ledger, sourceIndex('c'), 'a')).toBe('c')
  })

  it('should return nothing for a name the ledger does not declare', () => {
    expect(resolveSuccessor(renames({}), sourceIndex('c'), 'a')).toBeUndefined()
  })

  it('should return nothing when the terminal has no source', () => {
    const ledger = renames({ a: 'b', b: 'c' })

    expect(resolveSuccessor(ledger, sourceIndex('b'), 'a')).toBeUndefined()
  })

  it('should terminate on a cycle and return nothing', () => {
    const ledger = renames({ a: 'b', b: 'a' })

    expect(resolveSuccessor(ledger, sourceIndex(), 'a')).toBeUndefined()
  })
})

describe('successorResolver', () => {
  it('should resolve through the ledger and source tree at the root', () => {
    writeFixture(join(TOOLKIT, 'governance/rules/core/020-new.md'), 'x')
    writeFixture(
      join(TOOLKIT, 'governance/renames.toml'),
      '[renamed]\n"010-old" = "020-new"\n',
    )

    expect(successorResolver(TOOLKIT)('010-old')).toBe('020-new')
  })
})

describe('shipped ledger', () => {
  const ledger = loadRenames(REPO_ROOT)
  const index = indexSourceRules(REPO_ROOT)

  it('should name no live rule as a key', () => {
    const live = [...ledger.keys()].filter((name) => index.has(name))

    expect(live).toEqual([])
  })

  it('should end every chain on a rule the toolkit ships', () => {
    const unresolved = [...ledger.keys()].filter(
      (name) => resolveSuccessor(ledger, index, name) === undefined,
    )

    expect(unresolved).toEqual([])
  })

  it('should carry no cycle', () => {
    const cyclic = [...ledger.keys()].filter((name) =>
      isChainCyclic(ledger, name),
    )

    expect(cyclic).toEqual([])
  })
})
