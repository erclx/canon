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
import { gitEnv } from '@/git/env'

const HOOKS = [
  { name: 'repo', path: join(import.meta.dirname, '../../.husky/post-merge') },
  {
    name: 'base',
    path: join(
      import.meta.dirname,
      '../../tooling/base/configs/.husky/post-merge',
    ),
  },
]

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

/**
 * A `canon` that lacks the verb until `upgrade` runs, then carries it, so a
 * test reads whether the hook reinstalled before handing the verb over.
 */
function upgradableStub(): void {
  const log = join(root, 'canon.log')
  const flag = join(root, 'upgraded')
  writeFileSync(
    join(bin, 'canon'),
    [
      '#!/bin/sh',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--help" ]; then',
      `    if [ -f '${flag}' ]; then echo '${VERB_USAGE}'; else echo '${ROOT_USAGE}'; fi`,
      '    exit 0',
      '  fi',
      'done',
      `echo "$*" >> '${log}'`,
      `if [ "$1" = "upgrade" ]; then touch '${flag}'; fi`,
      '',
    ].join('\n'),
  )
  chmodSync(join(bin, 'canon'), 0o755)
}

function runHook(hook: string, skipUpgrade = true): number {
  const result = execaSync('sh', ['-e', hook], {
    cwd: root,
    env: {
      ...gitEnv(),
      PATH: `${bin}:/usr/bin:/bin`,
      ...(skipUpgrade ? { CANON_SKIP_UPGRADE: '1' } : {}),
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

describe.each(HOOKS)('post-merge hook ($name copy)', ({ path }) => {
  it('should hand the steps to the global binary when it carries the verb', () => {
    stub('canon', VERB_USAGE)

    runHook(path)

    expect(calls('canon')).toBe(`hooks post-merge --root ${root}\n`)
  })

  it('should reinstall once and then run the verb when the binary gains it', () => {
    upgradableStub()

    runHook(path, false)

    expect(calls('canon')).toBe(`upgrade\nhooks post-merge --root ${root}\n`)
  })

  it('should not reinstall when CANON_SKIP_UPGRADE is set', () => {
    upgradableStub()

    const code = runHook(path)

    expect({ code, canon: calls('canon') }).toEqual({ code: 0, canon: '' })
  })

  it('should exit zero when the binary never gains the verb', () => {
    stub('canon', ROOT_USAGE)

    const code = runHook(path, false)

    expect({ code, canon: calls('canon') }).toEqual({
      code: 0,
      canon: 'upgrade\n',
    })
  })

  it('should exit zero with no canon on PATH', () => {
    const code = runHook(path)

    expect(code).toBe(0)
  })

  it('should exit zero with no board', () => {
    stub('canon', VERB_USAGE)
    rmSync(join(root, '.canon'), { recursive: true })

    const code = runHook(path)

    expect({ code, canon: calls('canon') }).toEqual({ code: 0, canon: '' })
  })
})

describe('post-merge hook (repo copy source fallback)', () => {
  const hook = HOOKS[0].path

  it('should fall back to the source CLI when the global binary lacks the verb', () => {
    stub('canon', ROOT_USAGE)
    stub('bun', VERB_USAGE)
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src/cli.ts'), '')

    runHook(hook)

    expect(calls('bun')).toBe(
      `${root}/src/cli.ts hooks post-merge --root ${root}\n`,
    )
  })

  it('should skip quietly when neither the binary nor the source carries the verb', () => {
    stub('canon', ROOT_USAGE)
    stub('bun', ROOT_USAGE)
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src/cli.ts'), '')

    const code = runHook(hook)

    expect({ code, canon: calls('canon'), bun: calls('bun') }).toEqual({
      code: 0,
      canon: '',
      bun: '',
    })
  })

  it('should skip quietly with no source CLI to fall back to', () => {
    stub('canon', ROOT_USAGE)
    stub('bun', VERB_USAGE)

    const code = runHook(hook)

    expect({ code, bun: calls('bun') }).toEqual({ code: 0, bun: '' })
  })
})
