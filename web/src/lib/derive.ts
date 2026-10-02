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

// A blank frame line or a colon-less group heading sits between two groups of
// rows, while a heading ending in a colon opens the next block and ends them.
const GROUP_BREAK = /^\W*$|^\W*\s{2}[A-Z][A-Za-z ]*$/

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
    if (name) {
      names.push(name)
      continue
    }
    if (GROUP_BREAK.test(line)) continue
    break
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

/** The verb the post-merge hook hands every step to. */
export const POST_MERGE_VERB = 'canon hooks post-merge'

/**
 * The verbs the post-merge hook actually runs, each with what it does. The
 * hook calls one verb, and that verb's help lists the steps it runs from the
 * same table it runs them from, so the figure reads the help rather than the
 * hook.
 */
export function hookActions(
  hook: string,
  help: string,
  notes: Readonly<Record<string, string>>,
): HookAction[] {
  // The header comment and the `--help` probe both name the verb, so only a
  // live line that is not the probe counts as the call.
  const isCalled = hook
    .split('\n')
    .map((line) => line.trim())
    .some(
      (line) =>
        !line.startsWith('#') &&
        line.includes(POST_MERGE_VERB) &&
        !line.includes('--help'),
    )
  if (!isCalled) {
    throw new Error(`.husky/post-merge no longer calls ${POST_MERGE_VERB}`)
  }
  const actions = Object.entries(notes)
    .filter(([verb]) => help.includes(verb))
    .map(([verb, effect]) => ({ verb, effect }))
  if (actions.length === 0) {
    throw new Error(
      `${POST_MERGE_VERB} runs none of the verbs the merge figure names`,
    )
  }
  return actions
}

export interface SkillGroup {
  readonly group: string
  readonly skills: readonly { name: string; usage: string }[]
}

const SKILL_ROW = /^\|\s*`canon:([^`]+)`\s*\|(.*)$/

/**
 * The skill map's groups, each skill with the text saying when to reach for
 * it. A row counts only when its first cell is a backticked `canon:<name>`, so
 * any other table on the page is left alone. The read refuses in both
 * directions, a catalog skill with no row and a row naming no catalog skill,
 * and refuses a row it cannot split, so a reformat fails the build rather than
 * dropping a skill from the field.
 */
export function skillGroups(
  markdown: string,
  names: readonly string[],
): SkillGroup[] {
  const groups: { group: string; skills: { name: string; usage: string }[] }[] =
    []
  const seen = new Set<string>()
  const twice: string[] = []
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^## (.+)$/)
    if (heading) {
      groups.push({ group: (heading[1] as string).trim(), skills: [] })
      continue
    }
    const row = line.match(SKILL_ROW)
    if (!row) continue
    const name = row[1] as string
    const cell = (row[2] as string).trim().replace(/\|$/, '')
    if (cell.includes('|')) {
      throw new Error(`The skill map row for ${name} has more than two cells`)
    }
    const current = groups[groups.length - 1]
    if (!current) {
      throw new Error(`The skill map row for ${name} sits under no group`)
    }
    if (seen.has(name)) twice.push(name)
    seen.add(name)
    const usage = cell
      .replace(/<!--.*?-->/g, '')
      .replace(/`/g, '')
      .trim()
    current.skills.push({ name, usage })
  }

  const problems: string[] = []
  const missing = names.filter((name) => !seen.has(name))
  const unknown = [...seen].filter((name) => !names.includes(name))
  if (missing.length > 0) {
    problems.push(`skills with no row: ${missing.join(', ')}`)
  }
  if (unknown.length > 0) {
    problems.push(`rows naming no catalog skill: ${unknown.join(', ')}`)
  }
  if (twice.length > 0) {
    problems.push(`skills listed twice: ${twice.join(', ')}`)
  }
  if (problems.length > 0) {
    throw new Error(
      `The skill map disagrees with the catalog, ${problems.join('; ')}`,
    )
  }
  return groups.filter((entry) => entry.skills.length > 0)
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
