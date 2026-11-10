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
      result: '{"type":"result","is_error":false,"result":"done","num_turns":3}',
      skills: [],
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
    })
  })

  it('should return nothing for empty output', () => {
    expect(reduceStream('')).toEqual({ result: '', skills: [] })
  })
})
