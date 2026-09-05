import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../tooling/web/configs/scripts/screenshot.sh',
)

let fixture: string
let bin: string
let readyMarker: string

const stubBin = (name: string, body: string): void => {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`, {
    mode: 0o755,
  })
}

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'screenshot-trap-'))
  bin = join(fixture, 'bin')
  mkdirSync(bin, { recursive: true })
  readyMarker = join(fixture, 'ready')

  // curl never touches a network. It reports the preview server reachable
  // once the detached grandchild below has written its readiness marker.
  stubBin('curl', `test -f "${readyMarker}" && exit 0\nexit 1`)
})

afterEach(() => {
  rmSync(fixture, { force: true, recursive: true })
})

// Reproduces astro preview forking a detached grandchild and returning:
// the stubbed `bun run preview` backgrounds a subshell that writes the
// readiness marker, then exits itself immediately, so $! is already gone
// by the time the EXIT trap runs.
const runScript = (captureExitCode: number): SpawnSyncReturns<string> => {
  stubBin(
    'bun',
    [
      'if [[ "$1 $2" == "run build" ]]; then exit 0; fi',
      'if [[ "$1 $2" == "run preview" ]]; then',
      `  ( sleep 0.05; touch "${readyMarker}" ) &`,
      '  exit 0',
      'fi',
      `if [[ "$1" == "e2e/screenshot.ts" ]]; then exit ${captureExitCode}; fi`,
      'exit 1',
    ].join('\n'),
  )

  return spawnSync('bash', [SCRIPT], {
    cwd: fixture,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      PREVIEW_PORT: '4173',
    },
    timeout: 10_000,
  })
}

describe('screenshot.sh EXIT trap', () => {
  it('should exit 0 on a successful capture when the preview pid has already exited by trap time', () => {
    const result = runScript(0)

    expect(result.status).toBe(0)
  })

  it('should still exit non-zero on a genuinely failing capture', () => {
    const result = runScript(1)

    expect(result.status).not.toBe(0)
  })
})
