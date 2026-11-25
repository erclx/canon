import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

async function runCli(args: string[]) {
  return execa(process.execPath, [CLI, ...args], {
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
}

describe('canon records push', () => {
  let root: string
  let origin: string
  const OVERSIZED_BYTES = 30 * 1024 * 1024

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-records-push-'))
    origin = await mkdtemp(join(tmpdir(), 'canon-records-push-origin-'))
    const gitDir = join(root, '.canon', '.records.git')
    await mkdir(join(root, '.canon', 'design'), { recursive: true })
    await writeFile(join(root, '.canon', 'design', 'entry.md'), '# entry\n')

    const env = gitEnv()
    const options = { env, extendEnv: false }
    await execa('git', ['init', '-q', '--bare', origin], options)
    await execa('git', ['init', '-q', root], options)
    await execa('git', ['--git-dir', gitDir, 'init', '-q'], options)
    await execa(
      'git',
      ['--git-dir', gitDir, 'remote', 'add', 'origin', origin],
      options,
    )

    const shot = join(root, '.canon', 'design', 'shot.png')
    await writeFile(shot, '')
    await truncate(shot, OVERSIZED_BYTES)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(origin, { recursive: true, force: true })
  })

  it('should exit 0 with the skipped record in JSON and its path on stderr', async () => {
    const result = await runCli(['records', 'push', '--json', '--root', root])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      changed: 1,
      skipped: [{ path: 'design/shot.png', bytes: OVERSIZED_BYTES }],
    })
    expect(result.stderr).toContain('design/shot.png (30M)')
  })

  it('should name the skipped record in the human report', async () => {
    const result = await runCli(['records', 'push', '--root', root])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('design/shot.png (30M)')
  })
})

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

  it('should exit 0 on a plan whose questions carry no Evidence line', async () => {
    await writeFile(
      join(root, '.canon', 'plans', 'feature-old.md'),
      [
        '# Feature: Old questions',
        '',
        '## Summary',
        '',
        '- The goal',
        '',
        '## Files to touch',
        '',
        '- `src/a.ts`: the change',
        '',
        '## Verification',
        '',
        '- It runs: `bun test`',
        '',
        '## Risks',
        '',
        'None identified.',
        '',
        '## Review focus',
        '',
        'None identified.',
        '',
        '## Questions',
        '',
        '1. Which check?',
        '   - Suggested: a validate verb, since it reports',
        '   - Answer:',
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
      evidence: { kind: string; record: string }[]
    }
    expect(parsed.findings).toEqual([])
    expect(parsed.evidence).toMatchObject([
      { kind: 'evidence-missing', record: 'feature-old.md' },
    ])
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

  it('should carry no length field on the plans record', async () => {
    const result = await runCli([
      'records',
      'validate',
      'plans',
      '--json',
      '--root',
      root,
    ])

    expect(JSON.parse(result.stdout)).not.toHaveProperty('length')
  })
})

describe('canon records validate sessions', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-records-validate-sessions-'))
    await mkdir(join(root, '.canon', 'tasks'), { recursive: true })
    await writeFile(
      join(root, '.canon', 'tasks', 'session-orchestrator.md'),
      `# Session map\n\n${Array.from({ length: 400 }, () => 'word').join(' ')}\n`,
    )
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should exit 0 on a map over the cap and carry its count', async () => {
    const result = await runCli([
      'records',
      'validate',
      'sessions',
      '--json',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      kind: 'sessions',
      findings: [],
      length: [
        { record: 'session-orchestrator.md', words: 400, cap: 350, over: true },
      ],
    })
  })

  it('should name the count against the cap in the human report', async () => {
    const result = await runCli([
      'records',
      'validate',
      'sessions',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toContain('session-orchestrator.md: 400 of 350 words')
  })
})
