import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readStamp, stampedChain } from '@/sync/stamp'

const CLI = join(import.meta.dirname, '../cli.ts')

interface Run {
  readonly status: null | number
  readonly stderr: string
}

let target: string

// A git hook exports GIT_DIR, so a run under pre-push would resolve the fixture
// against the toolkit's own repository rather than the temp directory.
const buildEnv = (): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  ),
  CANON_NON_INTERACTIVE: '1',
})

const install = (args: readonly string[], cwd?: string): Run => {
  const run = spawnSync('bun', [CLI, 'gov', 'install', ...args], {
    cwd,
    encoding: 'utf8',
    env: buildEnv(),
  })

  return { status: run.status, stderr: run.stderr }
}

const canonRule = (folder: string, rule: string): string =>
  join(target, '.claude', 'rules', 'canon', folder, `${rule}.md`)

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'canon-gov-install-'))
})

afterEach(() => {
  rmSync(target, { recursive: true, force: true })
})

describe('gov install --add with no stack', () => {
  it('should install the named rules into a target given as the only positional', () => {
    const run = install(['--add', 'tasks,plan', target])

    expect(run.status).toBe(0)
    expect(existsSync(canonRule('canon', 'tasks'))).toBe(true)
    expect(existsSync(canonRule('canon', 'plan'))).toBe(true)
  })

  it('should install into the current directory when no positional is given', () => {
    const run = install(['--add', 'tasks'], target)

    expect(run.status).toBe(0)
    expect(existsSync(canonRule('canon', 'tasks'))).toBe(true)
  })

  it('should keep the chain an earlier stack install recorded', () => {
    install(['node', target])

    install(['--add', '200-react', target])

    expect(stampedChain(readStamp(target), 'governance')).toEqual(['node'])
  })

  it('should exit non-zero when no named rule resolves', () => {
    const run = install(['--add', 'no-such-rule', target])

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('no-such-rule (source not found, skipping)')
  })
})
