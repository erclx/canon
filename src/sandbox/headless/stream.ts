/**
 * What a run reads from a `claude -p --output-format stream-json` session.
 * `result` is the final `result` message's text, empty when none arrived. `skills`
 * names each `Skill` call's argument, and `writeTargets` and `commands` tie a watched write to this session.
 */
export interface SessionStream {
  readonly result: string
  readonly skills: readonly string[]
  readonly writeTargets?: readonly string[]
  readonly commands?: readonly string[]
}

/**
 * `NotebookEdit` names its target `notebook_path` rather than `file_path`, so
 * each tool maps to the input key that carries the path it writes.
 */
const WRITE_TARGET_KEYS: Readonly<Record<string, string>> = {
  Write: 'file_path',
  Edit: 'file_path',
  NotebookEdit: 'notebook_path',
}

export function reduceStream(out: string): SessionStream {
  let result = ''
  const skills: string[] = []
  const writeTargets: string[] = []
  const commands: string[] = []

  for (const line of out.split('\n')) {
    const message = parseLine(line)
    if (message === undefined) continue
    if (message.type === 'result') result = line.trim()
    if (message.type !== 'assistant') continue
    for (const { name, input } of toolCalls(message)) {
      if (name === 'Skill' && typeof input.skill === 'string')
        skills.push(input.skill)
      if (name === 'Bash' && typeof input.command === 'string')
        commands.push(input.command)
      const key = WRITE_TARGET_KEYS[name]
      const target = key === undefined ? undefined : input[key]
      if (typeof target === 'string') writeTargets.push(target)
    }
  }

  return { result, skills, writeTargets, commands }
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

interface ToolCall {
  readonly name: string
  readonly input: Record<string, unknown>
}

function toolCalls(message: Record<string, unknown>): ToolCall[] {
  const inner = message.message
  if (!isRecord(inner) || !Array.isArray(inner.content)) return []

  return inner.content.flatMap((block: unknown) =>
    isRecord(block) &&
    block.type === 'tool_use' &&
    typeof block.name === 'string' &&
    isRecord(block.input)
      ? [{ name: block.name, input: block.input }]
      : [],
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
