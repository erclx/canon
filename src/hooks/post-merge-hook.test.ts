import { execaSync } from 'execa'
import {
  chmodSync,
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
import { gitEnv } from '@/git-env'

const HOOK = join(import.meta.dirname, '../../.husky/post-merge')

const VERB_USAGE = 'Usage: canon hooks post-merge [options]'
const ROOT_USAGE = 'Usage: canon [command]'

let root: string
let bin: string

/**
 * A stub that answers `--help` with `usage` and logs every other call, so a
 * test reads which binary the hook handed the verb to.
 */
function stub(name: string, usage: string): void {
  const log = join(root, `${name}.log`)
  writeFileSync(
    join(bin, name),
    [
      '#!/bin/sh',
      'for arg in "$@"; do',
      `  if [ "$arg" = "--help" ]; then echo '${usage}'; exit 0; fi`,
      'done',
      `echo "$*" >> '${log}'`,
      '',
    ].join('\n'),
  )
  chmodSync(join(bin, name), 0o755)
}

function calls(name: string): string {
  const log = join(root, `${name}.log`)
  return existsSync(log) ? readFileSync(log, 'utf8') : ''
}

function runHook(): number {
  const result = execaSync('sh', ['-e', HOOK], {
    cwd: root,
    env: {
      ...gitEnv(),
      PATH: `${bin}:/usr/bin:/bin`,
      CANON_SKIP_UPGRADE: '1',
    },
    extendEnv: false,
    reject: false,
  })
  return result.exitCode ?? 1
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-post-merge-hook-'))
  bin = join(root, '.bin')
  mkdirSync(bin)
  mkdirSync(join(root, '.canon/tasks'), { recursive: true })
  execaSync('git', ['-C', root, 'init', '--initial-branch=main'], {
    env: gitEnv(),
    extendEnv: false,
  })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('post-merge hook', () => {
  it('should hand the steps to the global binary when it carries the verb', () => {
    stub('canon', VERB_USAGE)

    runHook()

    expect(calls('canon')).toBe(`hooks post-merge --root ${root}\n`)
  })

  it('should fall back to the source CLI when the global binary lacks the verb', () => {
    stub('canon', ROOT_USAGE)
    stub('bun', VERB_USAGE)
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src/cli.ts'), '')

    runHook()

    expect(calls('bun')).toBe(
      `${root}/src/cli.ts hooks post-merge --root ${root}\n`,
    )
  })

  it('should skip quietly when neither the binary nor the source carries the verb', () => {
    stub('canon', ROOT_USAGE)
    stub('bun', ROOT_USAGE)
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src/cli.ts'), '')

    const code = runHook()

    expect({ code, canon: calls('canon'), bun: calls('bun') }).toEqual({
      code: 0,
      canon: '',
      bun: '',
    })
  })

  it('should skip quietly with no source CLI to fall back to', () => {
    stub('canon', ROOT_USAGE)
    stub('bun', VERB_USAGE)

    const code = runHook()

    expect({ code, bun: calls('bun') }).toEqual({ code: 0, bun: '' })
  })
})
