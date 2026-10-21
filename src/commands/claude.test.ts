import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { longKeyPathsRuns, seededDirPath } from '@/commands/claude'

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

describe('longKeyPathsRuns', () => {
  const paths = (count: number) =>
    Array.from({ length: count }, (_, n) => `- \`p${n}/\`: path`).join('\n')

  it('should report a Key paths run past five with its line', async () => {
    writeFileSync(
      join(root, 'CLAUDE.md'),
      `# Project\n\n## Key paths\n\n${paths(6)}\n`,
    )

    expect(await longKeyPathsRuns(root)).toEqual([{ line: 5, count: 6 }])
  })

  it('should report nothing for a grouped Key paths', async () => {
    writeFileSync(
      join(root, 'CLAUDE.md'),
      `## Key paths\n\n### Code\n\nThe code.\n\n${paths(4)}\n\n### Content\n\nThe content.\n\n${paths(4)}\n`,
    )

    expect(await longKeyPathsRuns(root)).toEqual([])
  })

  it('should report nothing for a long rules section', async () => {
    writeFileSync(
      join(root, 'CLAUDE.md'),
      `## Behavior\n\n${paths(8)}\n\n## Key paths\n\n${paths(2)}\n`,
    )

    expect(await longKeyPathsRuns(root)).toEqual([])
  })

  it('should report nothing when the target has no CLAUDE.md', async () => {
    expect(await longKeyPathsRuns(root)).toEqual([])
  })
})
