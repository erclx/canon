import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

async function runCli(
  args: string[],
  opts: { readonly cwd: string; readonly env?: Record<string, string> },
) {
  return execa(process.execPath, [CLI, ...args], {
    cwd: opts.cwd,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
    env: opts.env ?? {},
  })
}

/** Stamps a folder the way a current install leaves it, with a real syncedAt. */
async function stamp(root: string, ...segments: string[]): Promise<string> {
  const target = join(root, ...segments)
  const path = join(target, '.claude', 'canon', 'config.json')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(
    path,
    JSON.stringify({
      covers: ['governance'],
      domains: {
        governance: { syncedAt: '2026-08-30T00:00:00.000Z', files: {} },
      },
    }),
  )
  return target
}

describe('canon targets list --record', () => {
  let sweepRoot: string
  let blockedFile: string

  beforeEach(async () => {
    sweepRoot = await mkdtemp(join(tmpdir(), 'canon-targets-record-'))
    blockedFile = join(sweepRoot, 'blocked-state')
    await writeFile(blockedFile, 'not a directory\n')
  })

  afterEach(async () => {
    await rm(sweepRoot, { recursive: true, force: true })
  })

  // A write the registry cannot land, such as a state folder it has no
  // permission to write, used to fall into the same "no readable stamp"
  // bucket as a checkout with nothing to date the row by, which names the
  // wrong cause and left the exit code at 0 over a real failure.
  //
  // The fixture sits under the OS temp folder, which the index refuses, so the
  // child is handed a temp folder elsewhere to let the write be attempted.
  it('should report a write failure distinctly and exit 1', async () => {
    await stamp(sweepRoot, 'caret')

    const result = await runCli(
      ['targets', 'list', '--sweep', sweepRoot, '--record'],
      {
        cwd: sweepRoot,
        env: {
          CANON_STATE_DIR: join(blockedFile, 'canon'),
          TMPDIR: join(blockedFile, 'tmp'),
        },
      },
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('failed to write')
    expect(result.stderr).not.toContain('no readable stamp')
  })

  // A checkout under a scratch root is refused by design, which is neither a
  // missing stamp nor a failed write, so it must not turn the exit to 1.
  it('should skip a checkout under a scratch root and exit 0', async () => {
    await stamp(sweepRoot, 'caret')

    const result = await runCli(
      ['targets', 'list', '--sweep', sweepRoot, '--record'],
      {
        cwd: sweepRoot,
        env: {
          CANON_STATE_DIR: join(sweepRoot, 'state'),
          TMPDIR: dirname(sweepRoot),
        },
      },
    )

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toContain('scratch folder')
    expect(result.stderr).not.toContain('failed to write')
  })
})
