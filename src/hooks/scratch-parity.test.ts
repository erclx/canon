import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../..')

// Both trees carry the same hook and nothing else compares them, matching
// src/hooks/guard.test.ts's TREES. A fix landing in one and not the other
// still passes every other stage in the gate.
const TREES = [
  { dir: join(ROOT, '.claude/hooks'), label: '.claude/hooks' },
  {
    dir: join(ROOT, 'tooling/claude/seeds/.claude/hooks'),
    label: 'tooling/claude/seeds/.claude/hooks',
  },
]

// The harness assigns a background session a temp folder under the home
// folder, which no repository ignores. The probe below is about project
// scratch roots, so an arm naming that folder is covered by the spawned-hook
// test instead.
const HARNESS_FOLDER = '/.claude/jobs/'

// The hook accepts a scratch write it recognizes through case arms under
// `case "$file_path" in`, each exiting 0 on more than the bare wildcard.
// Collecting every such arm rather than returning on the first is what keeps
// a second arm added later from going untested. Parsing them here rather than
// restating the two spellings is what makes this a parity test rather than a
// second copy of the pair.
function deriveAcceptPatterns(source: string, hookPath: string): string[] {
  const patterns: string[] = []

  for (const line of source.split('\n')) {
    const match = line.trim().match(/^(.+)\)\s*exit 0\s*;;$/)
    if (!match || match[1] === '*') continue
    patterns.push(
      ...match[1]
        .split('|')
        .map((pattern) => pattern.trim())
        .filter((pattern) => !pattern.includes(HARNESS_FOLDER)),
    )
  }

  if (patterns.length === 0) {
    throw new Error(
      `No accept-pattern case arm found in ${hookPath}. The hook's shape changed; update this test's parser.`,
    )
  }

  return patterns
}

// `*/.canon/tmp/*` matches any path carrying that segment, the glob wrapper
// included. check-ignore reasons about a path rather than a bash case
// pattern, so the probe strips the wrapper down to the folder git has to
// ignore.
function probePath(pattern: string): string {
  const folder = pattern.replace(/^\*\//, '').replace(/\/\*$/, '')
  return `${folder}/probe.md`
}

function isIgnored(path: string): boolean {
  const result = spawnSync('git', ['check-ignore', '--quiet', path], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (result.status === 0) return true
  if (result.status === 1) return false
  throw new Error(
    `git check-ignore exited ${result.status ?? -1} on ${path}: ${result.stderr}`,
  )
}

for (const tree of TREES) {
  const hookPath = join(tree.dir, 'scratch-guard.sh')

  describe(`scratch-guard ignore parity: ${tree.label}`, () => {
    const patterns = deriveAcceptPatterns(
      readFileSync(hookPath, 'utf8'),
      hookPath,
    )

    it('derives at least one accept pattern from the hook', () => {
      expect(patterns.length).toBeGreaterThan(0)
    })

    it('names the current scratch root alone in its warning', () => {
      const source = readFileSync(hookPath, 'utf8')
      const msg = source.match(/^msg='(.+)'$/m)?.[1] ?? ''

      expect(msg).toContain('.canon/tmp/')
      expect(msg).not.toContain('.claude/.tmp')
    })

    it.each(patterns)(
      'git ignores a write the hook accepts under %s',
      (pattern) => {
        expect(isIgnored(probePath(pattern))).toBe(true)
      },
    )
  })
}

interface HookRun {
  stdout: string
  status: number | null
}

function runHook(hookPath: string, filePath: string, project: string): HookRun {
  const payload = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: filePath },
    session_id: `parity-${Math.random().toString(36).slice(2)}`,
  })
  const result = spawnSync('bash', [hookPath], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  })
  return { stdout: result.stdout, status: result.status }
}

for (const tree of TREES) {
  const hookPath = join(tree.dir, 'scratch-guard.sh')

  describe(`scratch-guard job folder: ${tree.label}`, () => {
    const project = mkdtempSync(join(tmpdir(), 'scratch-guard-'))
    afterAll(() => rmSync(project, { recursive: true, force: true }))

    it('stays silent on a write under the harness job folder', () => {
      const run = runHook(
        hookPath,
        '/home/someone/.claude/jobs/efde12bc/tmp/notes.md',
        project,
      )

      expect(run.status).toBe(0)
      expect(run.stdout).toBe('')
    })

    it('leaves no marker behind for a job folder write', () => {
      runHook(
        hookPath,
        '/home/someone/.claude/jobs/efde12bc/tmp/notes.md',
        project,
      )

      expect(existsSync(join(project, '.canon'))).toBe(false)
      expect(existsSync(join(project, '.claude'))).toBe(false)
    })

    it.each([
      '/elsewhere/tmp/notes.md',
      '/home/someone/.claude/jobs-old/tmp/notes.md',
      '/home/someone/jobs/tmp/notes.md',
    ])('still warns on %s', (path) => {
      const run = runHook(hookPath, path, project)

      expect(run.stdout).toContain('Temporary file write outside')
    })
  })
}
