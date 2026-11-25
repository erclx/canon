import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type GitRunner, readChangedPaths, readRebasedPaths } from '@/pr/lift'

const UNRESOLVED = '1111111111111111111111111111111111111111'

describe('readRebasedPaths', () => {
  const LINES = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`)
  let root: string

  async function git(...args: string[]): Promise<string> {
    const result = await execa('git', args, { cwd: root })
    return String(result.stdout).trim()
  }

  // Keeps git's own trailing newline, which a `GitRunner` is not promised to strip.
  const runner: GitRunner = async (args) => {
    const result = await execa('git', [...args], {
      cwd: root,
      reject: false,
      stripFinalNewline: false,
    })
    return result.exitCode === 0 ? String(result.stdout) : undefined
  }

  async function commit(files: Record<string, string>, message: string) {
    for (const [path, text] of Object.entries(files)) {
      writeFileSync(join(root, path), text)
    }
    await git('add', '-A')
    await git('commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD')
  }

  function edit(at: number, text: string, lines = LINES): string {
    return `${lines.map((line, index) => (index === at ? text : line)).join('\n')}\n`
  }

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'canon-rebased-'))
    await git('init', '-q', '-b', 'main')
    await git('config', 'user.email', 'test@example.com')
    await git('config', 'user.name', 'test')
    await commit({ 'shared.ts': `${LINES.join('\n')}\n` }, 'base')
    await git('checkout', '-q', '-b', 'feat')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should read no differing path when main moved lines above the change', async () => {
    await commit({ 'shared.ts': edit(17, 'branch'), 'new.ts': 'x\n' }, 'feat')
    const reviewed = await git('rev-parse', 'HEAD')
    await git('checkout', '-q', 'main')
    await commit(
      { 'shared.ts': `top\n${LINES.join('\n')}\n`, 'other.ts': 'y\n' },
      'main',
    )
    await git('checkout', '-q', 'feat')
    await git('rebase', '-q', 'main')
    const head = await git('rev-parse', 'HEAD')

    expect(await readRebasedPaths(runner, 'main', reviewed, head)).toEqual({
      differingPaths: [],
      ownPaths: ['new.ts', 'shared.ts'],
    })
  })

  it('should read no differing path when the commits were squashed', async () => {
    await commit({ 'shared.ts': edit(17, 'branch') }, 'one')
    const reviewed = await commit({ 'new.ts': 'x\n' }, 'two')
    await git('checkout', '-q', '-b', 'squashed', 'main')
    const head = await commit(
      { 'shared.ts': edit(17, 'branch'), 'new.ts': 'x\n' },
      'both',
    )

    expect(await readRebasedPaths(runner, 'main', reviewed, head)).toEqual({
      differingPaths: [],
      ownPaths: ['new.ts', 'shared.ts'],
    })
  })

  it('should name a path whose conflict was resolved inside the change', async () => {
    const reviewed = await commit(
      { 'shared.ts': edit(17, 'branch'), 'new.ts': 'x\n' },
      'feat',
    )
    await git('checkout', '-q', 'main')
    const moved = edit(17, 'main')
    await commit({ 'shared.ts': moved }, 'main')
    await git('checkout', '-q', '-b', 'resolved', 'main')
    const head = await commit(
      { 'shared.ts': edit(17, 'branch and main'), 'new.ts': 'x\n' },
      'resolved',
    )

    expect(await readRebasedPaths(runner, 'main', reviewed, head)).toEqual({
      differingPaths: ['shared.ts'],
      ownPaths: ['new.ts', 'shared.ts'],
    })
  })

  it('should name only the added path when it sorts after an unchanged one', async () => {
    const reviewed = await commit({ 'shared.ts': edit(17, 'branch') }, 'feat')
    await git('checkout', '-q', '-b', 'rewritten', 'main')
    const head = await commit(
      { 'shared.ts': edit(17, 'branch'), 'z-notes.md': 'notes\n' },
      'feat and notes',
    )

    expect(await readRebasedPaths(runner, 'main', reviewed, head)).toEqual({
      differingPaths: ['z-notes.md'],
      ownPaths: ['shared.ts', 'z-notes.md'],
    })
  })

  it('should name a path a dropped commit carried', async () => {
    await commit({ 'shared.ts': edit(17, 'branch') }, 'one')
    const reviewed = await commit({ 'new.ts': 'x\n' }, 'two')
    await git('checkout', '-q', '-b', 'dropped', 'main')
    const head = await commit({ 'new.ts': 'x\n' }, 'two')

    expect(await readRebasedPaths(runner, 'main', reviewed, head)).toEqual({
      differingPaths: ['shared.ts'],
      ownPaths: ['new.ts', 'shared.ts'],
    })
  })

  it('should list as own a path only one end of the branch wrote', async () => {
    const reviewed = await commit({ 'dropped.ts': 'x\n' }, 'feat')
    await git('checkout', '-q', '-b', 'rewritten', 'main')
    const head = await commit({ 'added.ts': 'x\n' }, 'rewritten')

    const read = await readRebasedPaths(runner, 'main', reviewed, head)

    expect(read?.ownPaths).toEqual(['added.ts', 'dropped.ts'])
  })

  it('should list no path main alone wrote under a merge', async () => {
    const reviewed = await commit({ 'new.ts': 'x\n' }, 'feat')
    await git('checkout', '-q', 'main')
    await commit({ 'main-only.ts': 'y\n' }, 'main')
    await git('checkout', '-q', 'feat')
    await git('merge', '-q', '--no-edit', 'main')
    const head = await git('rev-parse', 'HEAD')

    expect(await readRebasedPaths(runner, 'main', reviewed, head)).toEqual({
      differingPaths: [],
      ownPaths: ['new.ts'],
    })
  })

  it('should spell a quoted path the way readChangedPaths does', async () => {
    const from = await commit({ 'one.ts': 'x\n' }, 'one')
    const to = await commit({ 'caf\u00e9.ts': 'x\n' }, 'two')

    const changed = await readChangedPaths(runner, from, to)
    const read = await readRebasedPaths(runner, 'main', from, to)

    expect(read?.differingPaths).toEqual(changed?.paths)
  })

  it('should read nothing when the reviewed commit does not resolve', async () => {
    const head = await commit({ 'new.ts': 'x\n' }, 'feat')

    expect(
      await readRebasedPaths(runner, 'main', UNRESOLVED, head),
    ).toBeUndefined()
  })
})
