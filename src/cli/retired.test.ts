import { join } from 'node:path'
import { Command } from 'commander'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { findRetired, RETIRED_VERBS, retiredMessage } from '@/cli/retired'

type Registration = { register?: (program: Command) => void }

const COMMANDS_DIR = join(import.meta.dirname, '../commands')
const CLI = join(import.meta.dirname, '..', 'cli.ts')

const MODULES: Registration[] = await Promise.all(
  [...new Bun.Glob('*.ts').scanSync(COMMANDS_DIR)]
    .filter((file) => !file.endsWith('.test.ts'))
    .map((file) => import(join(COMMANDS_DIR, file)) as Promise<Registration>),
)

const PROGRAM = new Command().enablePositionalOptions()
for (const module of MODULES) module.register?.(PROGRAM)

function registered(path: readonly string[]): boolean {
  let command: Command | undefined = PROGRAM
  for (const name of path) {
    command = command.commands.find((child) => child.name() === name)
    if (command === undefined) return false
  }
  return true
}

describe('findRetired', () => {
  it('should find a retired top-level verb with trailing arguments', () => {
    const found = findRetired(['canvas', 'serve', '--json'])

    expect(found?.path).toEqual(['canvas'])
  })

  it('should find a retired subcommand of a live group', () => {
    const found = findRetired(['design', 'render'])

    expect(found?.path).toEqual(['design', 'render'])
  })

  it('should leave a live subcommand of the same group alone', () => {
    expect(findRetired(['design', 'regen'])).toBeUndefined()
  })

  it('should leave an unknown verb to the parser', () => {
    expect(findRetired(['canvsa', 'serve'])).toBeUndefined()
  })

  it('should leave a retired name after an option unread', () => {
    expect(findRetired(['--json', 'canvas'])).toBeUndefined()
  })
})

describe('retiredMessage', () => {
  it('should name the verb, the release, and where the work went', () => {
    const verb = RETIRED_VERBS.find((v) => v.path[0] === 'canvas')
    if (verb === undefined) throw new Error('no canvas entry')

    const message = retiredMessage(verb)

    expect(message).toContain('canon canvas')
    expect(message).toContain(`v${verb.release}`)
    expect(message).toContain(verb.movedTo)
  })
})

describe('RETIRED_VERBS', () => {
  it.each(RETIRED_VERBS.map((verb) => [verb.path.join(' '), verb] as const))(
    'should not list %s while a command by that name is registered',
    (_name, verb) => {
      expect(registered(verb.path)).toBe(false)
    },
  )
})

describe('canon <retired verb>', () => {
  it('should print the release on stderr, nothing on stdout, and exit nonzero', async () => {
    const result = await execa('bun', [CLI, 'canvas', 'serve', '--json'], {
      reject: false,
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('retired in v5.54.0')
  })

  it('should still report an unknown verb as unknown', async () => {
    const result = await execa('bun', [CLI, 'canvsa', 'serve'], {
      reject: false,
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).not.toContain('retired')
  })
})
