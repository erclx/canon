import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedPackage } from '@/process/seeded-package'

const CLI = join(import.meta.dirname, '../cli.ts')
const SPEC = 'e2e/home.spec.ts'
const GROWN = '// a project grew this spec\nexport const grown = true\n'

let target: string

// A git hook exports GIT_DIR, so a run under pre-push would resolve the fixture
// against the toolkit's own repository rather than the temp directory.
const run = (verb: 'diff' | 'sync', args: readonly string[]) =>
  spawnSync('bun', [CLI, 'tooling', verb, 'web', target, ...args], {
    encoding: 'utf8',
    env: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
    ),
  })

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'tooling-diff-ahead-'))
  seedPackage(target, 'web')
  const path = join(target, 'package.json')
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.devDependencies.typescript = '^7.0.0'
  writeFileSync(path, JSON.stringify(pkg))
})

afterEach(() => {
  rmSync(target, { force: true, recursive: true })
})

describe('tooling diff on a target ahead of the stack', () => {
  it('should read a later TypeScript major and a grown starter spec as clean', () => {
    expect(run('sync', ['--write']).status).toBe(0)
    writeFileSync(join(target, SPEC), GROWN)

    const result = run('diff', [])

    expect(result.status).toBe(0)
    expect(result.stderr).toContain('ahead of typescript')
    expect(readFileSync(join(target, SPEC), 'utf8')).toBe(GROWN)
    expect(
      JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
        .devDependencies.typescript,
    ).toBe('^7.0.0')
  }, 60_000)
})
