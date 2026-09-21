import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import { buildReverseReport } from '@/sync/reverse'

let TARGET: string
let TOOLKIT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', TOOLKIT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function write(root: string, rel: string, content = 'body\n'): void {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function writeTarget(rel: string, content = 'body\n'): void {
  write(TARGET, rel, content)
}

function commit(rel: string, content: string, message: string): void {
  write(TOOLKIT, rel, content)
  git('add', '--all')
  git('commit', '-m', message)
}

function drop(rel: string, message: string): void {
  git('rm', '-r', '--quiet', '--', rel)
  git('commit', '-m', message)
}

/**
 * The shape every unclaimed case needs: a root the toolkit shipped and then
 * deleted, plus a live root it still ships so the filter has something to
 * reject.
 */
function seedToolkit(): void {
  commit(join('prompts', 'bash.md'), 'bash prompt\n', 'add prompts')
  commit(join('standards', 'prose.md'), 'prose rules\n', 'add standards')
  drop('prompts', 'move prompts into skills')
}

beforeEach(() => {
  TARGET = mkdtempSync(join(tmpdir(), 'canon-reverse-'))
  TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-reverse-toolkit-'))
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
})

afterEach(() => {
  rmSync(TARGET, { recursive: true, force: true })
  rmSync(TOOLKIT, { recursive: true, force: true })
})

describe('buildReverseReport', () => {
  it('should report nothing for a target holding no dropped root', () => {
    seedToolkit()
    writeTarget(join('.claude', 'standards', 'prose.md'), 'prose rules\n')

    expect(buildReverseReport(TOOLKIT, TARGET).unclaimed).toEqual([])
  })

  it('should report a dropped folder the target still holds', () => {
    seedToolkit()
    writeTarget(join('prompts', 'bash.md'), 'bash prompt\n')

    const [entry] = buildReverseReport(TOOLKIT, TARGET).unclaimed

    expect(entry?.rel).toBe('prompts')
    expect(entry?.files).toBe(1)
  })

  it('should attribute a folder matching a published version as dropped', () => {
    seedToolkit()
    writeTarget(join('prompts', 'bash.md'), 'bash prompt\n')

    expect(buildReverseReport(TOOLKIT, TARGET).unclaimed[0]?.attribution).toBe(
      'dropped',
    )
  })

  it('should name the commit whose version the target still holds', () => {
    seedToolkit()
    writeTarget(join('prompts', 'bash.md'), 'bash prompt\n')

    const expected = git('rev-list', '--max-parents=0', 'HEAD').trim()

    expect(buildReverseReport(TOOLKIT, TARGET).unclaimed[0]?.since).toBe(
      expected,
    )
  })

  it('should attribute a name collision the toolkit never shipped as project', () => {
    seedToolkit()
    writeTarget(join('prompts', 'our-own.md'), 'written here\n')

    expect(buildReverseReport(TOOLKIT, TARGET).unclaimed[0]?.attribution).toBe(
      'project',
    )
  })

  it('should attribute a shipped path holding unpublished content as unattributed', () => {
    seedToolkit()
    writeTarget(join('prompts', 'bash.md'), 'edited by hand\n')

    expect(buildReverseReport(TOOLKIT, TARGET).unclaimed[0]?.attribution).toBe(
      'unattributed',
    )
  })

  it('should find a dropped root the target holds under .claude', () => {
    seedToolkit()
    writeTarget(join('.claude', 'prompts', 'bash.md'), 'bash prompt\n')

    const [entry] = buildReverseReport(TOOLKIT, TARGET).unclaimed

    expect(entry?.rel).toBe(join('.claude', 'prompts'))
    expect(entry?.attribution).toBe('dropped')
  })

  it('should not report a root the toolkit still ships', () => {
    seedToolkit()
    git('rm', '--quiet', '--', join('standards', 'prose.md'))
    commit(join('standards', 'markdown.md'), 'markdown rules\n', 'swap files')
    writeTarget(join('standards', 'prose.md'), 'prose rules\n')

    expect(buildReverseReport(TOOLKIT, TARGET).unclaimed).toEqual([])
  })

  it('should ignore an empty folder at a dropped root', () => {
    seedToolkit()
    mkdirSync(join(TARGET, 'prompts'), { recursive: true })

    expect(buildReverseReport(TOOLKIT, TARGET).unclaimed).toEqual([])
  })

  it('should count every file in the folder, not only the matched one', () => {
    seedToolkit()
    writeTarget(join('prompts', 'bash.md'), 'bash prompt\n')
    writeTarget(join('prompts', 'nested', 'ours.md'), 'written here\n')

    expect(buildReverseReport(TOOLKIT, TARGET).unclaimed[0]?.files).toBe(2)
  })

  it('should report history unavailable outside a git clone', () => {
    const unversioned = mkdtempSync(join(tmpdir(), 'canon-reverse-plain-'))
    writeTarget(join('prompts', 'bash.md'))

    const report = buildReverseReport(unversioned, TARGET)

    expect(report.historyUnavailable).toBe(true)
    expect(report.unclaimed).toEqual([])

    rmSync(unversioned, { recursive: true, force: true })
  })
})
