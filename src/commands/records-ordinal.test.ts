import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

let root: string

function ordinal(args: string[]) {
  return execa(
    process.execPath,
    [CLI, 'records', 'ordinal', ...args, '--root', root],
    {
      cwd: root,
      reject: false,
      timeout: RUN_TIMEOUT_MS,
    },
  )
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-records-ordinal-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('records ordinal', () => {
  it('should report the next ordinal without creating anything', async () => {
    const result = await ordinal(['intake', 'first-topic', '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      ordinal: '01',
      claimed: false,
    })
    expect(existsSync(join(root, '.canon', 'intake', '01-first-topic'))).toBe(
      false,
    )
  })

  it('should create the folder atomically with --claim', async () => {
    const result = await ordinal([
      'groundwork',
      'first-topic',
      '--claim',
      '--json',
    ])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      kind: 'groundwork',
      ordinal: '01',
      name: '01-first-topic',
      claimed: true,
    })
    expect(
      existsSync(join(root, '.canon', 'groundwork', '01-first-topic')),
    ).toBe(true)
  })

  it('should refuse an unknown kind', async () => {
    const result = await ordinal(['plans', 'a-topic', '--json'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      reason: 'unknown-kind',
    })
  })
})
