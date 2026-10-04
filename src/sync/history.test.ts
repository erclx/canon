import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import {
  findInstalledOrigin,
  gitBlobHash,
  parseRawLog,
  readHistoryIndex,
} from '@/sync/history'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function commit(path: string, content: string, message: string): string {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  git('add', '--', path)
  git('commit', '-m', message)

  return git('rev-parse', 'HEAD').trim()
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-history-'))
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('gitBlobHash', () => {
  it('should match the object name git computes for the same bytes', () => {
    const content = 'prose rules\n'
    commit('standards/prose.md', content, 'add prose')

    const expected = git('rev-parse', 'HEAD:standards/prose.md').trim()

    expect(gitBlobHash(Buffer.from(content))).toBe(expected)
  })

  it('should hash empty content without a length prefix mismatch', () => {
    commit('standards/empty.md', '', 'add empty')

    const expected = git('rev-parse', 'HEAD:standards/empty.md').trim()

    expect(gitBlobHash(Buffer.alloc(0))).toBe(expected)
  })
})

describe('parseRawLog', () => {
  it('should map a post-image blob to the commit that produced it', () => {
    const output = [
      'aaaaaaa1',
      '',
      ':100644 100644 old1111 new1111 M\tstandards/prose.md',
    ].join('\n')

    expect(parseRawLog(output).get('standards/prose.md')?.get('new1111')).toBe(
      'aaaaaaa1',
    )
  })

  it('should keep the newest commit when a blob repeats across commits', () => {
    const output = [
      'newest0',
      '',
      ':100644 100644 other11 shared1 M\tstandards/prose.md',
      'oldest0',
      '',
      ':100644 100644 first11 shared1 M\tstandards/prose.md',
    ].join('\n')

    expect(parseRawLog(output).get('standards/prose.md')?.get('shared1')).toBe(
      'newest0',
    )
  })

  it('should skip a deletion whose post-image is the empty blob', () => {
    const output = [
      'aaaaaaa1',
      '',
      `:100644 000000 old1111 ${'0'.repeat(40)} D\tstandards/prose.md`,
    ].join('\n')

    expect(parseRawLog(output).get('standards/prose.md')).toBeUndefined()
  })

  it('should separate blobs by path across a multi-file commit', () => {
    const output = [
      'aaaaaaa1',
      '',
      ':100644 100644 old1111 new1111 M\tstandards/prose.md',
      ':100644 100644 old2222 new2222 M\tstandards/skill.md',
    ].join('\n')

    const index = parseRawLog(output)

    expect(index.get('standards/prose.md')?.has('new2222')).toBe(false)
    expect(index.get('standards/skill.md')?.get('new2222')).toBe('aaaaaaa1')
  })

  it('should return an empty index for output with no raw entries', () => {
    expect(parseRawLog('').size).toBe(0)
  })
})

describe('readHistoryIndex', () => {
  it('should collect every historical version of a tracked path', () => {
    const first = commit('standards/prose.md', 'one\n', 'add prose')
    const second = commit('standards/prose.md', 'two\n', 'update prose')

    const index = readHistoryIndex(ROOT, ['standards/prose.md'])
    const blobs = index?.get('standards/prose.md')

    expect(blobs?.get(gitBlobHash(Buffer.from('one\n')))).toBe(first)
    expect(blobs?.get(gitBlobHash(Buffer.from('two\n')))).toBe(second)
  })

  it('should return undefined outside a git repository', () => {
    const unversioned = mkdtempSync(join(tmpdir(), 'canon-unversioned-'))

    expect(
      readHistoryIndex(unversioned, ['standards/prose.md']),
    ).toBeUndefined()

    rmSync(unversioned, { recursive: true, force: true })
  })

  it('should return an empty index without shelling out for no paths', () => {
    expect(readHistoryIndex(ROOT, [])?.size).toBe(0)
  })
})

describe('findInstalledOrigin', () => {
  it('should name the commit whose version matches the installed file', () => {
    const first = commit('standards/prose.md', 'one\n', 'add prose')
    commit('standards/prose.md', 'two\n', 'update prose')

    const installed = join(ROOT, 'installed.md')
    writeFileSync(installed, 'one\n')

    const index = readHistoryIndex(ROOT, ['standards/prose.md'])

    expect(
      findInstalledOrigin(index ?? new Map(), 'standards/prose.md', installed),
    ).toBe(first)
  })

  it('should return undefined for content no version ever held', () => {
    commit('standards/prose.md', 'one\n', 'add prose')

    const installed = join(ROOT, 'installed.md')
    writeFileSync(installed, 'edited by hand\n')

    const index = readHistoryIndex(ROOT, ['standards/prose.md'])

    expect(
      findInstalledOrigin(index ?? new Map(), 'standards/prose.md', installed),
    ).toBeUndefined()
  })

  it('should return undefined for a path the index does not cover', () => {
    const installed = join(ROOT, 'installed.md')
    writeFileSync(installed, 'one\n')

    expect(
      findInstalledOrigin(new Map(), 'standards/absent.md', installed),
    ).toBeUndefined()
  })
})
