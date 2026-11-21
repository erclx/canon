import { escapeForPattern, isMarked } from '@/sweep/exempt-marker'

/**
 * A client command this repository quotes, with the argument spelling every
 * quotation of it has to carry. `source` grounds `canonicalArgument`, so a
 * reader correcting a flagged line sees why the flagged form is wrong.
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
 * single-quoted, the one call form this scanner reads. The interpolation half
 * admits a dotted path, since a capture stopping at the first `.` would miss it.
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
 * Every quotation of a listed command in one file whose argument disagrees with
 * the table, and no marker mutes. `commands` takes a narrower table only for the
 * empty-table case a measure guards against.
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
