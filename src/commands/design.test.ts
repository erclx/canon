import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

const SCOPED = [
  '[device-classes]',
  'default = ["desktop"]',
  'why = "The board is a canvas"',
  '',
  '[device-classes.scopes.landing]',
  'groups = ["landing"]',
  'paths = ["web/"]',
  'classes = ["phone", "tablet", "desktop"]',
  'why = "The landing page is responsive"',
  '',
].join('\n')

/** Spawns the CLI, since a refusal reports through `process.exitCode` and would set it on the runner. */
async function runClasses(root: string, args: string[]) {
  const result = await execa(
    process.execPath,
    [CLI, 'design', 'classes', '--root', root, ...args],
    { cwd: root, reject: false, timeout: RUN_TIMEOUT_MS },
  )
  return {
    exitCode: result.exitCode,
    stdout: String(result.stdout).trim(),
    stderr: String(result.stderr),
  }
}

async function writeConfig(root: string, text: string): Promise<void> {
  await mkdir(join(root, 'canon', 'config'), { recursive: true })
  await writeFile(join(root, 'canon', 'config', 'device-classes.toml'), text)
}

async function git(root: string, args: string[]): Promise<void> {
  await execa('git', ['-C', root, ...args])
}

describe('canon design classes', { timeout: RUN_TIMEOUT_MS }, () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-design-classes-'))
  })

  afterEach(async () => {
    await rm(root, { force: true, recursive: true })
  })

  it('reads all three classes for a project with no config', async () => {
    const run = await runClasses(root, ['--json'])

    expect(run.exitCode).toBe(0)
    expect(JSON.parse(run.stdout)).toEqual({
      ok: true,
      classes: ['phone', 'tablet', 'desktop'],
      scopes: [],
      defaulted: true,
    })
  })

  it('reads its own file beside a design.toml holding the board keys', async () => {
    await writeConfig(root, SCOPED)
    await writeFile(
      join(root, 'canon', 'config', 'design.toml'),
      'board = ".canon/board"\nproject = "landing"\nreferences = ["https://linear.app/"]\n',
    )

    const run = await runClasses(root, ['web/index.html', '--json'])

    expect(run.exitCode).toBe(0)
    expect(JSON.parse(run.stdout)).toMatchObject({ scopes: ['landing'] })
  })

  it('prints the classes as a comma list without --json', async () => {
    await writeConfig(root, SCOPED)

    const run = await runClasses(root, [])

    expect(run).toMatchObject({ exitCode: 0, stdout: 'desktop' })
  })

  it('reads a scope for a path under its prefix', async () => {
    await writeConfig(root, SCOPED)

    const run = await runClasses(root, ['web/src/index.astro', '--json'])

    expect(JSON.parse(run.stdout)).toMatchObject({
      classes: ['phone', 'tablet', 'desktop'],
      scopes: ['landing'],
      defaulted: false,
    })
  })

  it('reads a scope for a repeated --group', async () => {
    await writeConfig(root, SCOPED)

    const run = await runClasses(root, [
      '--group',
      'board',
      '--group',
      'landing',
      '--json',
    ])

    expect(JSON.parse(run.stdout)).toMatchObject({
      scopes: ['landing'],
      defaulted: true,
    })
  })

  it('refuses a bad class name with exit 1 and the field', async () => {
    await writeConfig(
      root,
      '[device-classes]\ndefault = ["watch"]\nwhy = "x"\n',
    )

    const run = await runClasses(root, ['--json'])

    expect(run.exitCode).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      reason: 'unknown-class',
      field: 'device-classes.default',
    })
    expect(run.stderr).toContain('canon/config/device-classes.toml')
  })

  it('reads the painted paths a branch changed with --changed', async () => {
    await git(root, ['init', '--quiet', '--initial-branch', 'main'])
    await git(root, ['config', 'user.email', 'test@example.com'])
    await git(root, ['config', 'user.name', 'Test'])
    await writeConfig(root, SCOPED)
    await git(root, ['add', '.'])
    await git(root, ['commit', '--quiet', '-m', 'init'])
    await git(root, ['checkout', '--quiet', '-b', 'feat/landing'])
    await mkdir(join(root, 'web'), { recursive: true })
    await writeFile(join(root, 'web', 'index.html'), '<p>hi</p>\n')
    await writeFile(join(root, 'README.md'), '# Readme\n')

    const run = await runClasses(root, ['--changed', '--json'])

    expect(JSON.parse(run.stdout)).toEqual({
      ok: true,
      classes: ['phone', 'tablet', 'desktop'],
      scopes: ['landing'],
      defaulted: false,
    })
  })

  it('refuses --changed where git cannot read the branch', async () => {
    const run = await runClasses(root, ['--changed', '--json'])

    expect(run.exitCode).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      reason: 'unreadable-changes',
    })
  })
})
