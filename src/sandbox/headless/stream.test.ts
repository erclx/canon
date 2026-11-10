import { describe, expect, it } from 'vitest'
import { reduceStream } from '@/sandbox/headless/stream'

const system = (): string =>
  JSON.stringify({ type: 'system', subtype: 'init', session_id: 's' })

const skillCall = (skill: string): string =>
  JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: 'Loading it.' },
        { type: 'tool_use', id: 't', name: 'Skill', input: { skill } },
      ],
    },
  })

const bashCall = (): string =>
  JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', id: 'b', name: 'Bash', input: { command: 'ls' } },
      ],
    },
  })

const result = (): string =>
  JSON.stringify({
    type: 'result',
    is_error: false,
    result: 'done',
    num_turns: 3,
  })

describe('reduceStream', () => {
  it('should return the result line and no skills when the session called none', () => {
    const out = [system(), bashCall(), result()].join('\n')

    expect(reduceStream(out)).toEqual({
      result:
        '{"type":"result","is_error":false,"result":"done","num_turns":3}',
      skills: [],
      writeTargets: [],
      commands: ['ls'],
    })
  })

  it('should name each Skill call in the order the session made it', () => {
    const out = [
      system(),
      skillCall('canon:target-scaffold'),
      bashCall(),
      skillCall('canon:target-setup'),
      result(),
    ].join('\n')

    expect(reduceStream(out).skills).toEqual([
      'canon:target-scaffold',
      'canon:target-setup',
    ])
  })

  it('should return an empty result when no result line arrived', () => {
    const out = [system(), skillCall('canon:target-scaffold')].join('\n')

    expect(reduceStream(out)).toEqual({
      result: '',
      skills: ['canon:target-scaffold'],
      writeTargets: [],
      commands: [],
    })
  })

  it('should skip a last line the session was cut off inside', () => {
    const out = [
      system(),
      skillCall('canon:git-commit'),
      '{"type":"result","is_err',
    ].join('\n')

    expect(reduceStream(out)).toEqual({
      result: '',
      skills: ['canon:git-commit'],
      writeTargets: [],
      commands: [],
    })
  })

  it('should return nothing for empty output', () => {
    expect(reduceStream('')).toEqual({
      result: '',
      skills: [],
      writeTargets: [],
      commands: [],
    })
  })
})

const toolCall = (
  name: string,
  input: Record<string, unknown>,
  parent: string | null = null,
): string =>
  JSON.stringify({
    type: 'assistant',
    parent_tool_use_id: parent,
    message: { content: [{ type: 'tool_use', id: 'w', name, input }] },
  })

describe('reduceStream on what the session wrote', () => {
  it('should return each file-writing target and Bash command in order', () => {
    const out = [
      system(),
      toolCall('Write', { file_path: '/main/.canon/plans/feature-x.md' }),
      toolCall('Bash', { command: 'echo b > /main/.canon/tasks/b.md' }),
      toolCall('Edit', { file_path: '/main/.canon/review/r.md' }),
      toolCall('NotebookEdit', { notebook_path: '/sandbox/n.ipynb' }),
      result(),
    ].join('\n')

    const stream = reduceStream(out)

    expect(stream.writeTargets).toEqual([
      '/main/.canon/plans/feature-x.md',
      '/main/.canon/review/r.md',
      '/sandbox/n.ipynb',
    ])
    expect(stream.commands).toEqual(['echo b > /main/.canon/tasks/b.md'])
  })

  // Measured 2026-11-10: a subagent's tool call arrives as its own assistant
  // line carrying the spawning call's id, and its write is the session's too.
  it('should read a subagent call carrying a parent tool use id', () => {
    const out = [
      toolCall('Write', { file_path: '/main/.canon/plans/sub.md' }, 'toolu_1'),
    ].join('\n')

    expect(reduceStream(out).writeTargets).toEqual([
      '/main/.canon/plans/sub.md',
    ])
  })

  it('should return no targets or commands for a stream carrying neither', () => {
    const out = [system(), skillCall('canon:git-commit'), result()].join('\n')

    const stream = reduceStream(out)

    expect(stream.writeTargets).toEqual([])
    expect(stream.commands).toEqual([])
  })

  it('should skip a write call whose path is not a string', () => {
    const out = toolCall('Write', { file_path: 42 })

    expect(reduceStream(out).writeTargets).toEqual([])
  })
})
