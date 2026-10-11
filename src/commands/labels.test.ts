import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because the refusal
 * reports through `process.exitCode` and an in-process call would set it on
 * the test runner.
 */
interface ScanRecord {
  readonly titleFormatIssues: string[]
  readonly sections?: {
    readonly checked: boolean
    readonly outside: string[]
    readonly missing: string[]
  }
  readonly bannedCharacters: string[]
  readonly exitCode: number
}

async function runScan(args: string[]): Promise<ScanRecord> {
  const result = await execa(
    process.execPath,
    [CLI, 'labels', 'scan', '--json', ...args],
    {
      reject: false,
      timeout: RUN_TIMEOUT_MS,
    },
  )
  const record = JSON.parse(result.stdout) as Omit<ScanRecord, 'exitCode'>
  return { ...record, exitCode: result.exitCode ?? -1 }
}

describe('canon labels scan title format gate', () => {
  let cwdDir: string

  beforeEach(async () => {
    cwdDir = await mkdtemp(join(tmpdir(), 'canon-labels-scan-'))
  })

  afterEach(async () => {
    await rm(cwdDir, { recursive: true, force: true })
  })

  it('should skip the title format grade when --body-file carries no title', async () => {
    const bodyFile = join(cwdDir, 'reply.md')
    await writeFile(bodyFile, 'Looks good, one nit below.\n')

    const { titleFormatIssues } = await runScan(['--body-file', bodyFile])

    expect(titleFormatIssues).toEqual([])
  })

  it('should still grade a supplied title against the format rules', async () => {
    const { titleFormatIssues } = await runScan([
      '--title',
      'not a conventional title',
    ])

    expect(titleFormatIssues).toEqual(['structure'])
  })
})

describe('canon labels scan text checks', () => {
  let cwdDir: string

  beforeEach(async () => {
    cwdDir = await mkdtemp(join(tmpdir(), 'canon-labels-scan-'))
  })

  afterEach(async () => {
    await rm(cwdDir, { recursive: true, force: true })
  })

  async function writeBody(body: string): Promise<string> {
    const file = join(cwdDir, 'body.md')
    await writeFile(file, body)
    return file
  }

  async function writeEvent(payload: unknown): Promise<string> {
    const file = join(cwdDir, 'event.json')
    await writeFile(file, JSON.stringify(payload))
    return file
  }

  const TITLE = 'feat(x): add y'

  it('should fail a body carrying a heading outside the closed list', async () => {
    const body = await writeBody(
      '## Summary\n\n- a\n\n## Commits\n\n- b\n\n## Whatever\n',
    )

    const record = await runScan(['--title', TITLE, '--body-file', body])

    expect(record.exitCode).toBe(2)
    expect(record.sections?.outside).toEqual(['## Whatever'])
    expect(record.sections?.missing).toEqual(['## Key changes'])
  })

  it('should pass a body holding the required pair', async () => {
    const body = await writeBody('## Summary\n\n- a\n\n## Key changes\n\n- b\n')

    const record = await runScan(['--title', TITLE, '--body-file', body])

    expect(record.exitCode).toBe(0)
  })

  it('should skip the headings check on a review event', async () => {
    const event = await writeEvent({
      review: { body: '## Review\n\n- fine\n' },
      pull_request: { head: { ref: 'feat/x' } },
    })

    const record = await runScan(['--event', event])

    expect(record.exitCode).toBe(0)
    expect(record.sections?.checked).toBe(false)
  })

  it('should exempt a release pull request from the headings check', async () => {
    const body = await writeBody('## [1.2.0](https://example.com)\n\n- a\n')

    const record = await runScan([
      '--title',
      'chore(main): release 1.2.0',
      '--body-file',
      body,
      '--head',
      'release-please--branches--main',
    ])

    expect(record.sections?.checked).toBe(false)
  })

  it('should skip the headings check on a body scanned with no title', async () => {
    const body = await writeBody('Looks good.\n')

    const record = await runScan(['--body-file', body])

    expect(record.sections?.checked).toBe(false)
    expect(record.exitCode).toBe(0)
  })

  it('should pass the review headings on a body-file scan with no event', async () => {
    const body = await writeBody(
      '## Review\n\n- a\n\n## Review closed\n\n## UI review\n\n## Review response\n',
    )

    const record = await runScan(['--body-file', body])

    expect(record.sections?.checked).toBe(false)
    expect(record.exitCode).toBe(0)
  })

  it('should fail an em dash in a title', async () => {
    const record = await runScan(['--title', 'feat(x): add y \u2014 now'])

    expect(record.exitCode).toBe(2)
    expect(record.bannedCharacters).toEqual(['\u2014'])
  })

  it('should fail a semicolon in a review body', async () => {
    const event = await writeEvent({
      review: { body: 'one; two\n' },
      pull_request: { head: { ref: 'feat/x' } },
    })

    const record = await runScan(['--event', event])

    expect(record.exitCode).toBe(2)
    expect(record.bannedCharacters).toEqual([';'])
  })

  it('should pass a banned character inside a code span', async () => {
    const body = await writeBody(
      '## Summary\n\n- quotes `&quot;` here\n\n## Key changes\n\n- b\n',
    )

    const record = await runScan(['--title', TITLE, '--body-file', body])

    expect(record.bannedCharacters).toEqual([])
  })
})
