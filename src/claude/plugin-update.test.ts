import { describe, expect, it } from 'vitest'
import {
  matchInstall,
  readPluginName,
  updatedMessage,
} from '@/claude/plugin-update'

describe('readPluginName', () => {
  it('should read the name field out of a valid manifest', () => {
    expect(readPluginName('{"name":"canon","version":"4.68.0"}')).toBe('canon')
  })

  it('should return undefined when the manifest carries no name', () => {
    expect(readPluginName('{"version":"4.68.0"}')).toBeUndefined()
  })

  it('should return undefined when name is not a string', () => {
    expect(readPluginName('{"name":42}')).toBeUndefined()
  })

  it('should return undefined when the manifest does not parse', () => {
    expect(readPluginName('not json')).toBeUndefined()
  })
})

describe('matchInstall', () => {
  const canon = { id: 'canon@canon', version: '4.68.0' }
  const vercel = { id: 'vercel@claude-plugins-official', version: '0.48.0' }

  it('should match the one row whose id carries the name prefix', () => {
    const result = matchInstall('canon', [canon, vercel])
    expect(result).toEqual({ kind: 'matched', install: canon })
  })

  it('should report none when no row carries the prefix', () => {
    const result = matchInstall('missing', [canon, vercel])
    expect(result).toEqual({ kind: 'none' })
  })

  it('should report many when more than one row carries the prefix', () => {
    const fork = { id: 'canon@fork', version: '4.60.0' }
    const result = matchInstall('canon', [canon, fork])
    expect(result).toEqual({ kind: 'many', installs: [canon, fork] })
  })

  it('should not match a name that is only a prefix of another name', () => {
    const canonSandbox = { id: 'canon-sandbox@canon', version: '1.0.0' }
    const result = matchInstall('canon', [canonSandbox])
    expect(result).toEqual({ kind: 'none' })
  })
})

describe('updatedMessage', () => {
  it('should report the version move when the update changed it', () => {
    expect(updatedMessage('4.67.0', '4.68.0')).toBe(
      'Plugin updated 4.67.0 to 4.68.0.',
    )
  })

  it('should report no change when the update left the version the same', () => {
    expect(updatedMessage('4.68.0', '4.68.0')).toBe(
      'Plugin reinstalled 4.68.0, unchanged.',
    )
  })
})
