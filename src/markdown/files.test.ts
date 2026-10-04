import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { resolveMarkdown } from '@/markdown/files'

describe('resolveMarkdown', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-markdown-'))
    // A git hook exports GIT_DIR into every process it runs, and it takes
    // precedence over `cwd`, so an inherited environment initializes the
    // repository somewhere other than the fixture and every case reads empty.
    execSync('git init --quiet', { cwd: root, env: gitEnv() })
    mkdirSync(join(root, 'docs'), { recursive: true })
    writeFileSync(join(root, 'README.md'), '# R\n')
    writeFileSync(join(root, 'docs', 'one.md'), '# One\n')
    writeFileSync(join(root, 'docs', 'two.md'), '# Two\n')
    writeFileSync(join(root, 'docs', 'notes.txt'), 'not markdown\n')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  async function files(args: string[]): Promise<readonly string[]> {
    const scope = await resolveMarkdown(root, args)
    return scope.kind === 'resolved' ? scope.files : []
  }

  it('should take every markdown file when no argument is passed', async () => {
    expect(await files([])).toEqual(['README.md', 'docs/one.md', 'docs/two.md'])
  })

  it('should take every markdown file when the argument is the root itself', async () => {
    // An empty relative path matches no prefix, so the root would otherwise
    // report as an argument that resolved to nothing.
    expect(await files(['.'])).toEqual([
      'README.md',
      'docs/one.md',
      'docs/two.md',
    ])
  })

  it('should narrow a directory argument by prefix', async () => {
    expect(await files(['docs'])).toEqual(['docs/one.md', 'docs/two.md'])
  })

  it('should narrow a glob argument by match', async () => {
    expect(await files(['docs/*.md'])).toEqual(['docs/one.md', 'docs/two.md'])
  })

  it('should take an explicit file path as given', async () => {
    expect(await files(['docs/one.md'])).toEqual(['docs/one.md'])
  })

  it('should name an argument matching no markdown file', async () => {
    const scope = await resolveMarkdown(root, ['nowhere'])

    expect(scope).toMatchObject({ kind: 'resolved', unmatched: ['nowhere'] })
  })

  it('should name a file path that does not exist rather than reading it later', async () => {
    const scope = await resolveMarkdown(root, ['docs/missing.md'])

    expect(scope).toMatchObject({ unmatched: ['docs/missing.md'] })
  })

  it('should report git being unable to answer as distinct from an empty scope', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'canon-untracked-'))

    try {
      expect(await resolveMarkdown(outside, [])).toEqual({
        kind: 'unavailable',
      })
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
