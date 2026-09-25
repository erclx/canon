import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../scripts/core/check-capability-seeding.sh',
)

let root: string

// PROJECT_ROOT is what the fixture points the script at, and a run under a
// hook that already exported one would resolve every case against the wrong
// tree.
const buildEnv = (): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== 'PROJECT_ROOT'),
  ),
  PROJECT_ROOT: root,
})

function writeHook(
  dir: string,
  name: string,
  body = '#!/usr/bin/env bash\n',
): void {
  const full = join(root, dir)
  mkdirSync(full, { recursive: true })
  writeFileSync(join(full, name), body)
}

function writeSettings(commands: string[]): void {
  const dir = join(root, 'tooling/claude/seeds/.claude')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'settings.json'),
    JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Bash',
              hooks: commands.map((command) => ({ type: 'command', command })),
            },
          ],
        },
      },
      null,
      2,
    ),
  )
}

function check(): { status: number; output: string } {
  const result = spawnSync('bash', [SCRIPT], {
    cwd: root,
    encoding: 'utf8',
    env: buildEnv(),
  })
  return {
    status: result.status ?? -1,
    output: `${result.stdout}${result.stderr}`,
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'capability-seeding-'))
  mkdirSync(join(root, 'tooling'), { recursive: true })
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('check-capability-seeding', () => {
  it('should pass when a hook reaches its seed', () => {
    writeHook('.claude/hooks', 'index-reminder.sh')
    writeHook('tooling/claude/seeds/.claude/hooks', 'index-reminder.sh')
    writeSettings(['.claude/hooks/index-reminder.sh'])

    expect(check().status).toBe(0)
  })

  it('should fail on a hook reaching no seed with no canon-no-seed reason', () => {
    writeHook('.claude/hooks', 'orphaned-source.sh')

    const result = check()
    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'Hooks: .claude/hooks/orphaned-source.sh reaches no seed or config and carries no canon-no-seed: reason',
    )
  })

  it('should pass on a hook reaching no seed that carries a canon-no-seed reason', () => {
    writeHook(
      '.claude/hooks',
      'checkout-only.sh',
      '#!/usr/bin/env bash\n# canon-no-seed: calls a toolkit-internal library never shipped\n',
    )

    expect(check().status).toBe(0)
  })

  it('should pass when a workflow reaches any stack config', () => {
    writeHook('.github/workflows', 'verify.yml', 'name: Verify\n')
    writeHook(
      'tooling/web/configs/.github/workflows',
      'verify.yml',
      'name: Verify\n',
    )

    expect(check().status).toBe(0)
  })

  it('should pass when a workflow reaches a stack seed', () => {
    writeHook('.github/workflows', 'verify.yml', 'name: Verify\n')
    writeHook(
      'tooling/base/seeds/.github/workflows',
      'verify.yml',
      'name: Verify\n',
    )

    expect(check().status).toBe(0)
  })

  it('should fail when a workflow reaches no stack config', () => {
    writeHook('.github/workflows', 'release.yml', 'name: Release\n')

    const result = check()
    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'Workflows: .github/workflows/release.yml reaches no seed or config',
    )
  })

  it('should pass when a husky hook reaches its base config', () => {
    writeHook('.husky', 'pre-push', '#!/usr/bin/env sh\n')
    writeHook('tooling/base/configs/.husky', 'pre-push', '#!/usr/bin/env sh\n')

    expect(check().status).toBe(0)
  })

  it('should fail on a seeded hook wired into no command', () => {
    writeHook('.claude/hooks', 'unwired.sh')
    writeHook('tooling/claude/seeds/.claude/hooks', 'unwired.sh')
    writeSettings(['.claude/hooks/other.sh'])

    const result = check()
    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'Seed settings: unwired.sh is seeded and wired into no command',
    )
  })

  it('should not pass an unwired hook whose name is a substring of a wired one', () => {
    writeHook('.claude/hooks', 'log.sh')
    writeHook('.claude/hooks', 'pr-create-log.sh')
    writeHook('tooling/claude/seeds/.claude/hooks', 'log.sh')
    writeHook('tooling/claude/seeds/.claude/hooks', 'pr-create-log.sh')
    writeSettings(['.claude/hooks/pr-create-log.sh'])

    const result = check()
    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'Seed settings: log.sh is seeded and wired into no command',
    )
    expect(result.output).not.toContain(
      'pr-create-log.sh is seeded and wired into no command',
    )
  })

  it('should fail on a seeded hook whose source here is gone', () => {
    writeHook('tooling/claude/seeds/.claude/hooks', 'orphaned-seed.sh')
    writeSettings(['.claude/hooks/orphaned-seed.sh'])

    const result = check()
    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'Hooks: tooling/claude/seeds/.claude/hooks/orphaned-seed.sh is seeded or configured with no source at .claude/hooks/orphaned-seed.sh',
    )
  })

  it('should fail on a configured workflow whose source here is gone', () => {
    writeHook(
      'tooling/web/configs/.github/workflows',
      'orphaned.yml',
      'name: Orphaned\n',
    )

    const result = check()
    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'Workflows: tooling/web/configs/.github/workflows/orphaned.yml is seeded or configured with no source at .github/workflows/orphaned.yml',
    )
  })

  it('should fail on a seeded workflow whose source here is gone', () => {
    writeHook(
      'tooling/base/seeds/.github/workflows',
      'orphaned.yml',
      'name: Orphaned\n',
    )

    const result = check()
    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'Workflows: tooling/base/seeds/.github/workflows/orphaned.yml is seeded or configured with no source at .github/workflows/orphaned.yml',
    )
  })

  it('should pass a target-only workflow with no root counterpart that carries a canon-no-seed reason', () => {
    writeHook(
      'tooling/web/configs/.github/workflows',
      'deploy.yml',
      'name: Deploy\n# canon-no-seed: stack-specific job with no root counterpart by design\n',
    )

    expect(check().status).toBe(0)
  })

  it('should refuse a tree with no tooling root rather than report clean', () => {
    rmSync(join(root, 'tooling'), { force: true, recursive: true })

    const result = check()
    expect(result.status).toBe(1)
    expect(result.output).toContain('capability seeding unverifiable')
  })
})
