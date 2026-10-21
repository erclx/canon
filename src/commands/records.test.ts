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

describe('canon records validate plans', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-records-validate-'))
    await mkdir(join(root, '.canon', 'plans'), { recursive: true })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should report an orphan fan-in member as fan-in-unmatched', async () => {
    await writeFile(
      join(root, '.canon', 'plans', 'feature-a.md'),
      [
        '# Feature: A member',
        '',
        '**Constraints:**',
        '',
        '- Fan-in member of `feature-whole`.',
        '',
        '**Files to touch:**',
        '',
        '- `src/a.ts`: the change.',
        '',
      ].join('\n'),
    )

    const result = await runCli([
      'records',
      'validate',
      'plans',
      '--json',
      '--root',
      root,
    ])

    const { findings } = JSON.parse(result.stdout) as {
      findings: { kind: string; record: string; subject: string }[]
    }
    expect(
      findings.filter(({ kind }) => kind === 'fan-in-unmatched'),
    ).toMatchObject([{ record: 'feature-a.md', subject: 'feature-whole' }])
  })

  it('should exit 0 on a plan missing structure criteria alone', async () => {
    await writeFile(
      join(root, '.canon', 'plans', 'feature-old.md'),
      [
        '# Feature: Old shape',
        '',
        '## Summary',
        '',
        '- The goal',
        '',
        '**Files to touch:**',
        '',
        '- `src/a.ts`: the change',
        '',
        '**Verification:**',
        '',
        '- `bun test`',
        '',
        '**Risks:**',
        '',
        'None identified.',
        '',
        '**Review focus:**',
        '',
        'None identified.',
        '',
        '**Questions:**',
        '',
        'None identified.',
        '',
      ].join('\n'),
    )

    const result = await runCli([
      'records',
      'validate',
      'plans',
      '--json',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout) as {
      findings: unknown[]
      structure: { criterion: string }[]
    }
    expect(parsed.findings).toEqual([])
    expect(parsed.structure).toHaveLength(5)
  })

  it('should narrow both arrays to the record named', async () => {
    await writeFile(
      join(root, '.canon', 'plans', 'feature-a.md'),
      '# Feature: A\n\n**Risks:**\n',
    )
    await writeFile(
      join(root, '.canon', 'plans', 'feature-b.md'),
      '# Feature: B\n\n**Risks:**\n',
    )

    const result = await runCli([
      'records',
      'validate',
      'plans',
      'feature-b',
      '--json',
      '--root',
      root,
    ])

    const parsed = JSON.parse(result.stdout) as {
      records: number
      findings: { record: string }[]
      structure: { record: string }[]
    }
    expect(parsed.records).toBe(1)
    expect(
      [...parsed.findings, ...parsed.structure].map(({ record }) => record),
    ).toContain('feature-b.md')
    expect(
      [...parsed.findings, ...parsed.structure].every(
        ({ record }) => record === 'feature-b.md',
      ),
    ).toBe(true)
  })

  it('should keep the cross-plan findings when the record carries .md', async () => {
    await writeFile(
      join(root, '.canon', 'plans', 'feature-a.md'),
      [
        '# Feature: A member',
        '',
        '## Constraints',
        '',
        '- Fan-in member of `feature-whole`.',
        '',
      ].join('\n'),
    )

    const result = await runCli([
      'records',
      'validate',
      'plans',
      'feature-a.md',
      '--json',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(2)
    const { findings } = JSON.parse(result.stdout) as {
      findings: { kind: string; record: string }[]
    }
    expect(
      findings.filter(({ kind }) => kind === 'fan-in-unmatched'),
    ).toMatchObject([{ record: 'feature-a.md' }])
  })

  it('should refuse a record the folder does not hold', async () => {
    const result = await runCli([
      'records',
      'validate',
      'plans',
      'feature-absent',
      '--json',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      reason: 'no-record',
    })
  })
})
