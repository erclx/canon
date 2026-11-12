import { describe, expect, it } from 'vitest'
import { readReelWaivers, readWaivers } from '@/pr/waiver'

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

  it('never reads a reel waiver as a capture waiver', () => {
    const body = '- **Waived reel:** hover-only change, nothing to film'

    expect(readWaivers([review(body)])).toEqual([])
  })
})

describe('readReelWaivers', () => {
  it('reads the reason off a reel waiver line', () => {
    const body = [
      '## Review closed',
      '',
      '- **Waived reel:** the only drivable box toggles a tooltip on hover',
    ].join('\n')

    expect(readReelWaivers([review(body)])).toEqual([
      'the only drivable box toggles a tooltip on hover',
    ])
  })

  it('takes only its own line from a pass carrying both waiver kinds', () => {
    const body = [
      '- **Waived capture:** `src/a.tsx`: focus order only',
      '- **Waived reel:** hover-only change',
    ].join('\n')

    expect(readReelWaivers([review(body)])).toEqual(['hover-only change'])
    expect(readWaivers([review(body)])).toEqual([
      { path: 'src/a.tsx', reason: 'focus order only' },
    ])
  })

  it('never counts a reel waiver inside a fenced code block', () => {
    const body = ['```markdown', '- **Waived reel:** sample', '```'].join('\n')

    expect(readReelWaivers([review(body)])).toEqual([])
  })

  it('skips a reel waiver with no reason', () => {
    const body = ['- **Waived reel:**', '- **Waived reel:**    '].join('\n')

    expect(readReelWaivers([review(body)])).toEqual([])
  })
})
