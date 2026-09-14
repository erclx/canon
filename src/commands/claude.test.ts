import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seededDirPath } from '@/commands/claude'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-claude-sync-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('seededDirPath', () => {
  it('should resolve wireframes under canon/ for a migrated target holding only that root', () => {
    mkdirSync(join(root, 'canon', 'wireframes'), { recursive: true })

    expect(seededDirPath(root, 'wireframes')).toBe(
      join(root, 'canon', 'wireframes'),
    )
  })

  it('should resolve decisions under canon/ for a migrated target holding only that root', () => {
    mkdirSync(join(root, 'canon', 'decisions'), { recursive: true })

    expect(seededDirPath(root, 'decisions')).toBe(
      join(root, 'canon', 'decisions'),
    )
  })

  it('should resolve memory under .canon/ rather than canon/', () => {
    mkdirSync(join(root, '.canon', 'memory'), { recursive: true })

    expect(seededDirPath(root, 'memory')).toBe(join(root, '.canon', 'memory'))
  })
})
