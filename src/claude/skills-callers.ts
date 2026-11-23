import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Shipped skills first, then the toolkit's own, so a listing reads in that order. */
const SKILL_ROOTS = ['claude/skills', '.claude/skills'] as const

/** Fence languages a skill runs rather than shows, so their lines count as calls. */
const SHELL_FENCE = /^(?:bash|sh|shell|zsh|console)?$/i

export interface Caller {
  readonly skill: string
  /** Repo-relative, in the `file:line` form a reader clicks. */
  readonly file: string
  /** One-based. */
  readonly line: number
  readonly text: string
}

export interface CallerIndex {
  readonly lines: readonly Caller[]
}

/**
 * Every line of every skill body and reference that sits outside a fence the
 * skill only shows. A shell fence is a call the skill makes, so it stays in.
 */
export function readCallerIndex(root: string): CallerIndex {
  const lines: Caller[] = []

  for (const rel of SKILL_ROOTS) {
    const dir = join(root, rel)
    if (!existsSync(dir)) continue

    const files = ['*/SKILL.md', '*/references/*.md']
      .flatMap((pattern) => [
        ...new Bun.Glob(pattern).scanSync({ cwd: dir, onlyFiles: true }),
      ])
      .map((file) => file.replaceAll('\\', '/'))
      .sort()

    for (const file of files) {
      const skill = file.split('/')[0]
      let shown = false
      let fenced = false

      for (const [index, text] of readFileSync(join(dir, file), 'utf8')
        .split('\n')
        .entries()) {
        const fence = /^\s*```(\S*)/.exec(text)
        if (fence) {
          fenced = !fenced
          shown = fenced && !SHELL_FENCE.test(fence[1])
          continue
        }
        if (shown) continue
        lines.push({ skill, file: `${rel}/${file}`, line: index + 1, text })
      }
    }
  }

  return { lines }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The lines that spell `canon <verb>`, a family verb matching every verb under
 * it. A longer name sharing the stem, such as `lift-all`, is another verb.
 */
export function callersOf(index: CallerIndex, verb: string): Caller[] {
  const spelled = new RegExp(`canon ${escape(verb.trim())}(?![\\w-])`)
  return index.lines.filter((caller) => spelled.test(caller.text))
}

/**
 * The verbs a command file owns. A file in a family folder registers verbs
 * under that family, and a top-level file is the family itself, so a family
 * name it registers for its own root reads as no verb.
 */
export function verbsOfCommandFile(root: string, path: string): string[] {
  const parts = path
    .replace(/^src\/commands\//, '')
    .replace(/\.ts$/, '')
    .split('/')
  const family = parts[0]
  const absolute = join(root, path)
  const text = existsSync(absolute) ? readFileSync(absolute, 'utf8') : ''

  const registered = [...text.matchAll(/\.command\(\s*'([^'\s]+)/g)]
    .map((match) => match[1])
    .filter((name) => name !== family)
  const names = [...new Set(registered)]

  if (parts.length > 1) {
    return names.length > 0
      ? names.map((name) => `${family} ${name}`)
      : [`${family} ${parts[parts.length - 1]}`]
  }

  return names.length > 0 ? names.map((name) => `${family} ${name}`) : [family]
}
