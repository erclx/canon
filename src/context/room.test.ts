import { describe, expect, it } from 'vitest'
import { measureRooms, roomAdvice, roomAt } from '@/context/room'
import { bodyLines } from '@/markdown/scan'

const entry = (body: string) => bodyLines(`# A\n\n${body}`)

describe('measureRooms', () => {
  it('counts bullets at any indent and the lead characters', () => {
    const rooms = measureRooms(
      'canon/context/a.md',
      entry(
        '## Layout\n\n### `src/a/`\n\nLead sentence.\n\n- one\n  - nested\n- two\n\n## Gotchas\n\n- trap\n',
      ),
    )

    expect(rooms.map((r) => [r.kind, r.title, r.bullets, r.lead])).toEqual([
      ['folder', '`src/a/`', 3, 14],
      ['gotchas', 'Gotchas', 1, 0],
    ])
  })

  it('skips Other folders, and Scripts only in the development entry', () => {
    const body = '## Layout\n\n### Other folders\n\n- a\n\n### Scripts\n\n- b\n'

    expect(
      measureRooms('canon/context/a.md', entry(body)).map((r) => r.title),
    ).toEqual(['Scripts'])
    expect(measureRooms('canon/context/development.md', entry(body))).toEqual(
      [],
    )
  })

  it('ends a block before the next heading and finds a line inside it', () => {
    const rooms = measureRooms(
      'canon/context/a.md',
      entry('## Layout\n\n### `a/`\n\nLead.\n\n- x\n\n### `b/`\n\nLead.\n'),
    )

    expect(roomAt(rooms, rooms[0].start + 4)?.title).toBe('`a/`')
    expect(roomAt(rooms, rooms[1].start + 1)?.title).toBe('`b/`')
    expect(roomAt(rooms, 1)).toBeUndefined()
  })

  it('does not take a table as the lead', () => {
    const [room] = measureRooms(
      'canon/context/a.md',
      entry('## Layout\n\n### `a/`\n\n| a | b |\n| - | - |\n| 1 | 2 |\n'),
    )

    expect(room.lead).toBe(0)
  })
})

describe('roomAdvice', () => {
  it('words the folder advice with its counts', () => {
    const [room] = measureRooms(
      'canon/context/a.md',
      entry('## Layout\n\n### `src/a/`\n\nLead sentence.\n\n- one\n- two\n'),
    )

    expect(roomAdvice(room)).toBe(
      '`src/a/` holds 2 of 5 bullets and a lead of 14 of 350 characters. Cut a bullet the code or --help already says, move like facts into one table after the lead, give a subfolder its own H3, or open a sibling entry. Folding the line into the lead or a second paragraph fails the next limit.',
    )
  })

  it('words the gotcha advice with its count', () => {
    const [room] = measureRooms(
      'canon/context/a.md',
      entry('## Gotchas\n\n- a\n- b\n- c\n- d\n- e\n- f\n'),
    )

    expect(roomAdvice(room)).toBe(
      'Gotchas holds 6 of 5. Remove a trap the code no longer has, or state the fact as a bullet on the folder it belongs to.',
    )
  })
})
