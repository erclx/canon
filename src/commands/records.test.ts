import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateExitCode, type Refusal, type Repair } from '@/commands/records'

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

async function writeMemory(root: string, name: string): Promise<void> {
  const dir = join(root, '.canon', 'memory')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, `${name}.md`),
    [
      '---',
      'title: A rule a reader can act on',
      'description: What the entry settles',
      'category: Project',
      '---',
      '',
      'See `src/gone.ts`.',
      '',
    ].join('\n'),
  )
}

function repair(record: string): Repair {
  return { record, remedy: 'category-from-name', path: record, text: '' }
}

function refusal(record: string): Refusal {
  return { record, message: 'refused' }
}

describe('migrateExitCode', () => {
  it('should return 0 when no finding carries a known transform', () => {
    expect(migrateExitCode([], [], false)).toBe(0)
    expect(migrateExitCode([], [], true)).toBe(0)
  })

  it('should return 1 when every candidate refused on a dry run', () => {
    expect(migrateExitCode([], [refusal('a.md')], false)).toBe(1)
  })

  it('should return 1 when every candidate refused under --write', () => {
    expect(migrateExitCode([], [refusal('a.md')], true)).toBe(1)
  })

  it('should return 2 when a record repaired and --write was not passed', () => {
    expect(migrateExitCode([repair('a.md')], [], false)).toBe(2)
  })

  it('should return 0 when --write applied every repair', () => {
    expect(migrateExitCode([repair('a.md')], [], true)).toBe(0)
  })

  it('should return 1 when --write applied some repairs and refused others', () => {
    expect(migrateExitCode([repair('a.md')], [refusal('b.md')], true)).toBe(1)
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

  it('should write one clean JSON record on stdout and exit 0 with entries due', async () => {
    await writeMemory(root, 'project-moved')

    const result = await runCli([
      'records',
      'stale',
      'memory',
      '--json',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      due: 1,
      entries: [{ name: 'project-moved', unresolved: ['src/gone.ts'] }],
    })
  })

  it('should keep the human report off stdout', async () => {
    await writeMemory(root, 'project-moved')

    const result = await runCli(['records', 'stale', 'memory', '--root', root])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('project-moved')
  })

  it('should refuse a kind other than memory with a reason', async () => {
    const result = await runCli([
      'records',
      'stale',
      'plans',
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

  it('should refuse with no-folder when the pen does not exist', async () => {
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
      reason: 'no-folder',
    })
  })

  it('should refuse a --days value that is not a positive whole number', async () => {
    await writeMemory(root, 'project-moved')

    const result = await runCli([
      'records',
      'stale',
      'memory',
      '--days',
      '0',
      '--json',
      '--root',
      root,
    ])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'bad-days' })
  })
})
