import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

async function runCli(args: string[]) {
  return execa(process.execPath, [CLI, ...args], {
    reject: false,
    timeout: RUN_TIMEOUT_MS,
    env: { CANON_NON_INTERACTIVE: '1' },
  })
}

describe('canon records stale', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-records-stale-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should refuse memory as an unknown kind now the pen is retired', async () => {
    const result = await runCli([
      'records',
      'stale',
      'memory',
      '--json',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      reason: 'unknown-kind',
    })
  })
})

describe('canon records stale canonical', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-records-stale-canonical-'))
    await execa('git', ['init', '-q', '--initial-branch=main'], { cwd: root })
    await execa(
      'git',
      [
        '-c',
        'user.email=test@example.com',
        '-c',
        'user.name=Test',
        'commit',
        '--allow-empty',
        '-q',
        '-m',
        'chore: init',
      ],
      { cwd: root },
    )
    await mkdir(join(root, 'canon'), { recursive: true })
    await writeFile(join(root, 'canon', 'REQUIREMENTS.md'), '# Requirements\n')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should write one JSON record naming each doc and exit 0', async () => {
    const result = await runCli([
      'records',
      'stale',
      'canonical',
      '--json',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      tagged: false,
      docs: [{ path: 'canon/REQUIREMENTS.md', reviewed: null }],
    })
  })

  it('should keep the human report off stdout', async () => {
    const result = await runCli([
      'records',
      'stale',
      'canonical',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('canon/REQUIREMENTS.md')
  })

})
