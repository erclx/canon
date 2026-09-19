import micromatch from 'micromatch'

/**
 * The pure half of the page's build-time reads. `session.ts` spawns the CLI
 * and reads files, then hands the text here, so every rule about what a read
 * means sits somewhere a unit test reaches without a build.
 *
 * Every function refuses rather than returning an empty or partial answer,
 * because a figure drawn from nothing still renders, and a page that ships a
 * figure nothing measured is the failure the landing page rule exists to stop.
 */

export interface RuleMeta {
  readonly name: string
  readonly description: string
  readonly paths?: readonly string[]
}

export interface RuleMatch extends RuleMeta {
  /** The one glob that matched, which is the one a reader needs to see. */
  readonly glob: string
}

export interface RuleMatchResult {
  readonly matched: readonly RuleMatch[]
  readonly unmatched: number
  readonly always: number
  readonly total: number
}

/** Which rules a session editing `path` loads, split the way the harness decides it. */
export function matchRules(
  rules: readonly RuleMeta[],
  path: string,
): RuleMatchResult {
  const matched: RuleMatch[] = []
  let always = 0

  for (const rule of rules) {
    const globs = rule.paths ?? []
    if (globs.length === 0) {
      always++
      continue
    }
    const glob = globs.find((candidate) => micromatch.isMatch(path, candidate))
    if (glob) matched.push({ ...rule, glob })
  }

  return {
    matched,
    unmatched: rules.length - matched.length - always,
    always,
    total: rules.length,
  }
}

/**
 * The first sentence whole, never a fixed slice. A character cut landed
 * mid-word in the reference build and shipped half a word to the page.
 */
export function firstSentence(text: string): string {
  return text.split(/(?<=\.)\s/)[0]?.trim() ?? text
}

const ANSI = /\u001b\[[0-9;]*m/g

/**
 * Every top-level command the help text lists. The help is the surface a
 * reader meets, so a command registered but left out of it is left out here
 * too, which keeps the field's count and its names one reading.
 */
export function commandNamesFromHelp(help: string): string[] {
  const lines = help.replace(ANSI, '').split('\n')
  const start = lines.findIndex((line) => /^\W*Commands:\s*$/.test(line))
  if (start === -1) {
    throw new Error('canon --help carries no Commands block to read names from')
  }

  const names: string[] = []
  for (const line of lines.slice(start + 1)) {
    const name = line.match(/^\W*?\s{4}([a-z][a-z-]*)\b/)?.[1]
    if (!name) break
    names.push(name)
  }
  if (names.length === 0) {
    throw new Error('canon --help lists no command under Commands')
  }
  return names
}

/**
 * The names a depicted session used, checked against the catalog they are lit
 * in. The used lists are authored against the session, so this is what stops
 * a renamed skill leaving a lit name the field no longer carries.
 */
export function requireListed(
  used: readonly string[],
  catalog: readonly string[],
  label: string,
): string[] {
  const missing = used.filter((name) => !catalog.includes(name))
  if (missing.length > 0) {
    throw new Error(
      `The ${label} field lights ${missing.join(', ')}, which the ${label} catalog no longer lists`,
    )
  }
  return [...used]
}

export interface HookAction {
  readonly verb: string
  readonly effect: string
}

/** The verbs the post-merge hook actually runs, each with what it does. */
export function hookActions(
  hook: string,
  notes: Readonly<Record<string, string>>,
): HookAction[] {
  const actions = Object.entries(notes)
    .filter(([verb]) => hook.includes(verb))
    .map(([verb, effect]) => ({ verb, effect }))
  if (actions.length === 0) {
    throw new Error(
      '.husky/post-merge runs none of the verbs the merge figure names',
    )
  }
  return actions
}

/** A rule's bullet, read whole, so the page quotes what the rule still says. */
export function ruleBullet(text: string, opening: string): string {
  const line = text
    .split('\n')
    .find((candidate) => candidate.startsWith(`- ${opening}`))
  if (!line) {
    throw new Error(`The rule no longer carries a bullet opening "${opening}"`)
  }
  return line.slice(2).trim()
}
