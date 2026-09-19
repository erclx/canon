import { Command } from 'commander'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type Registration = { register?: (program: Command) => void }

const COMMANDS_DIR = join(import.meta.dirname, 'commands')

const MODULES: Registration[] = await Promise.all(
  [...new Bun.Glob('*.ts').scanSync(COMMANDS_DIR)]
    .filter((file) => !file.endsWith('.test.ts'))
    .map((file) => import(join(COMMANDS_DIR, file)) as Promise<Registration>),
)

// These forward `--help` to a bash script that owns the real usage text, so
// Commander's own option stays disabled on purpose.
const FORWARDS_HELP_TO_SCRIPT = new Set([
  'canon docs list',
  'canon sandbox',
  'canon snippets create',
  'canon standards list',
  'canon tooling create',
  'canon tooling verify',
])

function buildProgram(): Command {
  const program = new Command()
  program.name('canon').enablePositionalOptions().helpOption(false)
  for (const module of MODULES) module.register?.(program)
  return program
}

function walk(command: Command, path: string[] = []): string[][] {
  return command.commands.flatMap((child) => {
    const childPath = [...path, child.name()]
    return [childPath, ...walk(child, childPath)]
  })
}

function resolve(program: Command, path: string[]): Command {
  return path.reduce<Command>(
    (parent, name) => parent.commands.find((c) => c.name() === name)!,
    program,
  )
}

describe('registered commands', () => {
  const program = buildProgram()
  const paths = walk(program)

  it('should register commands to walk', () => {
    expect(paths.length).toBeGreaterThan(100)
  })

  it('should answer --help on every registration', () => {
    const missing = paths
      .filter(
        (path) => !resolve(program, path).helpInformation().includes('--help'),
      )
      .map((path) => `canon ${path.join(' ')}`)
      .filter((name) => !FORWARDS_HELP_TO_SCRIPT.has(name))

    expect(missing).toEqual([])
  })
})
