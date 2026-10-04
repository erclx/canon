import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseProbe, probeScenario } from '@/sandbox/hooks'

let dir: string
let env: NodeJS.ProcessEnv

function scenario(body: string): string {
  const path = join(dir, 'scenario.sh')
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`)

  return path
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sandbox-hooks-'))
  env = {
    ...process.env,
    CANON_SANDBOX_DIR: join(dir, 'tree'),
    GITHUB_ORG: 'example-org',
  }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('parseProbe', () => {
  it('should read the pairs and the anchor flag', () => {
    const probe = parseProbe('A=1\0B=two words\0@anchor=1\0')

    expect(probe).toEqual({
      exports: { A: '1', B: 'two words' },
      isAnchor: true,
    })
  })

  it('should keep a value holding a newline or an equals sign whole', () => {
    const probe = parseProbe('A=line one\nline=two\0@anchor=0\0')

    expect(probe.exports.A).toBe('line one\nline=two')
  })

  it('should refuse output carrying no anchor record', () => {
    expect(() => parseProbe('A=1\0')).toThrow(/anchor/)
  })
})

describe('probeScenario', () => {
  it('should report nothing for a scenario declaring no hooks', () => {
    const file = scenario('stage_setup() { :; }')

    const result = probeScenario(file, env)

    expect(result).toEqual({ ok: true, exports: {}, isAnchor: false })
  })

  it('should report the exports use_config sets', () => {
    const file = scenario(
      'use_config() {\n  export SANDBOX_INJECT_SEEDS="true"\n  export MULTI="a\nb"\n}',
    )

    const result = probeScenario(file, env)

    expect(result).toEqual({
      ok: true,
      exports: { SANDBOX_INJECT_SEEDS: 'true', MULTI: 'a\nb' },
      isAnchor: false,
    })
  })

  it('should flag an anchor scenario and carry its repository', () => {
    const file = scenario('use_anchor() {\n  use_sandbox_anchor\n}')

    const result = probeScenario(file, env)

    expect(result).toEqual({
      ok: true,
      exports: { ANCHOR_REPO: 'canon-sandbox' },
      isAnchor: true,
    })
  })

  it('should report the status of a hook that fails', () => {
    const file = scenario('use_config() {\n  false\n}')

    const result = probeScenario(file, { ...env, NO_COLOR: '1' }, 'pipe')

    expect(result).toEqual({ ok: false, status: 1 })
  })
})
