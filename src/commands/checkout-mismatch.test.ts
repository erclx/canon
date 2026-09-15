import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const CLI = join(import.meta.dirname, '../cli.ts')

// A git hook exports GIT_DIR, so a run under pre-push would resolve the decoy
// against the toolkit's own repository rather than the temp directory.
const buildEnv = (): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  ),
  CANON_NON_INTERACTIVE: '1',
})

let decoy: string
let plain: string

beforeEach(() => {
  decoy = mkdtempSync(join(tmpdir(), 'checkout-mismatch-decoy-'))
  writeFileSync(
    join(decoy, 'package.json'),
    JSON.stringify({ name: '@erclx/canon' }),
  )
  plain = mkdtempSync(join(tmpdir(), 'checkout-mismatch-plain-'))
})

afterEach(() => {
  rmSync(decoy, { force: true, recursive: true })
  rmSync(plain, { force: true, recursive: true })
})

const stderrFrom = (cwd: string, args: readonly string[]): string =>
  spawnSync('bun', [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: buildEnv(),
  }).stderr

/**
 * Every case names the verb and the arguments that reach the wired call. A
 * verb that refuses its arguments still warns, since each call sits ahead of
 * the guard beside it, so the arguments only have to reach the function.
 */
const expectWarns = (args: readonly string[]): void => {
  expect(stderrFrom(decoy, args)).toContain(decoy)
}

describe('checkout-mismatch warning at each chokepoint', () => {
  it('should warn from resolveTarget on canon claude init', () => {
    expectWarns(['claude', 'init', join(plain, 'absent')])
  })

  it('should warn from runDomainSync on canon gov sync', () => {
    expectWarns(['gov', 'sync', join(plain, 'absent')])
  })

  it('should warn from prepare on canon tooling sync', () => {
    expectWarns(['tooling', 'sync', 'base', plain, '--check'])
  })

  it('should warn from execScript on canon docs list', () => {
    expectWarns(['docs', 'list'])
  })
})

describe('checkout-mismatch warning at each directly wired verb', () => {
  it('should warn on canon tooling list', () => {
    expectWarns(['tooling', 'list'])
  })

  it('should warn on canon docs <topic>', () => {
    expectWarns(['docs', 'agents/output-shape'])
  })

  it('should warn on canon snippets list', () => {
    expectWarns(['snippets', 'list'])
  })

  it('should warn on canon gov list', () => {
    expectWarns(['gov', 'list'])
  })

  it('should warn on canon gov regen', () => {
    expectWarns(['gov', 'regen'])
  })

  it('should warn on canon claude seeds list', () => {
    expectWarns(['claude', 'seeds', 'list'])
  })

  it('should warn on canon claude skills list', () => {
    expectWarns(['claude', 'skills', 'list'])
  })

  it('should warn on canon design regen', () => {
    expectWarns(['design', 'regen'])
  })

  it('should warn on canon migrate rule-layout', () => {
    expectWarns(['migrate', 'rule-layout'])
  })

  it('should warn on canon sandbox coverage', () => {
    expectWarns(['sandbox', 'coverage'])
  })

  it('should warn on canon sandbox check', () => {
    expectWarns(['sandbox', 'check', 'claude:docs'])
  })

  /**
   * `runGate` always spawns `STAGES` with `cwd: PROJECT_ROOT`, never the
   * caller's `cwd`, so the decoy here never scopes what the stages read: a
   * spawned `canon gate run` run to completion runs the real `tests` stage
   * against this checkout, which runs `bun run test` and re-enters this very
   * file, recursing without bound. The mismatch warning logs ahead of
   * `runStages` in both the bare and the `--json` form, so this case kills
   * the child the instant the warning reaches stderr rather than waiting on
   * exit.
   */
  it('should warn on canon gate run before the stage sequence starts', async () => {
    const child = spawn('bun', [CLI, 'gate', 'run'], {
      cwd: decoy,
      env: buildEnv(),
    })

    const sawMismatch = await new Promise<boolean>((resolveWait) => {
      let stderr = ''
      let settled = false
      const finish = (result: boolean): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        child.kill('SIGKILL')
        resolveWait(result)
      }
      const timer = setTimeout(() => finish(false), 15000)
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
        if (stderr.includes(decoy)) finish(true)
      })
      child.on('exit', () => finish(stderr.includes(decoy)))
      child.on('error', () => finish(false))
    })

    expect(sawMismatch).toBe(true)
  })
})

/**
 * `feedback.ts` reads `.claude/`'s presence off `PROJECT_ROOT`, which resolves
 * to the checkout this test spawns `bun` out of rather than to `cwd`, so the
 * decoy cannot make this verb refuse the way the other cases' `plain` root
 * does elsewhere in this file. The write lands in this checkout's own
 * `.canon/feedback/`, which the test deletes.
 */
describe('checkout-mismatch warning on canon feedback', () => {
  it('should warn on the local-scratch write path', () => {
    const body = [
      '## Toolkit feedback',
      '',
      '### Surface',
      '',
      'checkout-mismatch regression test',
      '',
      '### Observed',
      '',
      'placeholder',
      '',
      '### Proposed fix',
      '',
      'placeholder',
      '',
    ].join('\n')

    const result = spawnSync('bun', [CLI, 'feedback'], {
      cwd: decoy,
      encoding: 'utf8',
      env: buildEnv(),
      input: body,
    })

    expect(result.stderr).toContain(decoy)

    const filePath = result.stdout.trim()
    rmSync(filePath, { force: true })
  })
})

describe('checkout-mismatch warning from an ordinary cwd', () => {
  it('should warn nothing when no ancestor carries a matching package.json', () => {
    expect(stderrFrom(plain, ['tooling', 'list'])).not.toContain('checkout at')
  })

  it('should warn nothing when an explicit --root names its own target', () => {
    expect(stderrFrom(decoy, ['gov', 'regen', '--root', plain])).not.toContain(
      'checkout at',
    )
  })
})
