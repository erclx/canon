import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveOutDir } from '@/commands/transcripts'
import { recordDir } from '@/record-root'
import { mainWorktreeRoot } from '@/worktree'

describe('resolveOutDir', () => {
  it('resolves a caller-supplied --out against the CWD', async () => {
    expect(await resolveOutDir({ out: 'custom-transcripts' })).toBe(
      resolve(process.cwd(), 'custom-transcripts'),
    )
  })

  it('defaults to the backed transcripts record folder at the main worktree root', async () => {
    const expected = recordDir(await mainWorktreeRoot(), 'transcripts')
    expect(await resolveOutDir({})).toBe(expected)
  })
})
