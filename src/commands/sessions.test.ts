import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { encodeProjectPath } from '@/sessions/transfer/transcript'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000
const ID = '2cb831b1-b32c-4d57-80a8-d23cbc5ef81e'

let DIR: string
let REPO: string
let CONFIG: string

/**
 * Spawns the CLI so the stdout and stderr split is the one a caller piping the
 * record sees, and points `CLAUDE_CONFIG_DIR` at a scratch folder so nothing
 * reads or writes the operator's real configuration.
 */
async function runSessions(args: string[]): Promise<{
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> {
  const result = await execa(process.execPath, [CLI, 'sessions', ...args], {
    cwd: REPO,
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: CONFIG,
      CANON_NON_INTERACTIVE: '1',
    },
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

beforeEach(async () => {
  DIR = mkdtempSync(join(tmpdir(), 'canon-sessions-cmd-'))
  REPO = join(DIR, 'repo')
  CONFIG = join(DIR, 'config')
  mkdirSync(REPO, { recursive: true })
  await $`git -C ${REPO} init -q -b main`.env(gitEnv()).quiet()
  await $`git -C ${REPO} -c user.email=t@e -c user.name=t commit -q --allow-empty -m init`
    .env(gitEnv())
    .quiet()

  const folder = join(CONFIG, 'projects', '-machine-a-repo')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, `${ID}.jsonl`), '{"type":"user"}\n')
})

afterEach(() => {
  rmSync(DIR, { recursive: true, force: true })
})

describe('canon sessions export', () => {
  it('should write the record alone on stdout', async () => {
    const out = join(DIR, 'bundle.tar.gz')

    const result = await runSessions(['export', ID, '--out', out, '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      path: out,
      sessionId: ID,
    })
  })

  it('should carry the refusal reason on stdout for an unknown id', async () => {
    const result = await runSessions([
      'export',
      '00000000-0000-0000-0000-000000000000',
      '--json',
    ])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      reason: 'not-found',
    })
  })
})

describe('canon sessions import', () => {
  it('should place the bundle under the encoding of the root it names', async () => {
    const out = join(DIR, 'bundle.tar.gz')
    await runSessions(['export', ID, '--out', out])
    rmSync(join(CONFIG, 'projects'), { recursive: true, force: true })

    const result = await runSessions(['import', out, '--root', REPO, '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      folder: join(CONFIG, 'projects', encodeProjectPath(REPO)),
    })
  })

  it('should keep the framed report off stdout without --json', async () => {
    const out = join(DIR, 'bundle.tar.gz')
    await runSessions(['export', ID, '--out', out])
    rmSync(join(CONFIG, 'projects'), { recursive: true, force: true })

    const result = await runSessions(['import', out, '--root', REPO])

    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(`claude --resume ${ID}`)
  })
})

describe('canon sessions list from another pid namespace', () => {
  const FOREIGN_DOMAIN = 'linux:test:pid:[1]'
  const readable = existsSync('/proc/self/ns/pid')

  function seed(socket: string, socketPresent: boolean): void {
    const registry = join(CONFIG, 'sessions')
    mkdirSync(registry, { recursive: true })
    if (socketPresent) writeFileSync(socket, '')
    writeFileSync(
      join(registry, '4242.json'),
      JSON.stringify({
        pid: 4242,
        sessionId: 'id-4242',
        cwd: REPO,
        name: 'canon-4242',
        kind: 'interactive',
        status: 'idle',
        startedAt: 1,
        procStart: '1',
        pidDomain: FOREIGN_DOMAIN,
        messagingSocketPath: socket,
      }),
    )
  }

  it.skipIf(!readable)(
    'should count a foreign record with no socket rather than call its session ended',
    async () => {
      seed(join(DIR, 'gone.sock'), false)

      const result = await runSessions(['list', '--json'])

      expect(JSON.parse(result.stdout)).toMatchObject({
        foreignDead: 1,
        sessions: [],
      })
      expect(result.stderr).toContain('another pid namespace')
      expect(result.stderr).not.toContain('has ended')
    },
  )

  it.skipIf(!readable)(
    'should keep a foreign record whose socket exists and warn that it rests on the socket',
    async () => {
      seed(join(DIR, 'live.sock'), true)

      const result = await runSessions(['list', '--json'])

      expect(JSON.parse(result.stdout)).toMatchObject({
        confidence: 'unverified',
        foreignDead: 0,
        sessions: [{ name: 'canon-4242', via: 'socket' }],
      })
      expect(result.stderr).toContain('messaging socket')
    },
  )

  it.skipIf(!readable)(
    'should confirm a foreign record whose socket accepts and say the listener decided it',
    async () => {
      const socket = join(DIR, 'listening.sock')
      seed(socket, false)
      const server = createServer()
      await new Promise<void>((done) => server.listen(socket, done))

      const result = await runSessions(['list', '--json'])
      await new Promise((done) => server.close(done))

      expect(JSON.parse(result.stdout)).toMatchObject({
        confidence: 'confirmed',
        sessions: [{ name: 'canon-4242', via: 'listener' }],
      })
      expect(result.stderr).toContain('accepted a connection')
    },
  )
})
