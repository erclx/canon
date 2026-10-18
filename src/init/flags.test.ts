import { Command } from 'commander'
import { describe, expect, it } from 'vitest'
import { applyInitOptions, flagsProvided, INIT_OPTIONS } from '@/init/flags'

/**
 * Parses argv against the real option definitions and reports what
 * `flagsProvided` saw, so a default added or dropped upstream shows up here.
 */
function readFlagsProvided(argv: readonly string[]): boolean {
  const command = applyInitOptions(new Command('init'))
  command.argument('[target]', 'Target directory', '.')
  command.parse([...argv], { from: 'user' })

  return flagsProvided(command)
}

describe('applyInitOptions', () => {
  it('should default the stack so a bare init installs governance', () => {
    const command = applyInitOptions(new Command('init'))
    command.parse([], { from: 'user' })

    expect(command.opts().stack).toBe('base')
  })

  it('should declare no standards selection, since the corpus never installs', () => {
    expect(INIT_OPTIONS.map((option) => option.key)).not.toContain('standards')
  })

  it('should declare no snippets selection, since the corpus never installs', () => {
    expect(INIT_OPTIONS.map((option) => option.key)).not.toContain('snippets')
  })

  it('should offer governance as a skippable domain in the help text', () => {
    const skip = INIT_OPTIONS.find((option) => option.key === 'skip')

    expect(skip?.description).toContain('governance')
  })
})

describe('flagsProvided', () => {
  it('should not read a defaulted flag as operator-provided', () => {
    expect(readFlagsProvided([])).toBe(false)
  })

  it('should not read a positional target as operator-provided', () => {
    expect(readFlagsProvided(['../my-app'])).toBe(false)
  })

  it('should read an explicitly passed stack as operator-provided', () => {
    expect(readFlagsProvided(['--stack', 'base'])).toBe(true)
  })

  it('should read a skip as operator-provided', () => {
    expect(readFlagsProvided(['--skip', 'records'])).toBe(true)
  })

  it('should read an explicitly passed add list as operator-provided', () => {
    expect(readFlagsProvided(['--add', 'shadcn'])).toBe(true)
  })
})
