import type { Command } from 'commander'
import { DEFAULT_STACK, SKIPPABLE_DOMAINS } from '@/init/plan'

interface InitOptionSpec {
  /** The option value key commander stores the parsed value under. */
  readonly key: string
  readonly flags: string
  readonly description: string
  readonly defaultValue?: string
}

/**
 * The option surface of `canon init`, declared once so the flag list and the
 * provenance check cannot drift apart. Reading the key from the spec is what
 * keeps a renamed flag from silently dropping out of `flagsProvided`.
 */
export const INIT_OPTIONS: readonly InitOptionSpec[] = [
  {
    key: 'stack',
    flags: '--stack <name>',
    description: 'Governance stack (e.g., base, astro, react)',
    defaultValue: DEFAULT_STACK,
  },
  {
    key: 'add',
    flags: '--add <rules>',
    description: 'Comma-separated governance rules to layer on',
  },
  {
    key: 'skip',
    flags: '--skip <list>',
    description: `Skip core domains: ${SKIPPABLE_DOMAINS.join(', ')}`,
  },
]

/** Declares every init option on the command, defaults included. */
export function applyInitOptions(command: Command): Command {
  for (const option of INIT_OPTIONS) {
    if (option.defaultValue === undefined) {
      command.option(option.flags, option.description)
      continue
    }

    command.option(option.flags, option.description, option.defaultValue)
  }

  return command
}

/**
 * Whether the operator passed any flag, which suppresses the confirmation prompt.
 * `--stack` carries a default, so presence is read from where the value came from.
 */
export function flagsProvided(cmd: Command): boolean {
  return INIT_OPTIONS.some(
    (option) => cmd.getOptionValueSource(option.key) === 'cli',
  )
}
