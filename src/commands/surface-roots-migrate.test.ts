import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

// Built from a variable so the sweep this test covers never rewrites its own
// fixtures when it runs over this repository.
const OLD = '.claude'

let root: string

function write(path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}

function migrate(args: string[]) {
  return execa(
    process.execPath,
    [CLI, 'migrate', 'surface-roots', '--root', root, '--json', ...args],
    { cwd: root, env: gitEnv(), reject: false, timeout: RUN_TIMEOUT_MS },
  )
}

function tracked(): string {
  return execSync('git ls-files', { cwd: root, env: gitEnv() }).toString()
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-surface-roots-migrate-'))
  execSync('git init --quiet', { cwd: root, env: gitEnv() })
  write(`${OLD}/ARCHITECTURE.md`, '# Architecture\n')
  write(`${OLD}/context/index.md`, `See \`${OLD}/wireframes/index.md\`.\n`)
  write(`${OLD}/wireframes/index.md`, '# Wireframes\n')
  write(`${OLD}/rules/core/005-behavior.md`, '# Behavior\n')
  write('docs/guide.md', `Start at \`${OLD}/context/index.md\`.\n`)
  execSync('git add -A', { cwd: root, env: gitEnv() })
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('migrate surface-roots', () => {
  it('should report the plan and write nothing without --write', async () => {
    const result = await migrate([])

    expect(result.exitCode, result.stderr).toBe(2)
    const record = JSON.parse(result.stdout)
    expect(record.wrote).toBe(false)
    expect(record.moves).toBe(3)
    expect(existsSync(join(root, OLD, 'context', 'index.md'))).toBe(true)
  })

  it('should move the tracked surfaces with git and rewrite their citations', async () => {
    const result = await migrate(['--write'])

    expect(result.exitCode).toBe(0)
    expect(tracked()).toContain('canon/context/index.md')
    expect(tracked()).not.toContain(`${OLD}/context/index.md`)
    expect(readFileSync(join(root, 'canon/context/index.md'), 'utf8')).toBe(
      'See `canon/wireframes/index.md`.\n',
    )
    expect(readFileSync(join(root, 'docs/guide.md'), 'utf8')).toBe(
      'Start at `canon/context/index.md`.\n',
    )
  })

  it('should leave the vendor-read folders in place', async () => {
    await migrate(['--write'])

    expect(
      existsSync(join(root, OLD, 'rules', 'core', '005-behavior.md')),
    ).toBe(true)
  })

  it('should report zero rewrites and zero moves on a second run', async () => {
    await migrate(['--write'])
    execSync('git add -A', { cwd: root, env: gitEnv() })

    const second = await migrate(['--write'])

    expect(second.exitCode).toBe(0)
    const record = JSON.parse(second.stdout)
    expect(record.rewritten).toBe(0)
    expect(record.moves).toBe(0)
    expect(record.paths).toEqual([])
  })

  it('should refuse when a destination already exists', async () => {
    write('canon/DESIGN.md', '# taken\n')
    write(`${OLD}/DESIGN.md`, '# Design\n')
    execSync('git add -A', { cwd: root, env: gitEnv() })

    const result = await migrate(['--write'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout).collisions).toEqual(['canon/DESIGN.md'])
    expect(existsSync(join(root, OLD, 'DESIGN.md'))).toBe(true)
  })
})
