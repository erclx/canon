import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type GitRunner, readUnmergedCommits } from '@/pr/lift'

const UNRESOLVED = '1111111111111111111111111111111111111111'

describe('readUnmergedCommits', () => {
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

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'canon-unmerged-'))
    await git('init', '-q', '-b', 'main')
    await git('config', 'user.email', 'test@example.com')
    await git('config', 'user.name', 'test')
    await commit({ 'base.ts': 'base\n' }, 'base')
    await git('checkout', '-q', '-b', 'feat')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should list nothing across a merge of the base', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    const head = await mergeMain()

    expect(await readUnmergedCommits(runner, 'main', reviewed, head)).toEqual(
      [],
    )
  })

  it('should list nothing across two merges of the base in a row', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'one\n' }, 'one')
    await mergeMain()
    await onMain({ 'main.ts': 'two\n' }, 'two')
    const head = await mergeMain()

    expect(await readUnmergedCommits(runner, 'main', reviewed, head)).toEqual(
      [],
    )
  })

  it('should list the ordinary commit pushed beside a merge', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    await mergeMain()
    const extra = await commit({ 'feat.ts': 'more\n' }, 'extra')

    expect(await readUnmergedCommits(runner, 'main', reviewed, extra)).toEqual(
      [extra],
    )
  })

  it('should list every commit of a push with no merge in it', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    const one = await commit({ 'feat.ts': 'one\n' }, 'one')
    const two = await commit({ 'feat.ts': 'two\n' }, 'two')

    expect(await readUnmergedCommits(runner, 'main', reviewed, two)).toEqual([
      two,
      one,
    ])
  })

  it('should list the commits of a branch other than the base it merged', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await git('checkout', '-q', '-b', 'other', 'main')
    const foreign = await commit({ 'other.ts': 'other\n' }, 'other')
    await git('checkout', '-q', 'feat')
    await git('merge', '-q', '--no-edit', 'other')
    const head = await git('rev-parse', 'HEAD')

    expect(await readUnmergedCommits(runner, 'main', reviewed, head)).toEqual([
      foreign,
    ])
  })

  it('should resolve a short reviewed commit before reading the range', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    const head = await mergeMain()

    expect(
      await readUnmergedCommits(runner, 'main', reviewed.slice(0, 7), head),
    ).toEqual([])
  })

  it('should read nothing when the reviewed commit does not resolve', async () => {
    const head = await commit({ 'feat.ts': 'feat\n' }, 'feat')

    expect(
      await readUnmergedCommits(runner, 'main', UNRESOLVED, head),
    ).toBeUndefined()
  })

  it('should read nothing when the base does not resolve', async () => {
    const reviewed = await commit({ 'feat.ts': 'feat\n' }, 'feat')
    await onMain({ 'main.ts': 'main\n' }, 'main')
    const head = await mergeMain()

    expect(
      await readUnmergedCommits(runner, 'origin/main', reviewed, head),
    ).toBeUndefined()
  })
})
