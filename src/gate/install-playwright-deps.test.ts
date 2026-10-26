import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../scripts/ci/install-playwright-deps.sh',
)

// The script bounds each attempt with GNU timeout, which a stock Mac lacks
const hasTimeout = spawnSync('timeout', ['--version']).status === 0

let fixture: string
let bin: string
let log: string

const stubBin = (name: string, body: string): void => {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`, {
    mode: 0o755,
  })
}

const readLog = (): string[] =>
  existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'install-playwright-deps-'))
  bin = join(fixture, 'bin')
  mkdirSync(bin, { recursive: true })
  log = join(fixture, 'calls.log')

  // sudo records its arguments and never escalates
  stubBin('sudo', `echo "sudo $*" >> "${log}"`)
  stubBin('apt-config', `echo 'Acquire::Retries "1";'`)
})

afterEach(() => {
  rmSync(fixture, { force: true, recursive: true })
})

// Each line of outcomes answers one bunx call in order: `hang` outlives the
// bound, `ok` succeeds, and a number exits with that code
const runScript = (
  outcomes: string[],
  args: string[],
): SpawnSyncReturns<string> => {
  const outcomesFile = join(fixture, 'outcomes')
  writeFileSync(outcomesFile, `${outcomes.join('\n')}\n`)
  stubBin(
    'bunx',
    [
      `echo "bunx $*" >> "${log}"`,
      `outcome=$(head -n 1 "${outcomesFile}")`,
      `tail -n +2 "${outcomesFile}" > "${outcomesFile}.next"`,
      `mv "${outcomesFile}.next" "${outcomesFile}"`,
      'if [ "$outcome" = hang ]; then exec sleep 30; fi',
      'if [ "$outcome" = ok ]; then exit 0; fi',
      'exit "$outcome"',
    ].join('\n'),
  )

  return spawnSync('bash', [SCRIPT, ...args], {
    cwd: fixture,
    encoding: 'utf8',
    env: {
      ...process.env,
      INSTALL_ATTEMPT_SECONDS: '1',
      PATH: `${bin}:${process.env.PATH}`,
    },
    timeout: 20_000,
  })
}

describe.skipIf(!hasTimeout)('install-playwright-deps.sh', () => {
  it('should install once and exit 0 when the first attempt succeeds', () => {
    const result = runScript(['ok'], ['chromium'])

    expect(result.status).toBe(0)
    expect(readLog()).toEqual(['bunx playwright install-deps chromium'])
  })

  it('should kill a hung attempt and succeed on the retry', () => {
    const started = Date.now()

    const result = runScript(['hang', 'ok'], ['chromium', 'firefox'])

    expect(result.status).toBe(0)
    expect(Date.now() - started).toBeLessThan(10_000)
    expect(result.stderr).toContain('attempt 1/3 failed with exit 124')
    expect(readLog()).toEqual([
      'bunx playwright install-deps chromium firefox',
      'sudo pkill -KILL -x apt-get|dpkg',
      'sudo dpkg --configure -a',
      'bunx playwright install-deps chromium firefox',
    ])
  })

  it('should exit with the last code when every attempt fails', () => {
    const result = runScript(['3', '4', '5'], ['webkit'])

    expect(result.status).toBe(5)
    expect(result.stderr).toContain('attempt 3/3 failed with exit 5')
    expect(readLog().filter((line) => line.startsWith('bunx'))).toHaveLength(3)
  })

  it('should keep retrying when dpkg --configure -a fails', () => {
    stubBin('sudo', `echo "sudo $*" >> "${log}"\nexit 1`)

    const result = runScript(['1', 'ok'], ['chromium'])

    expect(result.status).toBe(0)
  })

  it('should call the package the caller names', () => {
    const result = runScript(
      ['ok'],
      ['--package', 'playwright@latest', 'chromium'],
    )

    expect(result.status).toBe(0)
    expect(readLog()).toEqual(['bunx playwright@latest install-deps chromium'])
  })

  it('should refuse with exit 2 when no browser is named', () => {
    const result = runScript(['ok'], ['--package', 'playwright@latest'])

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Usage:')
    expect(readLog()).toEqual([])
  })
})
