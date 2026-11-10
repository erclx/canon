/**
 * What a run reads from a `claude -p --output-format stream-json` session.
 *
 * `result` is the text of the final `result` message, the same object
 * `--output-format json` prints alone, so every reader of the old envelope
 * reads it unchanged. It is empty when no complete `result` line arrived,
 * which those readers already treat as an envelope that did not parse.
 *
 * `skills` names each `Skill` tool call in the order the session made it, as
 * the `skill` argument the call carried. A slash command the prompt opened
 * with expands before the session starts, so it never appears here.
 */
export interface SessionStream {
  readonly result: string
  readonly skills: readonly string[]
}

export function reduceStream(out: string): SessionStream {
  let result = ''
  const skills: string[] = []

  for (const line of out.split('\n')) {
    const message = parseLine(line)
    if (message === undefined) continue
    if (message.type === 'result') result = line.trim()
    if (message.type === 'assistant') skills.push(...skillCalls(message))
  }

  return { result, skills }
}

function parseLine(line: string): Record<string, unknown> | undefined {
  if (line.trim() === '') return undefined
  try {
    const parsed: unknown = JSON.parse(line)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function skillCalls(message: Record<string, unknown>): string[] {
  const inner = message.message
  if (!isRecord(inner) || !Array.isArray(inner.content)) return []

  return inner.content.flatMap((block: unknown) => {
    if (!isRecord(block) || block.type !== 'tool_use' || block.name !== 'Skill')
      return []
    const input = block.input
    return isRecord(input) && typeof input.skill === 'string'
      ? [input.skill]
      : []
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
