import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type GitRunner,
  readChangedPaths,
  readRebasedPaths,
  readUnmergedCommits,
  reviewGate,
} from '@/pr/lift'

const LINES = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`)

function edit(at: number, text: string): string {
  return `${LINES.map((line, index) => (index === at ? text : line)).join('\n')}\n`
}

function closedAt(commit: string) {
  return {
    body: `## Review closed\n\nclean\n<!-- review-pr: commit=${commit} read-at=2026-11-23T10:00:00Z -->`,
  }
}

describe('reviewGate across a merge of the base', () => {
  let root: string

  async function git(...args: string[]): Promise<string> {
    const result = await execa('git', args, { cwd: root })
    return String(result.stdout).trim()
  }

  const runner: GitRunner = async (args) => {
    const result = await execa('git', [...args], {
      cwd: root,
      reject: false,
      stripFinalNewline: false,
    })
    return result.exitCode === 0 ? String(result.stdout) : undefined
  }

  const api = {
    readChanged: (from: string, to: string) =>
      readChangedPaths(runner, from, to),
    readRebased: (from: string, to: string) =>
      readRebasedPaths(runner, 'main', from, to),
    readUnmerged: (from: string, to: string) =>
      readUnmergedCommits(runner, 'main', from, to),
  }

  async function commit(files: Record<string, string>, message: string) {
    for (const [path, text] of Object.entries(files)) {
      writeFileSync(join(root, path), text)
    }
    await git('add', '-A')
    await git('commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD')
  }

  async function onMain(files: Record<string, string>, message: string) {
    await git('checkout', '-q', 'main')
    await commit(files, message)
    await git('checkout', '-q', 'feat')
  }

  async function mergeMain(): Promise<string> {
    await git('merge', '-q', '--no-edit', 'main')
    return git('rev-parse', 'HEAD')
  }

  /** A merge of main carrying an edit no parent holds. */
  async function mergeMainWith(files: Record<string, string>): Promise<string> {
    await git('merge', '-q', '--no-commit', '--no-ff', 'main')
    for (const [path, text] of Object.entries(files)) {
      writeFileSync(join(root, path), text)
    }
    await git('add', '-A')
    await git('commit', '-q', '--no-edit')
    return git('rev-parse', 'HEAD')
  }

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'canon-merge-carry-'))
    await git('init', '-q', '-b', 'main')
    await git('config', 'user.email', 'test@example.com')
    await git('config', 'user.name', 'test')
    await commit(
      { 'shared.ts': `${LINES.join('\n')}\n`, 'other.ts': 'other\n' },
      'base',
    )
    await git('checkout', '-q', '-b', 'feat')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should carry the close across a clean merge of the base', async () => {
    const reviewed = await commit({ 'shared.ts': edit(17, 'branch') }, 'feat')
    await onMain({ 'shared.ts': edit(2, 'main'), 'main.ts': 'm\n' }, 'main')
    const head = await mergeMain()

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toEqual({
      gate: 'review',
      isOk: true,
      carriedFrom: reviewed,
      carriedAcross: 'merge',
    })
  })

  it('should carry the close across two merges of the base in a row', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'one\n' }, 'one')
    await mergeMain()
    await onMain({ 'main.ts': 'two\n' }, 'two')
    const head = await mergeMain()

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toMatchObject({
      isOk: true,
      carriedAcross: 'merge',
    })
  })

  it('should carry the close named by a short commit', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    const head = await mergeMain()

    expect(
      await reviewGate(api, [closedAt(reviewed.slice(0, 7))], head),
    ).toMatchObject({ isOk: true, carriedAcross: 'merge' })
  })

  it('should refuse a merge whose conflict was resolved by hand', async () => {
    const reviewed = await commit({ 'shared.ts': edit(10, 'branch') }, 'feat')
    await onMain({ 'shared.ts': edit(10, 'main') }, 'main')
    await execa('git', ['merge', '-q', 'main'], { cwd: root, reject: false })
    const head = await commit({ 'shared.ts': edit(10, 'resolved') }, 'merge')

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toEqual({
      gate: 'review',
      isOk: false,
      reason: 'review-behind',
      differingPaths: ['shared.ts'],
    })
  })

  it('should refuse a merge carrying an edit inside the branch diff', async () => {
    const reviewed = await commit({ 'shared.ts': edit(17, 'branch') }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    const head = await mergeMainWith({ 'shared.ts': edit(17, 'sneaked') })

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toMatchObject({
      isOk: false,
      reason: 'review-behind',
      differingPaths: ['shared.ts'],
    })
  })

  it('should refuse a merge carrying an edit outside the branch diff', async () => {
    const reviewed = await commit({ 'shared.ts': edit(17, 'branch') }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    const head = await mergeMainWith({ 'other.ts': 'sneaked\n' })

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toMatchObject({
      isOk: false,
      reason: 'review-behind',
      differingPaths: ['other.ts'],
    })
  })

  it('should refuse a merge that brought a base change beside the branch hunk', async () => {
    const reviewed = await commit({ 'shared.ts': edit(10, 'branch') }, 'feat')
    await onMain({ 'shared.ts': edit(12, 'main') }, 'main')
    const head = await mergeMain()

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toMatchObject({
      isOk: false,
      reason: 'review-behind',
      differingPaths: ['shared.ts'],
    })
  })

  it('should refuse a merge beside an ordinary commit', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    await mergeMain()
    const head = await commit({ 'feat.ts': 'more\n' }, 'more')

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toEqual({
      gate: 'review',
      isOk: false,
      reason: 'review-behind',
    })
  })

  it('should refuse a commit pushed and reverted beside a merge', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    await mergeMain()
    const pushed = await commit({ 'feat.ts': 'more\n' }, 'more')
    await git('revert', '--no-edit', pushed)
    const head = await git('rev-parse', 'HEAD')

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toEqual({
      gate: 'review',
      isOk: false,
      reason: 'review-behind',
    })
  })

  it('should refuse a merge of a branch other than the base', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await git('checkout', '-q', '-b', 'side', 'main')
    await commit({ 'side.ts': 'side\n' }, 'side')
    await git('checkout', '-q', 'feat')
    await git('merge', '-q', '--no-edit', 'side')
    const head = await git('rev-parse', 'HEAD')

    expect(await reviewGate(api, [closedAt(reviewed)], head)).toEqual({
      gate: 'review',
      isOk: false,
      reason: 'review-behind',
    })
  })

  it('should refuse a merge when the base does not resolve', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    const head = await mergeMain()
    const unresolved = {
      ...api,
      readUnmerged: (from: string, to: string) =>
        readUnmergedCommits(runner, 'origin/main', from, to),
    }

    expect(await reviewGate(unresolved, [closedAt(reviewed)], head)).toEqual({
      gate: 'review',
      isOk: false,
      reason: 'review-behind',
    })
  })
})
