import type { Command } from 'commander'

export type HelpRoute =
  | { kind: 'parse' }
  | { kind: 'top' }
  | { kind: 'all'; command: Command }
  | { kind: 'unknown'; name: string }

const HELP_FLAGS = new Set(['-h', '--help'])

// Commander exposes no getter for a disabled help option, and `canon sandbox`
// disables its own to forward `--help` to a bash script.
function hasHelpOption(command: Command): boolean {
  return command.helpInformation().includes('--help')
}

// A group with its own action, or with a default subcommand such as
// `inventory run`, takes an operand that names no subcommand. Commander keeps
// both on private fields.
function takesOperand(command: Command): boolean {
  const internals = command as unknown as {
    _actionHandler: unknown
    _defaultCommandName: unknown
  }
  return (
    command.registeredArguments.length > 0 ||
    internals._actionHandler !== null ||
    internals._defaultCommandName !== null
  )
}

function visibleChildren(command: Command): Command[] {
  return command
    .createHelp()
    .visibleCommands(command)
    .filter((child) => command.commands.includes(child))
}

function leaves(command: Command): Command[] {
  return visibleChildren(command).flatMap((child) =>
    visibleChildren(child).length === 0 ? [child] : leaves(child),
  )
}

// `outputHelp` rather than `helpInformation`, since only the former emits the
// blocks `addHelpText` registers, which carry every verb's exit codes and
// examples.
function captureHelp(command: Command): string {
  const config = command.configureOutput()
  const { writeOut } = config
  let text = ''
  command.configureOutput({ writeOut: (chunk) => (text += chunk) })
  try {
    command.outputHelp()
  } finally {
    command.configureOutput({ writeOut })
  }
  return text.trimEnd()
}

// Each block opens on its own `Usage:` line, so a blank line is the whole
// separator and a reader splits on the usage header.
export function renderAll(command: Command): string {
  const blocks = [command, ...leaves(command)].map(captureHelp)
  return `${blocks.join('\n\n')}\n`
}

// Reads argv ahead of commander, which prints a group's help for an unknown
// subcommand because it answers `--help` before it resolves operands. Walking
// stops at the first option, so an option's value is never read as a name.
export function routeHelp(program: Command, args: string[]): HelpRoute {
  if (!args.some((arg) => HELP_FLAGS.has(arg))) return { kind: 'parse' }

  let command = program
  let depth = 0
  for (const arg of args) {
    if (arg.startsWith('-')) break
    const child = command.commands.find((c) => c.name() === arg)
    if (child === undefined) {
      const isGroupOnly =
        command !== program &&
        command.commands.length > 0 &&
        !takesOperand(command) &&
        arg !== 'help'
      if (isGroupOnly) return { kind: 'unknown', name: arg }
      break
    }
    command = child
    depth += 1
  }

  if (!args.includes('--all')) return { kind: 'parse' }
  if (depth === 0) return { kind: 'top' }
  if (!hasHelpOption(command)) return { kind: 'parse' }
  return { kind: 'all', command }
}
