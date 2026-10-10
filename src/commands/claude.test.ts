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
  it('should resolve a surface entry under canon/ for a migrated target holding only that root', () => {
    mkdirSync(join(root, 'canon', 'context'), { recursive: true })

    expect(seededDirPath(root, 'context')).toBe(join(root, 'canon', 'context'))
  })

  it('should not resolve a retired decisions folder under canon/', () => {
    mkdirSync(join(root, 'canon', 'decisions'), { recursive: true })

    expect(seededDirPath(root, 'decisions')).not.toBe(
      join(root, 'canon', 'decisions'),
    )
  })

  it('should resolve tasks under .canon/ rather than canon/', () => {
    mkdirSync(join(root, '.canon', 'tasks'), { recursive: true })

    expect(seededDirPath(root, 'tasks')).toBe(join(root, '.canon', 'tasks'))
  })
})
