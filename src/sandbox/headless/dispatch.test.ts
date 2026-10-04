import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  describeSession,
  installDispatchShim,
  processGroupOf,
  reapProcessGroup,
  sessionsBetween,
  sessionsConcurrent,
  snapshotSessions,
} from '@/sandbox/headless/dispatch'

let root: string

// Stands in for the real binary everywhere below. It records that it ran and
// echoes its arguments, so a case can tell delegation from a refusal by whether
// the file exists rather than by reading the shim's own exit code twice.
const stubClaude = (): string => {
  const stub = join(root, 'stub-claude')
  writeFileSync(
    stub,
    [
      '#!/usr/bin/env bash',
      `touch "${join(root, 'delegated')}"`,
      'echo "$@"',
    ].join('\n'),
    { mode: 0o755 },
  )

  return stub
}

const runShim = (args: string[]) => {
  const shimDir = join(root, 'shim')
  mkdirSync(shimDir)
  installDispatchShim(shimDir, stubClaude())

  return spawnSync(join(shimDir, 'claude'), args, { encoding: 'utf8' })
}

// Each case starts its process in a group of its own, the way the runner starts
// the session, since reaping a group this test process belongs to is the one
// thing the function refuses.
const startGroup = (command: string, args: string[] = []): ChildProcess =>
  spawn(command, args, { detached: true, stdio: 'ignore' })

const exited = (child: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve()
    else child.once('exit', () => resolve())
  })

// Settles on the script having passed its `trap` line rather than on a fixed
// pause, which under load can land before the trap and let SIGTERM end it.
const waitForFile = async (path: string): Promise<void> => {
  const deadline = Date.now() + 10_000
  while (!existsSync(path)) {
    if (Date.now() > deadline) throw new Error(`${path} never appeared`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const writeScript = (name: string, lines: string[]): string => {
  const path = join(root, name)
  writeFileSync(path, ['#!/usr/bin/env bash', ...lines].join('\n'), {
    mode: 0o755,
  })

  return path
}

const sessionsDir = (): string => {
  const dir = join(root, 'config/sessions')
  mkdirSync(dir, { recursive: true })

  return dir
}

const writeRecord = (name: string, body: object): void => {
  writeFileSync(join(root, 'config/sessions', name), JSON.stringify(body))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sandbox-headless-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('installDispatchShim', () => {
  it('should refuse a background dispatch without reaching the real binary', () => {
    const run = runShim(['-p', 'ship it', '--bg'])

    expect(run.status).toBe(64)
    expect(run.stderr).toContain('canon sandbox harness')
    expect(run.stderr).toContain('may not dispatch a background session')
    expect(existsSync(join(root, 'delegated'))).toBe(false)
  })

  it('should refuse the long spelling of the same flag', () => {
    const run = runShim(['--background', '-p', 'hello'])

    expect(run.status).toBe(64)
    expect(run.stderr).toContain('--background')
  })

  it('should delegate every other invocation with its arguments intact', () => {
    const run = runShim(['-p', 'hello', '--output-format', 'json'])

    expect(run.status).toBe(0)
    expect(run.stdout.trim()).toBe('-p hello --output-format json')
    expect(existsSync(join(root, 'delegated'))).toBe(true)
  })

  it('should name the layer that refused, so an arm can tell it from a broken harness', () => {
    const run = runShim(['--bg'])

    expect(run.stderr).toContain('first on PATH in place of the real claude')
  })
})

describe('reapProcessGroup', () => {
  it('should report a group that has already exited rather than signalling one', async () => {
    const child = startGroup('/bin/true')
    await exited(child)

    expect(reapProcessGroup(child.pid ?? 0)).toBe('clear')
  })

  // The safety property travels with the function rather than living in one
  // caller, because the cost of a later caller passing the wrong group id is the
  // operator's own shell.
  it('should refuse a group id matching the calling process', () => {
    const own = Number(processGroupOf(process.pid))

    expect(reapProcessGroup(own)).toBe('refused-own-group')
  })

  it('should reap a survivor that takes SIGTERM', () => {
    const child = startGroup('sleep', ['30'])

    expect(reapProcessGroup(child.pid ?? 0)).toBe('reaped-term')
  })

  // The measured detail behind the escalation. The dispatch this bound was
  // filed against needed SIGKILL, so a reap that sends one signal and reports
  // success would have left it running exactly as before.
  it('should escalate to SIGKILL for a survivor that ignores SIGTERM', async () => {
    const ready = join(root, 'trap-installed')
    const stubborn = writeScript('stubborn', [
      "trap '' TERM",
      `touch "${ready}"`,
      'sleep 30 &',
      'wait',
    ])
    const child = startGroup(stubborn)
    await waitForFile(ready)

    expect(reapProcessGroup(child.pid ?? 0)).toBe('reaped-kill')
  }, 30_000)

  // Every member, not the leader alone. A dispatch that survives the session
  // that made it is a child of that session, so a reap reaching only the pid it
  // holds would report success against the one process it was never about.
  it('should reap a child the group leader left behind', async () => {
    const parent = writeScript('parent', ['sleep 30 &', 'exit 0'])
    const child = startGroup(parent)
    await exited(child)

    expect(reapProcessGroup(child.pid ?? 0)).toBe('reaped-term')
  }, 30_000)
})

describe('sessionsBetween', () => {
  it('should name a record that appeared between the two snapshots', () => {
    const dir = sessionsDir()
    writeRecord('before.json', { cwd: '/somewhere', name: 'already running' })
    const before = snapshotSessions(dir)
    writeRecord('stray.json', { cwd: '/sandbox', name: 'stray' })

    expect(sessionsBetween(before, snapshotSessions(dir))).toEqual([
      'stray.json',
    ])
  })

  it('should ignore a record that only changed while the run was in flight', () => {
    const dir = sessionsDir()
    writeRecord('live.json', {
      cwd: '/somewhere',
      name: 'busy',
      status: 'idle',
    })
    const before = snapshotSessions(dir)
    writeRecord('live.json', {
      cwd: '/somewhere',
      name: 'busy',
      status: 'busy',
    })

    expect(sessionsBetween(before, snapshotSessions(dir))).toEqual([])
  })

  it('should ignore a record that disappeared, which is a session that ended', () => {
    const dir = sessionsDir()
    writeRecord('gone.json', { cwd: '/somewhere', name: 'ending' })
    const before = snapshotSessions(dir)
    rmSync(join(dir, 'gone.json'))

    expect(sessionsBetween(before, snapshotSessions(dir))).toEqual([])
  })
})

describe('snapshotSessions', () => {
  it('should report unwatched when the registry directory is absent', () => {
    expect(snapshotSessions(join(root, 'nothing-here')).isWatched).toBe(false)
  })

  it('should report watched when the registry directory exists', () => {
    expect(snapshotSessions(sessionsDir()).isWatched).toBe(true)
  })
})

describe('sessionsConcurrent', () => {
  it('should name a record present both before and after the run', () => {
    const dir = sessionsDir()
    writeRecord('live.json', { cwd: '/somewhere', name: 'already running' })
    const before = snapshotSessions(dir)

    expect(sessionsConcurrent(before, snapshotSessions(dir))).toEqual([
      'live.json',
    ])
  })

  it('should ignore a record that appeared during the run', () => {
    const dir = sessionsDir()
    const before = snapshotSessions(dir)
    writeRecord('stray.json', { cwd: '/sandbox', name: 'stray' })

    expect(sessionsConcurrent(before, snapshotSessions(dir))).toEqual([])
  })

  it('should ignore a record that ended during the run', () => {
    const dir = sessionsDir()
    writeRecord('gone.json', { cwd: '/somewhere', name: 'ending' })
    const before = snapshotSessions(dir)
    rmSync(join(dir, 'gone.json'))

    expect(sessionsConcurrent(before, snapshotSessions(dir))).toEqual([])
  })

  it('should report nothing when no session survived on both sides', () => {
    const dir = sessionsDir()
    const before = snapshotSessions(dir)

    expect(sessionsConcurrent(before, snapshotSessions(dir))).toEqual([])
  })
})

describe('describeSession', () => {
  it('should read the name and the working directory off the record', () => {
    const dir = sessionsDir()
    writeRecord('stray.json', {
      cwd: '/sandbox/targets',
      name: 'rollout-kestrel',
    })

    expect(describeSession(dir, 'stray.json')).toBe(
      'stray.json: rollout-kestrel in /sandbox/targets',
    )
  })

  // The name is written by whatever peer claimed the session, and the report is
  // a list every reader takes as one line each, so a newline inside it would
  // split one record into two entries.
  it('should keep one record to one line when the name spans lines', () => {
    const dir = sessionsDir()
    writeRecord('multiline.json', { cwd: '/sandbox', name: 'rollout\nkestrel' })

    expect(describeSession(dir, 'multiline.json')).toBe(
      'multiline.json: rollout kestrel in /sandbox',
    )
  })

  // A session that started and exited inside the run takes its record with it,
  // and the name is still the whole of what the report needs to be actionable.
  it('should report the name alone when the record is already gone', () => {
    expect(describeSession(sessionsDir(), 'vanished.json')).toBe(
      'vanished.json: record already gone',
    )
  })
})
