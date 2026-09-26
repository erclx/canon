import { Command } from 'commander'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

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

const LISTING_WIDTH = 80
const ANSI = /\u001b\[[0-9;]*m/g

function readListing(): string[] {
  const { stdout } = Bun.spawnSync(
    ['bun', join(import.meta.dirname, 'cli.ts'), '--help'],
    { env: { ...process.env, NO_COLOR: '1' } },
  )
  const lines = stdout.toString().replace(ANSI, '').split('\n')
  const start = lines.findIndex((line) => /^\W*Commands:\s*$/.test(line))
  const end = lines.findIndex(
    (line, index) => index > start && /^\W*\s{2}[A-Z][a-z]+:\s*$/.test(line),
  )
  return lines.slice(start + 1, end)
}

describe('top-level help listing', () => {
  const registered = buildProgram().commands.map((c) => c.name())
  let listing: string[] = []
  let listed: string[] = []

  beforeAll(() => {
    listing = readListing()
    listed = listing
      .filter((line) => /^\W*?\s{4}[a-z]/.test(line))
      .map((row) => row.match(/([a-z][a-z-]*)/)![1])
  })

  it('should list every registered command', () => {
    expect(registered.filter((name) => !listed.includes(name))).toEqual([])
  })

  it('should list only registered commands', () => {
    expect(listed.filter((name) => !registered.includes(name))).toEqual([])
  })

  it('should list each command once', () => {
    expect(listed.filter((name, i) => listed.indexOf(name) !== i)).toEqual([])
  })

  it('should group the rows under headings', () => {
    const headings = listing.filter((line) => /^\W*\s{2}[A-Z]/.test(line))

    expect(headings.length).toBeGreaterThan(1)
  })

  it('should hold every row to the listing width', () => {
    const wide = listing.filter((line) => line.length > LISTING_WIDTH)

    expect(wide).toEqual([])
  })
})
