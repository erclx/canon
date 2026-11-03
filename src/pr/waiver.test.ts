import { describe, expect, it } from 'vitest'
import { readWaivers } from '@/pr/waiver'

function review(body: string): { body: string } {
  return { body }
}

describe('readWaivers', () => {
  it('reads a waiver line out of a code review body', () => {
    const body = [
      '## Review closed',
      '',
      '- **Waived capture:** `src/client/board/overlay.tsx`: keyboard focus order only, no visible change in any reachable state',
    ].join('\n')

    expect(readWaivers([review(body)])).toEqual([
      {
        path: 'src/client/board/overlay.tsx',
        reason:
          'keyboard focus order only, no visible change in any reachable state',
      },
    ])
  })

  it('reads two waivers across two lines and two reviews', () => {
    const first = '- **Waived capture:** `src/a.tsx`: focus order only'
    const second = [
      '## UI review closed',
      '- **Waived capture:** `src/b.css`: print stylesheet, no screen state',
    ].join('\n')

    expect(readWaivers([review(first), review(second)])).toEqual([
      { path: 'src/a.tsx', reason: 'focus order only' },
      { path: 'src/b.css', reason: 'print stylesheet, no screen state' },
    ])
  })

  it('never counts a waiver line inside a fenced code block', () => {
    const body = [
      'The form is:',
      '',
      '```text',
      '- **Waived capture:** `src/client/board/overlay.tsx`: sample',
      '```',
      '',
      '~~~',
      '- **Waived capture:** `src/other.tsx`: sample',
      '~~~',
    ].join('\n')

    expect(readWaivers([review(body)])).toEqual([])
  })

  it('skips a malformed line', () => {
    const body = [
      '- **Waived capture:** src/no-backticks.tsx: reason',
      '- **Waived capture:** `src/no-reason.tsx`',
      '- **Waived capture:** `src/empty-reason.tsx`:   ',
      '- **Waived capture:** ``: empty path',
      'Waived capture: `src/no-bold.tsx`: reason',
    ].join('\n')

    expect(readWaivers([review(body)])).toEqual([])
  })

  it('keeps a path spelled with a leading ./ as written', () => {
    const body = '- **Waived capture:** `./src/a.tsx`: focus order only'

    expect(readWaivers([review(body)])).toEqual([
      { path: './src/a.tsx', reason: 'focus order only' },
    ])
  })

  it('reads nothing from a review with no body', () => {
    expect(readWaivers([{}, { body: '' }])).toEqual([])
  })
})
