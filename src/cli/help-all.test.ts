import { Command } from 'commander'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderAll, routeHelp } from '@/cli/help-all'

type Registration = { register?: (program: Command) => void }

const COMMANDS_DIR = join(import.meta.dirname, '../commands')

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

function find(program: Command, path: string[]): Command {
  return path.reduce<Command>((parent, name) => {
    const child = parent.commands.find((c) => c.name() === name)
    if (child === undefined) throw new Error(`no command named ${name}`)
    return child
  }, program)
}

function usageLines(text: string): string[] {
  return text.split('\n').filter((line) => line.startsWith('Usage: '))
}

describe('renderAll', () => {
  it('should render a group and each of its leaves', () => {
    const program = buildProgram()

    const text = renderAll(find(program, ['tasks']))

    expect(usageLines(text)).toHaveLength(18)
  })

  it('should carry the help text a leaf adds after its usage', () => {
    const program = buildProgram()

    const text = renderAll(find(program, ['tasks']))

    expect(text).toContain('Exit codes:')
    expect(text).toContain('canon tasks archive --pull-request 673 --json')
  })

  it('should render a leaf alone', () => {
    const program = buildProgram()

    const text = renderAll(find(program, ['tasks', 'archive']))

    expect(usageLines(text)).toEqual([
      'Usage: canon tasks archive [options] [task]',
    ])
  })

  it('should leave a hidden command out', () => {
    const program = buildProgram()

    const text = renderAll(find(program, ['worktrees']))

    expect(text).not.toContain('Usage: canon worktrees repair-bare-flag')
  })

  it('should separate each block with a blank line before its usage', () => {
    const program = buildProgram()

    const lines = renderAll(find(program, ['tasks'])).split('\n')

    const preceding = lines
      .map((line, index) => (line.startsWith('Usage: ') ? index : -1))
      .filter((index) => index > 0)
      .map((index) => lines[index - 1])
    expect(preceding.every((line) => line === '')).toBe(true)
  })
})

describe('routeHelp', () => {
  it('should parse normally without a help flag', () => {
    const program = buildProgram()

    expect(routeHelp(program, ['tasks', '--all']).kind).toBe('parse')
  })

  it('should parse normally on help without --all', () => {
    const program = buildProgram()

    expect(routeHelp(program, ['tasks', '--help']).kind).toBe('parse')
  })

  it('should print the top help on a bare --help --all', () => {
    const program = buildProgram()

    expect(routeHelp(program, ['--help', '--all']).kind).toBe('top')
  })

  it('should route a leaf that registers its own --all to that leaf', () => {
    const program = buildProgram()

    const route = routeHelp(program, ['gate', 'run', '--all', '--help'])

    expect(route.kind === 'all' && route.command.name()).toBe('run')
  })

  it('should leave a group that forwards help to a script to parse', () => {
    const program = buildProgram()

    expect(routeHelp(program, ['sandbox', '--help', '--all']).kind).toBe(
      'parse',
    )
  })

  it('should refuse an unknown subcommand under a group with no operand', () => {
    const program = buildProgram()

    expect(routeHelp(program, ['records', 'migrate', '--help'])).toEqual({
      kind: 'unknown',
      name: 'migrate',
    })
  })

  it('should accept an operand on a group that takes one', () => {
    const program = buildProgram()

    expect(routeHelp(program, ['docs', 'agents', '--help']).kind).toBe('parse')
  })

  it('should accept an operand on a verb with no subcommands', () => {
    const program = buildProgram()

    expect(routeHelp(program, ['inventory', 'focus', '--help']).kind).toBe(
      'parse',
    )
  })

  it('should accept the help command under a group', () => {
    const program = buildProgram()

    expect(routeHelp(program, ['tasks', 'help', '--help']).kind).toBe('parse')
  })
})
