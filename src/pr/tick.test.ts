import { describe, expect, it } from 'vitest'

import { renderEvidenceBody } from '@/pr/evidence'
import {
  readUiPassHead,
  tickBoxes,
  uiPassLine,
  writeUiPassLine,
} from '@/pr/tick'

const HEAD = 'abcdef1234567890'

const CHECKLIST = [
  '- [ ] hero settles',
  '- [ ] nav wraps',
  '- [ ] calm (taste)',
].join('\n')

function bodyWith(checklist: string | undefined): string {
  return renderEvidenceBody([], 'o/r', 'aaaa000', HEAD, undefined, checklist)
}

describe('tickBoxes', () => {
  it('should tick and stamp the named boxes only', () => {
    const result = tickBoxes(bodyWith(CHECKLIST), [2], HEAD)

    expect(result.kind).toBe('ticked')
    if (result.kind !== 'ticked') return
    expect(result.body).toContain('- [ ] hero settles\n')
    expect(result.body).toContain('- [x] nav wraps · passed at `abcdef1`\n')
  })

  it('should leave every line outside the named box as it was', () => {
    const body = bodyWith(CHECKLIST)
    const result = tickBoxes(body, [1], HEAD)

    expect(result.kind).toBe('ticked')
    if (result.kind !== 'ticked') return
    const changed = result.body
      .split('\n')
      .filter((line, index) => line !== body.split('\n')[index])
    expect(changed).toEqual(['- [x] hero settles · passed at `abcdef1`'])
  })

  it('should return the same body when a box is ticked twice at one head', () => {
    const once = tickBoxes(bodyWith(CHECKLIST), [1], HEAD)
    if (once.kind !== 'ticked') throw new Error('expected a tick')

    expect(tickBoxes(once.body, [1], HEAD)).toEqual(once)
  })

  it('should restamp a box ticked at an earlier head', () => {
    const once = tickBoxes(bodyWith(CHECKLIST), [1], '1111111aaaa')
    if (once.kind !== 'ticked') throw new Error('expected a tick')
    const again = tickBoxes(once.body, [1], HEAD)

    expect(again.kind === 'ticked' && again.body).toContain(
      '- [x] hero settles · passed at `abcdef1`',
    )
  })

  it('should refuse a box past the end of the checklist', () => {
    expect(tickBoxes(bodyWith(CHECKLIST), [4], HEAD)).toEqual({
      kind: 'refused',
      reason: 'no-box',
    })
  })

  it('should refuse a taste box named among passed ones', () => {
    expect(tickBoxes(bodyWith(CHECKLIST), [1, 3], HEAD)).toEqual({
      kind: 'refused',
      reason: 'taste-box',
    })
  })

  it('should refuse a body with no checklist', () => {
    expect(tickBoxes(bodyWith(undefined), [1], HEAD)).toEqual({
      kind: 'refused',
      reason: 'no-checklist',
    })
  })
})

const PASSED = {
  kind: 'passed',
  passed: 17,
  total: 17,
  taste: 1,
  head: HEAD,
} as const

const LINE_17 =
  '- [x] UI pass, 17 of 17 boxes passed at `abcdef1`, 1 taste box left to the operator <!-- pr-ui-pass -->'

describe('uiPassLine', () => {
  it('should tick a pass where every driven box passed and count taste apart', () => {
    expect(uiPassLine(PASSED)).toBe(LINE_17)
  })

  it('should leave a partial pass unchecked so a failed box never reads as done', () => {
    expect(uiPassLine({ ...PASSED, passed: 16 })).toBe(
      '- [ ] UI pass, 16 of 17 boxes passed at `abcdef1`, 1 taste box left to the operator <!-- pr-ui-pass -->',
    )
  })

  it('should say so when every box is a taste box rather than 0 of N passed', () => {
    expect(uiPassLine({ ...PASSED, passed: 0, total: 0, taste: 2 })).toBe(
      '- [ ] UI pass, no box a driver can run, 2 taste boxes left to the operator at `abcdef1` <!-- pr-ui-pass -->',
    )
  })

  it('should omit the taste clause when no box is a taste box', () => {
    expect(uiPassLine({ ...PASSED, taste: 0 })).toBe(
      '- [x] UI pass, 17 of 17 boxes passed at `abcdef1` <!-- pr-ui-pass -->',
    )
  })

  it('should name the new head on an unchecked reset', () => {
    expect(uiPassLine({ kind: 'reset', head: HEAD })).toBe(
      '- [ ] UI pass, not run at `abcdef1` <!-- pr-ui-pass -->',
    )
  })
})

describe('writeUiPassLine', () => {
  const BODY = [
    '## Summary',
    '',
    '- did it',
    '',
    '## Testing',
    '',
    '- [x] bun test passes, 4 tests',
    '',
    '## For the reviewer',
    '',
    '- look here',
    '',
  ].join('\n')

  it('should insert the line at the end of Testing', () => {
    expect(writeUiPassLine(BODY, PASSED)).toBe(
      BODY.replace(
        '- [x] bun test passes, 4 tests\n',
        `- [x] bun test passes, 4 tests\n${LINE_17}\n`,
      ),
    )
  })

  it('should rewrite the marked line in place on a second tick', () => {
    const once = writeUiPassLine(BODY, { ...PASSED, passed: 16 })
    const twice = writeUiPassLine(once, PASSED)

    expect(twice).toBe(writeUiPassLine(BODY, PASSED))
    expect(twice.split('pr-ui-pass').length - 1).toBe(1)
  })

  it('should keep a hand edit made between two ticks', () => {
    const once = writeUiPassLine(BODY, PASSED)
    const edited = once.replace('- did it', '- did it, then more')

    expect(writeUiPassLine(edited, { kind: 'reset', head: HEAD })).toContain(
      '- did it, then more',
    )
  })

  it('should restore a deleted line at the end of Testing', () => {
    const deleted = writeUiPassLine(BODY, PASSED).replace(`${LINE_17}\n`, '')

    expect(writeUiPassLine(deleted, PASSED)).toBe(writeUiPassLine(BODY, PASSED))
  })

  it('should create Testing before For the reviewer when absent', () => {
    const body = [
      '## Summary',
      '',
      '- did it',
      '',
      '## For the reviewer',
      '',
      '- look',
      '',
    ].join('\n')

    expect(writeUiPassLine(body, PASSED)).toBe(
      [
        '## Summary',
        '',
        '- did it',
        '',
        '## Testing',
        '',
        LINE_17,
        '',
        '## For the reviewer',
        '',
        '- look',
        '',
      ].join('\n'),
    )
  })

  it('should append Testing when absent and no later section exists', () => {
    expect(writeUiPassLine('## Summary\n\n- did it\n', PASSED)).toBe(
      `## Summary\n\n- did it\n\n## Testing\n\n${LINE_17}\n`,
    )
  })

  it('should insert into a Testing section that ends the document', () => {
    expect(writeUiPassLine('## Testing\n\n- [x] ran it\n', PASSED)).toBe(
      `## Testing\n\n- [x] ran it\n${LINE_17}\n`,
    )
  })
})

describe('readUiPassHead', () => {
  it('should read the head the marked line names', () => {
    expect(readUiPassHead(`x\n${LINE_17}\n`)).toBe('abcdef1')
  })

  it('should read nothing from a body with no marked line', () => {
    expect(readUiPassHead('## Testing\n\n- [x] ran it\n')).toBeUndefined()
  })
})
