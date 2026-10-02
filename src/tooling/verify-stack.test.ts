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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyStack } from '@/tooling/verify-stack'

let root: string
let bin: string

// A fixture root rather than the checkout, so the manifest, the scaffold, and
// the tmp tree stay isolated. `bun` and `canon` are stubbed on PATH, and the
// bun stub logs every argv so a test reads which phases ran and in what order.
const stubBin = (name: string, body: string): void => {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`, {
    mode: 0o755,
  })
}

const seedStack = (stack: string, body: string): void => {
  mkdirSync(join(root, 'tooling', stack), { recursive: true })
  writeFileSync(join(root, 'tooling', stack, 'manifest.toml'), body)
}

const scaffoldWith = (scripts: readonly string[]): string => {
  const pkg = JSON.stringify({
    scripts: Object.fromEntries(scripts.map((key) => [key, 'true'])),
  })
  return `[stack]\nscaffold = "mkdir -p {{name}} && echo '${pkg.replaceAll('"', '\\"')}' > {{name}}/package.json"\n`
}

const bunCalls = (): string[] => {
  const log = join(root, 'bun-args')
  return existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
    : []
}

const tmpDir = (stack: string): string =>
  join(root, '.canon/tmp/runs', `verify-${stack}`)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'verify-stack-'))
  bin = join(root, 'bin')
  mkdirSync(bin, { recursive: true })
  stubBin('canon', `touch "${join(root, 'canon-invoked')}"\nexit 1`)
  stubBin(
    'bun',
    [
      `echo "$@" >> "${join(root, 'bun-args')}"`,
      `[ "$2" = "\${FAIL_ON:-}" ] && exit 1`,
      `[ "$2" = screenshot ] && [ -n "\${SHOTS:-}" ] && mkdir -p screenshots && touch screenshots/home.png`,
      'exit 0',
    ].join('\n'),
  )
  vi.stubEnv('PATH', `${bin}:${process.env.PATH}`)
  vi.stubEnv('GIT_AUTHOR_NAME', 'verify-stack-test')
  vi.stubEnv('GIT_AUTHOR_EMAIL', 'verify-stack-test@example.com')
  vi.stubEnv('GIT_COMMITTER_NAME', 'verify-stack-test')
  vi.stubEnv('GIT_COMMITTER_EMAIL', 'verify-stack-test@example.com')
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  rmSync(root, { force: true, recursive: true })
})

describe('verifyStack sync', () => {
  it('should resolve the checkout cli.ts through bun rather than PATH canon', async () => {
    seedStack('stub', scaffoldWith([]))

    const outcome = await verifyStack({ root, stack: 'stub' })

    expect(outcome.exitCode).toBe(0)
    expect(existsSync(join(root, 'canon-invoked'))).toBe(false)
    expect(bunCalls()).toContain(
      `${root}/src/cli.ts tooling sync stub . --write`,
    )
  })

  it('should fail naming the stack when sync leaves no package.json', async () => {
    seedStack('bare', '[stack]\nscaffold = "mkdir -p {{name}}"\n')
    const stderr = vi.mocked(process.stderr.write)

    const outcome = await verifyStack({ root, stack: 'bare' })

    expect(outcome.exitCode).toBe(1)
    expect(stderr.mock.calls.join('')).toContain(
      'No package.json after Sync for bare',
    )
  })
})

describe('verifyStack phases', () => {
  it('should run test:e2e and screenshot after check when declared', async () => {
    seedStack('web', scaffoldWith(['test:e2e', 'screenshot']))
    vi.stubEnv('SHOTS', '1')

    const outcome = await verifyStack({ root, stack: 'web' })

    expect(outcome.results.map((result) => result.name)).toEqual([
      'Sync',
      'lint:fix',
      'check',
      'test:e2e',
      'screenshot',
      'screenshot-artifacts',
    ])
    expect(outcome.exitCode).toBe(0)
  })

  it('should skip test:e2e and screenshot when not declared', async () => {
    seedStack('lib', scaffoldWith([]))

    const outcome = await verifyStack({ root, stack: 'lib' })

    expect(outcome.results.map((result) => result.name)).toEqual([
      'Sync',
      'lint:fix',
      'check',
    ])
  })

  it('should run the manifest prepare before sync', async () => {
    seedStack(
      'prep',
      `${scaffoldWith([])}\n[verify]\nprepare = "touch prepared"\n`,
    )

    const outcome = await verifyStack({ root, stack: 'prep', keep: true })

    expect(outcome.results[0]).toEqual({ name: 'Prepare', passed: true })
    expect(existsSync(join(tmpDir('prep'), 'prepared'))).toBe(true)
  })

  it('should fail when screenshot writes no png', async () => {
    seedStack('web', scaffoldWith(['screenshot']))

    const outcome = await verifyStack({ root, stack: 'web' })

    expect(outcome.results.at(-1)).toEqual({
      name: 'screenshot-artifacts',
      passed: false,
    })
    expect(outcome.exitCode).toBe(1)
  })
})

describe('verifyStack tmp dir', () => {
  it('should remove the tmp dir after a clean run', async () => {
    seedStack('lib', scaffoldWith([]))

    await verifyStack({ root, stack: 'lib' })

    expect(existsSync(tmpDir('lib'))).toBe(false)
  })

  it('should keep the tmp dir after a clean run under keep', async () => {
    seedStack('lib', scaffoldWith([]))

    await verifyStack({ root, stack: 'lib', keep: true })

    expect(existsSync(tmpDir('lib'))).toBe(true)
  })

  it('should keep the tmp dir when a phase fails', async () => {
    seedStack('lib', scaffoldWith([]))
    vi.stubEnv('FAIL_ON', 'check')

    const outcome = await verifyStack({ root, stack: 'lib' })

    expect(outcome.exitCode).toBe(1)
    expect(existsSync(tmpDir('lib'))).toBe(true)
  })

  it('should fail when the scaffold command fails', async () => {
    seedStack('broken', '[stack]\nscaffold = "mkdir -p {{name}} && false"\n')

    const outcome = await verifyStack({ root, stack: 'broken' })

    expect(outcome.exitCode).toBe(1)
  })
})

describe('verifyStack refusals', () => {
  it.each([
    ['ghost', 'No manifest'],
    ['claude', 'excluded'],
    ['empty', 'no scaffold command'],
  ])('should exit 1 for %s naming %s', async (stack, reason) => {
    seedStack('empty', '[stack]\nscaffold = ""\n')
    const stdout = vi.spyOn(process.stdout, 'write')
    const stderr = vi.mocked(process.stderr.write)

    const outcome = await verifyStack({ root, stack })

    expect(outcome.exitCode).toBe(1)
    expect(stderr.mock.calls.join('')).toContain(reason)
    expect(stdout).not.toHaveBeenCalled()
  })
})
