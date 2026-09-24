import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPTS = {
  python: join(
    import.meta.dirname,
    '../tooling/python/configs/scripts/verify.sh',
  ),
  web: join(import.meta.dirname, '../tooling/web/configs/scripts/verify.sh'),
} as const

const STACK_SCRIPTS = {
  python: ['typecheck', 'lint', 'test:run'],
  web: ['typecheck', 'lint', 'test:run', 'build'],
} as const

const BASE_SCRIPTS = ['format', 'check:format', 'check:spell', 'check:shell']

type Stack = keyof typeof SCRIPTS

let fixture: string
let bin: string

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'verify-base-phases-'))
  bin = join(fixture, 'bin')
  mkdirSync(bin)
  // uv is only probed for presence, so a stub that succeeds keeps the python
  // script from stopping in check_dependencies on a machine without it.
  writeFileSync(join(bin, 'uv'), '#!/usr/bin/env bash\nexit 0\n', {
    mode: 0o755,
  })
})

afterEach(() => {
  rmSync(fixture, { force: true, recursive: true })
})

const writePackage = (keys: readonly string[]): void => {
  const scripts = Object.fromEntries(keys.map((key) => [key, 'true']))
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ scripts }))
}

const runVerify = (stack: Stack): SpawnSyncReturns<string> =>
  spawnSync('bash', [SCRIPTS[stack]], {
    cwd: fixture,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    timeout: 20_000,
  })

describe.each(['python', 'web'] as const)('%s verify.sh', (stack) => {
  it('should pass when only the stack scripts are declared', () => {
    writePackage(STACK_SCRIPTS[stack])

    expect(runVerify(stack).status).toBe(0)
  })

  it('should name a base phase it skipped for being undeclared', () => {
    writePackage(STACK_SCRIPTS[stack])

    expect(runVerify(stack).stdout).toContain(
      'Skipped: check:spell is not declared here',
    )
  })

  it('should run the base phases when every script is declared', () => {
    writePackage([...STACK_SCRIPTS[stack], ...BASE_SCRIPTS])

    expect(runVerify(stack).stdout).toContain('Spell check passed')
  })

  it('should exit 1 when no package.json exists', () => {
    expect(runVerify(stack).status).toBe(1)
  })

  it('should name bun init when no package.json exists', () => {
    expect(runVerify(stack).stdout).toContain("Run 'bun init'")
  })

  it('should still fail when a stack script is undeclared', () => {
    writePackage(BASE_SCRIPTS)

    expect(runVerify(stack).status).not.toBe(0)
  })
})
