import { escapeForPattern, isMarked } from '@/sweep/exempt-marker'

/**
 * A client command this repository quotes, with the argument spelling every
 * quotation of it has to carry.
 *
 * `source` is the fact grounding `canonicalArgument`, so a reader correcting a
 * flagged line can see why the flagged form is wrong rather than taking the
 * table on faith.
 */
export interface ClientCommand {
  readonly command: string
  readonly canonicalArgument: string
  readonly source: string
}

export const CLIENT_COMMANDS: readonly ClientCommand[] = [
  {
    command: 'claude rm',
    canonicalArgument: 'id',
    source:
      '`claude rm <id>` takes the session id `claude agents --json` carries beside a name, never the name itself, confirmed against `claude rm --help` on 2026-09-02.',
  },
]

export const CLIENT_COMMAND_MARKER = 'canon-allow-client-command'

/**
 * A bracketed placeholder or a template interpolation, each optionally
 * single-quoted, which is the one call form this scanner reads. A sentence
 * naming the command with no bracketed argument carries no placeholder at all
 * and never matches, which is deliberate: the defect this closes is a wrong
 * argument shown as an invocation, not a sentence that never showed one.
 *
 * The interpolation half admits a dotted path, since a property access is the
 * ordinary shape a real call site interpolates, such as `${session.id}`, and a
 * bare `${id}` is the rarer one that only a fixture writes. A capture stopping
 * at the first `.` matched the command literal and missed the property access
 * beside it entirely, which is how the check went unable to read the one call
 * form this repository's own worktree listing writes.
 */
const PLACEHOLDER = `'?(?:<([\\w-]+)>|\\$\\{(\\w+(?:\\.\\w+)*)\\})'?`

export interface ClientCommandCitation {
  readonly file: string
  /** One-based, matching the `file:line` form a reader clicks. */
  readonly line: number
  readonly command: string
  /** The invocation as written, so a report names the text to correct. */
  readonly text: string
  readonly argument: string
}

/**
 * Every quotation of a listed command in one file whose argument disagrees
 * with the table, and no marker mutes.
 *
 * `commands` defaults to the shipped table and takes a narrower one only for
 * the empty-table case a measure guards against, since production code never
 * has a reason to check against anything else.
 */
export function clientCommandCitationsIn(
  file: string,
  text: string,
  commands: readonly ClientCommand[] = CLIENT_COMMANDS,
): ClientCommandCitation[] {
  const lines = text.split('\n')
  const citations: ClientCommandCitation[] = []

  for (const { command, canonicalArgument } of commands) {
    const pattern = new RegExp(
      `${escapeForPattern(command)}\\s+${PLACEHOLDER}`,
      'g',
    )

    for (const [index, line] of lines.entries()) {
      if (isMarked(lines, index, CLIENT_COMMAND_MARKER)) continue

      for (const match of line.matchAll(pattern)) {
        const dotted = match[2]
        const argument =
          dotted !== undefined
            ? (dotted.split('.').at(-1) ?? dotted)
            : (match[1] ?? '')
        if (argument === canonicalArgument) continue

        citations.push({
          file,
          line: index + 1,
          command,
          text: match[0],
          argument,
        })
      }
    }
  }

  return citations
}
