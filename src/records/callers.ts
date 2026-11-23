import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  type CallerIndex,
  callersOf,
  readCallerIndex,
  verbsOfCommandFile,
} from '@/claude/skills-callers'
import {
  type Bullet,
  covers,
  parseBullet,
  readBullets,
  shorten,
} from '@/records/counterpart'

/**
 * What a plan's callers check reads off the project: the root, for the command
 * files a plan names, and the lines of every skill that may run their verbs.
 */
export interface CallersRoot {
  readonly root: string
  readonly index: CallerIndex
}

export interface CallersFinding {
  readonly kind: 'callers-unstated' | 'callers-malformed'
  readonly subject: string
  readonly message: string
}

/**
 * Reads nothing in a project shipping no `claude/skills/`, since a target's own
 * `src/commands/` has no shipped skills calling it.
 */
export function readCallersRoot(root: string): CallersRoot | undefined {
  if (!existsSync(join(root, 'claude', 'skills'))) return undefined
  return { root, index: readCallerIndex(root) }
}

const COMMAND_FILE = /^src\/commands\/.+\.ts$/

function isVerbChange(path: string): boolean {
  return COMMAND_FILE.test(path) && !path.endsWith('.test.ts')
}

function commandFiles(entries: readonly string[]): string[] {
  const found = new Set<string>()

  for (const line of entries) {
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const path = match[1].trim().replace(/^\.\//, '')
      if (isVerbChange(path)) found.add(path)
    }
  }

  return [...found]
}

const VERDICT = /^(?:here\b|none\b[\s,;:]+[A-Za-z0-9])/i

const BULLET_FORM =
  'Write it as "- `<skill path>`: here, <what changes>", "- `<skill path>`: none, <why>", or "- `canon <verb>`: none, <why>" under ## Callers.'

function isVerbBullet(path: string): boolean {
  return path.startsWith('canon ')
}

function coversVerb(stated: string, verb: string): boolean {
  const base = stated.slice('canon '.length).trim()
  return verb === base || verb.startsWith(`${base} `)
}

function skillDirOf(file: string): string {
  return file.split('/').slice(0, 3).join('/')
}

function coversSkill(stated: string, dir: string): boolean {
  return covers(stated, dir) || stated.startsWith(`${dir}/`)
}

/**
 * Reports each skill that runs a verb a plan's command files own and no
 * `## Callers` bullet covers, and each bullet whose verdict is not `here` or
 * `none` with a reason. A command file's test never counts as a verb change.
 */
export function checkCallers(
  filesToTouch: readonly string[],
  section: readonly string[] | undefined,
  context: CallersRoot,
): CallersFinding[] {
  const verbs = commandFiles(filesToTouch).flatMap((file) =>
    verbsOfCommandFile(context.root, file),
  )
  if (verbs.length === 0) return []

  const bullets: Bullet[] = readBullets(section ?? []).map(parseBullet)
  const findings: CallersFinding[] = []

  for (const bullet of bullets) {
    if (
      bullet.paths.length > 0 &&
      bullet.verdict !== undefined &&
      VERDICT.test(bullet.verdict)
    ) {
      continue
    }
    findings.push({
      kind: 'callers-malformed',
      subject: shorten(bullet.text),
      message: `states no backticked path before a colon, or no verdict after it that reads as here or none with a reason. ${BULLET_FORM}`,
    })
  }

  const stated = bullets.flatMap((bullet) => bullet.paths)
  const reported = new Set<string>()

  for (const verb of new Set(verbs)) {
    if (stated.some((path) => isVerbBullet(path) && coversVerb(path, verb))) {
      continue
    }

    for (const caller of callersOf(context.index, verb)) {
      const dir = skillDirOf(caller.file)
      const key = `${dir}|${verb}`
      if (reported.has(key)) continue
      reported.add(key)

      if (
        stated.some((path) => !isVerbBullet(path) && coversSkill(path, dir))
      ) {
        continue
      }

      findings.push({
        kind: 'callers-unstated',
        subject: dir,
        message: `runs canon ${verb} at ${caller.file}:${caller.line}, and no ## Callers bullet states what happens to it. List callers with canon claude skills callers "${verb}". ${BULLET_FORM}`,
      })
    }
  }

  return findings
}
