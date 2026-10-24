import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { indexSourceRules } from '@/gov/adapter'
import { loadSplits } from '@/gov/splits'

const REPO_ROOT = join(import.meta.dirname, '..', '..')

let TOOLKIT: string

function writeLedger(content: string): void {
  const path = join(TOOLKIT, 'governance/splits.toml')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

beforeEach(() => {
  TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-gov-splits-'))
})

afterEach(() => {
  rmSync(TOOLKIT, { recursive: true, force: true })
})

describe('loadSplits', () => {
  it('should read a missing ledger as empty', () => {
    expect(loadSplits(TOOLKIT).size).toBe(0)
  })

  it('should map each held rule to its partners', () => {
    writeLedger('[split]\nkeyboard = ["pointer", "other"]\n')

    expect(loadSplits(TOOLKIT)).toEqual(
      new Map([['keyboard', ['pointer', 'other']]]),
    )
  })

  it('should drop an entry whose value is not a list of names', () => {
    writeLedger('[split]\na = "b"\nc = [3]\nd = ["e"]\n')

    expect(loadSplits(TOOLKIT)).toEqual(new Map([['d', ['e']]]))
  })
})

describe('shipped ledger', () => {
  const ledger = loadSplits(REPO_ROOT)
  const index = indexSourceRules(REPO_ROOT)

  it('should name a live rule as every key', () => {
    const retired = [...ledger.keys()].filter((name) => !index.has(name))

    expect(retired).toEqual([])
  })

  it('should name a live rule as every partner', () => {
    const retired = [...ledger.values()]
      .flat()
      .filter((name) => !index.has(name))

    expect(retired).toEqual([])
  })

  it('should list no rule as its own partner', () => {
    const selfPartnered = [...ledger.entries()]
      .filter(([held, partners]) => partners.includes(held))
      .map(([held]) => held)

    expect(selfPartnered).toEqual([])
  })
})
