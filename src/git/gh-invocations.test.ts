import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')

/**
 * Slices the argument list of a call whose opening `execa(` ends at `open`, by
 * counting paren depth, since a regex anchored to `})` misreads a reformatted call.
 */
function callArgs(text: string, open: number): string | null {
  let depth = 1
  let i = open
  while (i < text.length && depth > 0) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    i++
  }
  return depth === 0 ? text.slice(open, i - 1) : null
}

/**
 * Answers whether the file text holds an `execa('gh', ...)` call whose arguments
 * lack `gitEnv()`, or one this walk could not read. `gh` resolves its repository
 * through the same variables git does, and they beat `cwd`.
 */
function hasUnstrippedGhCall(text: string): boolean {
  const marker = /execa\(\s*'gh'/g
  let match: RegExpExecArray | null
  while ((match = marker.exec(text)) !== null) {
    const open = match.index + match[0].lastIndexOf('(') + 1
    const args = callArgs(text, open)
    if (args === null || !args.includes('gitEnv()')) return true
  }
  return false
}

describe('the source tree', () => {
  it('strips the git resolution variables from every gh invocation', () => {
    const offenders = readdirSync(join(ROOT, 'src'), { recursive: true })
      .map(String)
      .filter((rel) => rel.endsWith('.ts') && !rel.endsWith('.test.ts'))
      .filter((rel) =>
        hasUnstrippedGhCall(readFileSync(join(ROOT, 'src', rel), 'utf8')),
      )

    expect(offenders).toEqual([])
  })
})
