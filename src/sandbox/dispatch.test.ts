import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const LIB = join(import.meta.dirname, '../../scripts/lib/sandbox-dispatch.sh')

let root: string

interface Run {
  status: null | number
  stderr: string
  stdout: string
}

// Every case sources the library and calls one function, which is the only way
// to reach these three mechanisms without `run.sh` provisioning a sandbox and
// spawning a session. Proving the shim by dispatching a real background session
// would run the failure the shim exists to prevent.
const sh = (script: string, env: NodeJS.ProcessEnv = {}): Run => {
  const run = spawnSync('bash', ['-c', `source ${LIB}\n${script}`], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })

  return { status: run.status, stderr: run.stderr, stdout: run.stdout.trim() }
}

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

const sessionsEnv = (): NodeJS.ProcessEnv => {
  mkdirSync(join(root, 'config/sessions'), { recursive: true })

  return { CLAUDE_CONFIG_DIR: join(root, 'config') }
}

const writeRecord = (name: string, body: object): void => {
  writeFileSync(
    join(root, 'config/sessions', name),
    JSON.stringify(body),
    'utf8',
  )
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sandbox-dispatch-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('install_dispatch_shim', () => {
  it('should refuse a background dispatch without reaching the real binary', () => {
    const stub = stubClaude()
    const run = sh(`install_dispatch_shim "${root}" "${stub}"
      "${root}/claude" -p "ship it" --bg`)

    expect(run.status).toBe(64)
    expect(run.stderr).toContain('canon sandbox harness')
    expect(run.stderr).toContain('may not dispatch a background session')
    expect(sh('[ -f delegated ] && echo yes || echo no').stdout).toBe('no')
  })

  it('should refuse the long spelling of the same flag', () => {
    const stub = stubClaude()
    const run = sh(`install_dispatch_shim "${root}" "${stub}"
      "${root}/claude" --background -p hello`)

    expect(run.status).toBe(64)
    expect(run.stderr).toContain('--background')
  })

  it('should delegate every other invocation with its arguments intact', () => {
    const stub = stubClaude()
    const run = sh(`install_dispatch_shim "${root}" "${stub}"
      "${root}/claude" -p "hello" --output-format json`)

    expect(run.status).toBe(0)
    expect(run.stdout).toBe('-p hello --output-format json')
    expect(sh('[ -f delegated ] && echo yes || echo no').stdout).toBe('yes')
  })

  it('should name the layer that refused, so an arm can tell it from a broken harness', () => {
    const stub = stubClaude()
    const run = sh(`install_dispatch_shim "${root}" "${stub}"
      "${root}/claude" --bg`)

    expect(run.stderr).toContain('first on PATH in place of the real claude')
  })
})

describe('reap_process_group', () => {
  it('should report a group that has already exited rather than signalling one', () => {
    const run = sh(`set -m
      ( exec /bin/true ) &
      pid=$!
      set +m
      wait "$pid" 2>/dev/null || true
      reap_process_group "$pid"`)

    expect(run.stdout).toBe('clear')
  })

  // The safety property travels with the function rather than living in one
  // caller, because the cost of a later caller passing the wrong group id is the
  // operator's own shell.
  it('should refuse a group id matching the calling shell', () => {
    const run = sh(`own=$(ps -o pgid= -p $$ | tr -d ' ')
      reap_process_group "$own"`)

    expect(run.stdout).toBe('refused-own-group')
  })

  it('should reap a survivor that takes SIGTERM', () => {
    const run = sh(`set -m
      ( exec sleep 30 ) >/dev/null 2>&1 &
      pid=$!
      set +m
      reap_process_group "$pid"
      wait "$pid" 2>/dev/null || true`)

    expect(run.stdout).toBe('reaped-term')
  })

  // The measured detail behind the escalation. The dispatch this bound was
  // filed against needed SIGKILL, so a reap that sends one signal and reports
  // success would have left it running exactly as before.
  it('should escalate to SIGKILL for a survivor that ignores SIGTERM', () => {
    writeFileSync(
      join(root, 'stubborn'),
      ['#!/usr/bin/env bash', "trap '' TERM", 'sleep 30 &', 'wait'].join('\n'),
      { mode: 0o755 },
    )

    const run = sh(`set -m
        ( exec "${join(root, 'stubborn')}" ) >/dev/null 2>&1 &
        pid=$!
        set +m
        sleep 0.5
        reap_process_group "$pid"
        wait "$pid" 2>/dev/null || true`)

    expect(run.stdout).toBe('reaped-kill')
  }, 30_000)

  // Every member, not the leader alone. A dispatch that survives the session
  // that made it is a child of that session, so a reap reaching only the pid it
  // holds would report success against the one process it was never about.
  it('should reap a child the group leader left behind', () => {
    writeFileSync(
      join(root, 'parent'),
      ['#!/usr/bin/env bash', 'sleep 30 &', 'exit 0'].join('\n'),
      { mode: 0o755 },
    )

    const run = sh(`set -m
        ( exec "${join(root, 'parent')}" ) >/dev/null 2>&1 &
        pid=$!
        set +m
        wait "$pid" 2>/dev/null || true
        reap_process_group "$pid"`)

    expect(run.stdout).toBe('reaped-term')
  }, 30_000)
})

describe('snapshot_sessions', () => {
  it('should name a record that appeared between the two snapshots', () => {
    const env = sessionsEnv()
    writeRecord('before.json', { cwd: '/somewhere', name: 'already running' })

    const run = sh(
      `snapshot_sessions before.txt
       echo '{"name":"stray","cwd":"/sandbox"}' > "$CLAUDE_CONFIG_DIR/sessions/stray.json"
       snapshot_sessions after.txt
       sessions_between before.txt after.txt`,
      env,
    )

    expect(run.stdout).toBe('stray.json')
  })

  it('should ignore a record that only changed while the run was in flight', () => {
    const env = sessionsEnv()
    writeRecord('live.json', {
      cwd: '/somewhere',
      name: 'busy',
      status: 'idle',
    })

    const run = sh(
      `snapshot_sessions before.txt
       echo '{"name":"busy","cwd":"/somewhere","status":"busy"}' > "$CLAUDE_CONFIG_DIR/sessions/live.json"
       snapshot_sessions after.txt
       sessions_between before.txt after.txt
       echo done`,
      env,
    )

    expect(run.stdout).toBe('done')
  })

  it('should ignore a record that disappeared, which is a session that ended', () => {
    const env = sessionsEnv()
    writeRecord('gone.json', { cwd: '/somewhere', name: 'ending' })

    const run = sh(
      `snapshot_sessions before.txt
       rm "$CLAUDE_CONFIG_DIR/sessions/gone.json"
       snapshot_sessions after.txt
       sessions_between before.txt after.txt
       echo done`,
      env,
    )

    expect(run.stdout).toBe('done')
  })

  it('should report unwatched when the registry directory is absent', () => {
    const run = sh('snapshot_sessions before.txt\necho "$sessions_watched"', {
      CLAUDE_CONFIG_DIR: join(root, 'nothing-here'),
    })

    expect(run.stdout).toBe('0')
  })

  it('should report watched when the registry directory exists', () => {
    const env = sessionsEnv()
    const run = sh(
      'snapshot_sessions before.txt\necho "$sessions_watched"',
      env,
    )

    expect(run.stdout).toBe('1')
  })
})

describe('sessions_concurrent', () => {
  it('should name a record present both before and after the run', () => {
    const env = sessionsEnv()
    writeRecord('live.json', { cwd: '/somewhere', name: 'already running' })

    const run = sh(
      `snapshot_sessions before.txt
       snapshot_sessions after.txt
       sessions_concurrent before.txt after.txt`,
      env,
    )

    expect(run.stdout).toBe('live.json')
  })

  it('should ignore a record that appeared during the run', () => {
    const env = sessionsEnv()

    const run = sh(
      `snapshot_sessions before.txt
       echo '{"name":"stray","cwd":"/sandbox"}' > "$CLAUDE_CONFIG_DIR/sessions/stray.json"
       snapshot_sessions after.txt
       sessions_concurrent before.txt after.txt
       echo done`,
      env,
    )

    expect(run.stdout).toBe('done')
  })

  it('should ignore a record that ended during the run', () => {
    const env = sessionsEnv()
    writeRecord('gone.json', { cwd: '/somewhere', name: 'ending' })

    const run = sh(
      `snapshot_sessions before.txt
       rm "$CLAUDE_CONFIG_DIR/sessions/gone.json"
       snapshot_sessions after.txt
       sessions_concurrent before.txt after.txt
       echo done`,
      env,
    )

    expect(run.stdout).toBe('done')
  })

  it('should report nothing when no session survived on both sides', () => {
    const env = sessionsEnv()

    const run = sh(
      `snapshot_sessions before.txt
       snapshot_sessions after.txt
       sessions_concurrent before.txt after.txt
       echo done`,
      env,
    )

    expect(run.stdout).toBe('done')
  })
})

describe('describe_session', () => {
  it('should read the name and the working directory off the record', () => {
    const env = sessionsEnv()
    writeRecord('stray.json', {
      cwd: '/sandbox/targets',
      name: 'rollout-kestrel',
    })

    const run = sh('describe_session stray.json', env)

    expect(run.stdout).toBe('stray.json: rollout-kestrel in /sandbox/targets')
  })

  // The name is written by whatever peer claimed the session, and the report is
  // a list every reader takes as one line each, so a newline inside it would
  // split one record into two entries.
  it('should keep one record to one line when the name spans lines', () => {
    const env = sessionsEnv()
    writeRecord('multiline.json', {
      cwd: '/sandbox',
      name: 'rollout\nkestrel',
    })

    const run = sh('describe_session multiline.json', env)

    expect(run.stdout).toBe('multiline.json: rollout kestrel in /sandbox')
  })

  // A session that started and exited inside the run takes its record with it,
  // and the name is still the whole of what the report needs to be actionable.
  it('should report the name alone when the record is already gone', () => {
    const env = sessionsEnv()

    const run = sh('describe_session vanished.json', env)

    expect(run.stdout).toBe('vanished.json: record already gone')
  })
})
