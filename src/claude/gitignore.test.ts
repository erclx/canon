import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { claudeChain, pendingEntries, planGitignore } from '@/claude/gitignore'

const MANIFEST = `[stack]
name = "claude"
extends = ""

[gitignore]
"# Claude" = [".canon/tmp/", ".claude/plans/", ".claude/tasks/"]
`

const dirs: string[] = []

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'canon-claude-gi-'))
  dirs.push(dir)
  return dir
}

async function makeRoot(): Promise<string> {
  const root = await makeDir()
  await mkdir(join(root, 'tooling', 'claude'), { recursive: true })
  await writeFile(join(root, 'tooling', 'claude', 'manifest.toml'), MANIFEST)
  return root
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

describe('claudeChain', () => {
  it('should resolve the claude manifest alone', async () => {
    const root = await makeRoot()

    const chain = claudeChain(root)

    expect(chain.map((manifest) => manifest.name)).toEqual(['claude'])
  })
})

describe('planGitignore', () => {
  it('should report every entry as pending when the file is absent', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    const entries = planGitignore(claudeChain(root), target)

    expect(entries).toEqual([
      { entry: '.canon/tmp/', present: false },
      { entry: '.claude/plans/', present: false },
      { entry: '.claude/tasks/', present: false },
    ])
  })

  it('should report an entry the file already lists as present', async () => {
    const root = await makeRoot()
    const target = await makeDir()
    await writeFile(join(target, '.gitignore'), '.claude/plans/\n')

    const entries = planGitignore(claudeChain(root), target)

    expect(pendingEntries(entries).map((entry) => entry.entry)).toEqual([
      '.canon/tmp/',
      '.claude/tasks/',
    ])
  })

  it('should treat a directory entry without its trailing slash as present', async () => {
    const root = await makeRoot()
    const target = await makeDir()
    await writeFile(join(target, '.gitignore'), '.canon/tmp\n')

    const entries = planGitignore(claudeChain(root), target)

    expect(entries[0]).toEqual({ entry: '.canon/tmp/', present: true })
  })

  it('should not match an entry that only appears as a substring', async () => {
    const root = await makeRoot()
    const target = await makeDir()
    await writeFile(join(target, '.gitignore'), '!.claude/plans/\n')

    const entries = planGitignore(claudeChain(root), target)

    expect(entries[1]).toEqual({ entry: '.claude/plans/', present: false })
  })

  it('should read a manifest whose array spans several lines', async () => {
    const root = await makeDir()
    await mkdir(join(root, 'tooling', 'claude'), { recursive: true })
    await writeFile(
      join(root, 'tooling', 'claude', 'manifest.toml'),
      '[stack]\nname = "claude"\n\n[gitignore]\n"# Claude" = [\n  ".canon/tmp/",\n  ".claude/plans/",\n]\n',
    )
    const target = await makeDir()

    const entries = planGitignore(claudeChain(root), target)

    expect(entries.map((entry) => entry.entry)).toEqual([
      '.canon/tmp/',
      '.claude/plans/',
    ])
  })

  it('should preserve manifest order rather than sorting', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    const entries = planGitignore(claudeChain(root), target)

    expect(entries.map((entry) => entry.entry)).toEqual([
      '.canon/tmp/',
      '.claude/plans/',
      '.claude/tasks/',
    ])
  })
})
