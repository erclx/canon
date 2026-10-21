import { Command } from 'commander'
import { describe, expect, it } from 'vitest'
import { register } from '@/commands/migrate'
import type { CommandResult, RunCommand } from '@/gate/measures'
import {
  MIGRATIONS,
  readMigrationStatus,
  statusExitCode,
} from '@/migrate/status'

function result(partial: Partial<CommandResult>): CommandResult {
  return { exitCode: 0, stdout: '', stderr: '', all: '', ...partial }
}

function runnerFor(byVerb: Record<string, Partial<CommandResult>>): {
  run: RunCommand
  calls: string[][]
} {
  const calls: string[][] = []
  const run: RunCommand = async (argv) => {
    calls.push([...argv])
    return result(byVerb[argv[1]] ?? {})
  }
  return { run, calls }
}

describe('readMigrationStatus', () => {
  it('reads every migration clean when each exits 0', async () => {
    const { run } = runnerFor({})

    const report = await readMigrationStatus(run)

    expect(report.migrations.map((m) => m.state)).toEqual(
      MIGRATIONS.map(() => 'clean'),
    )
    expect(statusExitCode(report)).toBe(0)
  })

  it('lists pending migrations in registry order with their records', async () => {
    const record = { ok: true, moves: ['a'] }
    const { run } = runnerFor({
      'skill-names': { exitCode: 2, stdout: JSON.stringify(record) },
      records: { exitCode: 2, stdout: '{"ok":true}' },
    })

    const report = await readMigrationStatus(run)

    const pending = report.migrations.filter((m) => m.state === 'pending')
    expect(pending.map((m) => m.verb)).toEqual([
      'canon migrate records',
      'canon migrate skill-names',
    ])
    expect(pending[1].record).toEqual(record)
    expect(statusExitCode(report)).toBe(2)
  })

  it('reads an exit of 1 as refused with its stderr reason, never clean', async () => {
    const { run } = runnerFor({
      'rule-layout': { exitCode: 1, stderr: 'toolkit root\n' },
      records: { exitCode: 2 },
    })

    const report = await readMigrationStatus(run)

    const refused = report.migrations.find((m) => m.name === 'rule-layout')
    expect(refused).toMatchObject({ state: 'refused', reason: 'toolkit root' })
    expect(statusExitCode(report)).toBe(1)
  })

  it('keeps the error lines of a framed stderr and drops the frame', async () => {
    const framed = [
      '┌',
      '│ canon migrate records',
      '│',
      '├ Scope',
      '│ ✗ Could not list files under /tmp/x',
      '│ ✗ Second problem',
      '└',
      '',
    ].join('\n')
    const { run } = runnerFor({ records: { exitCode: 1, stderr: framed } })

    const report = await readMigrationStatus(run)

    expect(report.migrations[0].reason).toBe(
      'Could not list files under /tmp/x. Second problem',
    )
  })

  it('joins error lines without doubling a period one already ends in', async () => {
    const framed = '│ ✗ Ignored where it stands.\n│ ✗ Run canon tooling sync\n'
    const { run } = runnerFor({ records: { exitCode: 1, stderr: framed } })

    const report = await readMigrationStatus(run)

    expect(report.migrations[0].reason).toBe(
      'Ignored where it stands. Run canon tooling sync',
    )
  })

  it('strips the frame from a stderr with no error marker', async () => {
    const { run } = runnerFor({
      rename: { exitCode: 1, stderr: '┌\n│ plain failure\n└\n' },
    })

    const report = await readMigrationStatus(run)

    const refused = report.migrations.find((m) => m.name === 'rename')
    expect(refused?.reason).toBe('plain failure')
  })

  it('reads an exit outside the contract as refused', async () => {
    const { run } = runnerFor({ rename: { exitCode: 137 } })

    const report = await readMigrationStatus(run)

    const odd = report.migrations.find((m) => m.name === 'rename')
    expect(odd?.state).toBe('refused')
    expect(odd?.reason).toContain('137')
  })

  it('carries a spawn error as the refusal reason', async () => {
    const { run } = runnerFor({
      records: { exitCode: 1, spawnError: 'bun is not on PATH' },
    })

    const report = await readMigrationStatus(run)

    expect(report.migrations[0].reason).toBe('bun is not on PATH')
  })

  it('leaves the record out when stdout is not JSON', async () => {
    const { run } = runnerFor({ records: { exitCode: 2, stdout: 'plain' } })

    const report = await readMigrationStatus(run)

    expect(report.migrations[0]).toMatchObject({ state: 'pending' })
    expect(report.migrations[0].record).toBeUndefined()
  })

  it('never passes --write and always asks for --json', async () => {
    const { run, calls } = runnerFor({})

    await readMigrationStatus(run)

    expect(calls).toHaveLength(MIGRATIONS.length)
    for (const argv of calls) {
      expect(argv).not.toContain('--write')
      expect(argv).toContain('--json')
    }
  })

  it('reads rename at the target scope', async () => {
    const { run, calls } = runnerFor({})

    await readMigrationStatus(run)

    const rename = calls.find((argv) => argv[1] === 'rename')
    expect(rename).toEqual(['migrate', 'rename', '--scope', 'target', '--json'])
  })
})

describe('statusExitCode', () => {
  it('lets a refusal win over a pending migration', async () => {
    const { run } = runnerFor({
      records: { exitCode: 2 },
      'record-tree': { exitCode: 1, stderr: 'no' },
    })

    expect(statusExitCode(await readMigrationStatus(run))).toBe(1)
  })
})

describe('MIGRATIONS', () => {
  it('names every migrate subcommand but status, so none reads clean unseen', () => {
    const program = new Command()
    register(program)
    const migrate = program.commands.find((c) => c.name() === 'migrate')

    const registered = (migrate?.commands ?? [])
      .map((c) => c.name())
      .filter((name) => name !== 'status')

    expect([...registered].sort()).toEqual(MIGRATIONS.map((m) => m.name).sort())
  })
})
