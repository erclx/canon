import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(import.meta.dirname, '../../claude/hooks/empty-folder.sh')

let folder: string

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'empty-folder-hook-'))
})

afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

const runHook = (projectDir: string): { code: number; stdout: string } => {
  const run = spawnSync('sh', [SCRIPT], {
    cwd: tmpdir(),
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', CLAUDE_PROJECT_DIR: projectDir },
  })

  return { code: run.status ?? -1, stdout: run.stdout }
}

const contextOf = (stdout: string): string => {
  const parsed = JSON.parse(stdout) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string }
  }
  expect(parsed.hookSpecificOutput.hookEventName).toBe('SessionStart')

  return parsed.hookSpecificOutput.additionalContext
}

describe('empty-folder hook', () => {
  it('should name target-scaffold in a folder holding nothing', () => {
    const { code, stdout } = runHook(folder)

    expect(code).toBe(0)
    expect(contextOf(stdout)).toContain('canon:target-scaffold')
  })

  it('should name target-scaffold in a folder holding only .git', () => {
    mkdirSync(join(folder, '.git'))

    const { code, stdout } = runHook(folder)

    expect(code).toBe(0)
    expect(contextOf(stdout)).toContain('canon:target-scaffold')
  })

  it('should stay silent in a folder holding one file', () => {
    mkdirSync(join(folder, '.git'))
    writeFileSync(join(folder, 'package.json'), '{}\n')

    expect(runHook(folder)).toEqual({ code: 0, stdout: '' })
  })

  it('should stay silent in a folder holding one dotfile', () => {
    mkdirSync(join(folder, '.git'))
    writeFileSync(join(folder, '.gitignore'), 'node_modules\n')

    expect(runHook(folder)).toEqual({ code: 0, stdout: '' })
  })

  it('should stay silent when the project folder does not exist', () => {
    expect(runHook(join(folder, 'missing'))).toEqual({ code: 0, stdout: '' })
  })
})
