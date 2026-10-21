import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cliRun } from '@/cli/run'

let dir: string
const saved = process.env.CANON_NON_INTERACTIVE

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'canon-cli-run-'))
  delete process.env.CANON_NON_INTERACTIVE
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  if (saved === undefined) delete process.env.CANON_NON_INTERACTIVE
  else process.env.CANON_NON_INTERACTIVE = saved
})

describe('cliRun', () => {
  it('should make a non-interactive child headless by closing its stdin, not by the variable', async () => {
    const script = join(dir, 'child.ts')
    writeFileSync(
      script,
      [
        'const input = await Bun.stdin.text()',
        "const clean = input === '' && process.env.CANON_NON_INTERACTIVE === undefined",
        'process.exit(clean ? 0 : 1)',
        '',
      ].join('\n'),
    )

    const succeeded = await cliRun(script, [], { nonInteractive: true })()

    expect(succeeded).toBe(true)
  })
})
