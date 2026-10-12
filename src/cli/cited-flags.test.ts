import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type Registration = { register?: (program: Command) => void }

const REPO_ROOT = join(import.meta.dirname, '../..')
const COMMANDS_DIR = join(REPO_ROOT, 'src/commands')

// The trees whose prose ships to a target or to an agent reading the CLI.
const CORPUS = ['claude', 'docs', 'governance/rules', 'tooling']

const MODULES: Registration[] = await Promise.all(
  [...new Bun.Glob('*.ts').scanSync(COMMANDS_DIR)]
    .filter((file) => !file.endsWith('.test.ts'))
    .map((file) => import(join(COMMANDS_DIR, file)) as Promise<Registration>),
)

function buildProgram(): Command {
  const program = new Command()
  program.name('canon').enablePositionalOptions().helpOption(false)
  for (const module of MODULES) module.register?.(program)
  return program
}

// A leaf that allows unknown options forwards them to a script, so no flag on
// it can be judged from the tree.
function acceptsAnyFlag(command: Command): boolean {
  return (command as unknown as { _allowUnknownOption: boolean })
    ._allowUnknownOption
}

function registeredFlags(command: Command): Set<string> {
  return new Set([
    '--help',
    ...command.options.flatMap((option) => option.long ?? []),
  ])
}

// Resolves the longest prefix of the cited words that names a command. A head
// naming no command is skipped, since a migration page cites retired verbs on
// purpose, and a flag cited on a group is skipped, since a group's flags are
// its leaves'.
function unregisteredFlags(text: string, program: Command): string[] {
  const findings: string[] = []
  for (const [, invocation] of text.matchAll(/`(canon [a-z][^`]*)`/g)) {
    const words = invocation.split(/\s+/).slice(1)
    let command = program
    for (const word of words) {
      const child = command.commands.find((c) => c.name() === word)
      if (child === undefined) break
      command = child
    }
    if (command === program) continue
    if (command.commands.length > 0 || acceptsAnyFlag(command)) continue

    const flags = registeredFlags(command)
    const cited = words
      .map((word) => word.split('=')[0])
      .filter((word) => /^--[a-z]/.test(word))
    for (const flag of cited) {
      if (!flags.has(flag)) findings.push(`\`${invocation}\` cites ${flag}`)
    }
  }
  return findings
}

function corpusFiles(): string[] {
  return CORPUS.flatMap((dir) =>
    [...new Bun.Glob('**/*.md').scanSync(join(REPO_ROOT, dir))].map((file) =>
      join(dir, file),
    ),
  )
}

describe('unregisteredFlags', () => {
  const program = buildProgram()

  it('should report a flag the cited leaf does not register', () => {
    const text = 'Run `canon tasks archive --bogus` first.'

    expect(unregisteredFlags(text, program)).toEqual([
      '`canon tasks archive --bogus` cites --bogus',
    ])
  })

  it('should accept a flag the cited leaf registers', () => {
    const text = 'Run `canon tasks archive --pull-request 673 --json`.'

    expect(unregisteredFlags(text, program)).toEqual([])
  })

  it('should read a flag written with its value on the name alone', () => {
    const text = 'Run `canon tasks archive --root=/tmp/board`.'

    expect(unregisteredFlags(text, program)).toEqual([])
  })

  it('should skip a flag cited on a group', () => {
    const text = 'Read `canon tasks --help --all` first.'

    expect(unregisteredFlags(text, program)).toEqual([])
  })

  it('should skip a head that names no command', () => {
    const text = 'The retired `canon standards list --json` is gone.'

    expect(unregisteredFlags(text, program)).toEqual([])
  })

  it('should resolve a leaf past a placeholder operand', () => {
    const text = 'Run `canon tasks archive <task> --bogus`.'

    expect(unregisteredFlags(text, program)).toEqual([
      '`canon tasks archive <task> --bogus` cites --bogus',
    ])
  })
})

describe('shipped prose', () => {
  it('should cite only flags the named command registers', () => {
    const program = buildProgram()

    const findings = corpusFiles().flatMap((file) =>
      unregisteredFlags(
        readFileSync(join(REPO_ROOT, file), 'utf8'),
        program,
      ).map((finding) => `${file}: ${finding}`),
    )

    expect(findings).toEqual([])
  })
})
