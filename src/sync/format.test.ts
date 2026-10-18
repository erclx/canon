import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatWritten } from '@/sync/format'

let TARGET: string

/** A stand-in formatter that records its argv and exits with the given code. */
function installFormatter(name: string, exitCode = 0): string {
  const bin = join(TARGET, 'node_modules', '.bin')
  mkdirSync(bin, { recursive: true })
  const log = join(TARGET, `${name}.log`)
  const path = join(bin, name)
  writeFileSync(
    path,
    `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}"\nexit ${exitCode}\n`,
  )
  chmodSync(path, 0o755)
  return log
}

beforeEach(() => {
  TARGET = mkdtempSync(join(tmpdir(), 'canon-format-'))
})

afterEach(() => {
  rmSync(TARGET, { recursive: true, force: true })
})

describe('formatWritten', () => {
  it('should resolve quietly when no formatter is installed', async () => {
    await expect(formatWritten(TARGET, ['a.json'])).resolves.toBeUndefined()
  })

  it('should prefer oxfmt over prettier', async () => {
    const oxfmt = installFormatter('oxfmt')
    const prettier = installFormatter('prettier')
    await formatWritten(TARGET, ['a.json'])
    expect(existsSync(oxfmt)).toBe(true)
    expect(existsSync(prettier)).toBe(false)
  })

  it('should fall back to prettier when oxfmt is absent', async () => {
    const prettier = installFormatter('prettier')
    await formatWritten(TARGET, ['a.json'])
    expect(readFileSync(prettier, 'utf8')).toContain('a.json')
  })

  it('should hand the formatter only the written formattable paths', async () => {
    const log = installFormatter('oxfmt')
    await formatWritten(TARGET, [
      'canon/config/config.json',
      'hook.sh',
      'x.png',
    ])
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      join(TARGET, 'canon/config/config.json'),
    ])
  })

  it('should not run when no written path is formattable', async () => {
    const log = installFormatter('oxfmt')
    await formatWritten(TARGET, ['hook.sh'])
    expect(existsSync(log)).toBe(false)
  })

  it('should not fail when the formatter exits non-zero', async () => {
    installFormatter('oxfmt', 2)
    await expect(formatWritten(TARGET, ['a.json'])).resolves.toBeUndefined()
  })
})
