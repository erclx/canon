import { execaSync } from 'execa'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
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
  copyFileSync(
    new URL('./fixtures/usage-stub.sh', import.meta.url),
    join(bin, name),
  )
  chmodSync(join(bin, name), 0o755)
  writeFileSync(join(bin, `${name}.usage`), `${usage}\n`)
}

function calls(name: string): string {
  const log = join(bin, `${name}.log`)
  return existsSync(log) ? readFileSync(log, 'utf8') : ''
}

function runHookWithStderr(hook: string): { code: number; stderr: string } {
  const result = execaSync('sh', ['-e', hook], {
    cwd: root,
    env: {
      ...gitEnv(),
      PATH: `${bin}:/usr/bin:/bin`,
    },
    extendEnv: false,
    reject: false,
  })
  return { code: result.exitCode ?? 1, stderr: result.stderr }
}

function runHook(hook: string): number {
  return runHookWithStderr(hook).code
}

function git(...args: string[]): string {
  return execaSync('git', ['-C', root, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

/**
 * Commits each file set in turn and points ORIG_HEAD at the first commit, so
 * the hook reads the span a merge leaves behind.
 */
function mergeSpan(
  before: Record<string, string>,
  after: Record<string, string>,
): void {
  for (const files of [before, after]) {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, name), content)
    }
    git('add', '-A')
    git('commit', '-m', 'step', '--allow-empty')
    if (files === before) git('update-ref', 'ORIG_HEAD', 'HEAD')
  }
}

function runHookStdout(hook: string): string {
  return execaSync('sh', ['-e', hook], {
    cwd: root,
    env: { ...gitEnv(), PATH: `${bin}:/usr/bin:/bin` },
    extendEnv: false,
  }).stdout
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'canon-post-merge-hook-')))
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

  // A binary older than the verb is left for its owner to upgrade, so the hook names the upgrade and exits zero.
  it('should leave a binary lacking the verb alone and exit zero', () => {
    stub('canon', ROOT_USAGE)

    const { code, stderr } = runHookWithStderr(path)

    expect({ code, canon: calls('canon'), stderr }).toEqual({
      code: 0,
      canon: '',
      stderr:
        'canon is too old to run the post-merge hook. Run `canon upgrade`.',
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

  it.each([
    ['bun.lock', 'bun install --frozen-lockfile'],
    ['bun.lockb', 'bun install --frozen-lockfile'],
    ['package-lock.json', 'npm ci'],
    ['pnpm-lock.yaml', 'pnpm install --frozen-lockfile'],
    ['yarn.lock', 'yarn install --frozen-lockfile'],
    ['uv.lock', 'uv sync --frozen'],
  ])('should name the install for a changed %s', (lock, command) => {
    mergeSpan({ [lock]: 'a' }, { [lock]: 'b' })

    expect(runHookStdout(path)).toBe(
      `${lock} changed in this merge. Run ${command}.`,
    )
  })

  it('should name the immutable yarn install for a modern yarn project', () => {
    writeFileSync(join(root, '.yarnrc.yml'), '')
    mergeSpan({ 'yarn.lock': 'a' }, { 'yarn.lock': 'b' })

    expect(runHookStdout(path)).toBe(
      'yarn.lock changed in this merge. Run yarn install --immutable.',
    )
  })

  it('should print a shared install command once', () => {
    mergeSpan(
      { 'bun.lock': 'a', 'bun.lockb': 'a' },
      { 'bun.lock': 'b', 'bun.lockb': 'b' },
    )

    expect(runHookStdout(path)).toBe(
      'bun.lock changed in this merge. Run bun install --frozen-lockfile.',
    )
  })

  it('should print nothing when the merge leaves the lockfile alone', () => {
    mergeSpan(
      { 'bun.lock': 'a', 'package.json': '{}' },
      { 'package.json': '{"a":1}' },
    )

    expect(runHookStdout(path)).toBe('')
  })

  it('should print one line per changed lockfile', () => {
    mergeSpan(
      { 'bun.lock': 'a', 'uv.lock': 'a' },
      { 'bun.lock': 'b', 'uv.lock': 'b' },
    )

    expect(runHookStdout(path).split('\n')).toEqual([
      'bun.lock changed in this merge. Run bun install --frozen-lockfile.',
      'uv.lock changed in this merge. Run uv sync --frozen.',
    ])
  })

  it('should still print the line with no board and no canon', () => {
    mergeSpan({ 'bun.lock': 'a' }, { 'bun.lock': 'b' })
    rmSync(join(root, '.canon'), { recursive: true })

    expect(runHookStdout(path)).toBe(
      'bun.lock changed in this merge. Run bun install --frozen-lockfile.',
    )
  })

  it('should print nothing and exit zero with no ORIG_HEAD', () => {
    writeFileSync(join(root, 'bun.lock'), 'a')
    git('add', '-A')
    git('commit', '-m', 'only')

    expect(runHookStdout(path)).toBe('')
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
