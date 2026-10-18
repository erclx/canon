import { describe, expect, it } from 'vitest'
import {
  isMalformed,
  isUnread,
  readItems,
  writeAnswerLine,
} from '@/intake/items'

interface ItemFixture {
  readonly label: string
  readonly title?: string
  readonly problem?: string | null
  readonly fix?: string | null
  readonly open?: string
  readonly suggested?: string
  readonly answer?: string
}

function item({
  label,
  title = 'Something is wrong',
  problem = 'a measured defect',
  fix = 'the one change proposed',
  open,
  suggested,
  answer,
}: ItemFixture): string {
  const lines = [
    `### ${label}. ${title}`,
    '',
    '- **Worth it:** yes, it is cheap',
  ]

  if (problem !== null) lines.splice(2, 0, `- **Problem:** ${problem}`)
  if (fix !== null)
    lines.splice(problem === null ? 2 : 3, 0, `- **Fix:** ${fix}`)

  if (open) lines.push(`- **Open:** ${open}`)
  if (suggested) lines.push(`- **Suggested:** ${suggested}`)

  lines.push(answer ? `- **You:** ${answer}` : '- **You:**', '')

  return lines.join('\n')
}

function cluster(...bodies: readonly string[]): string {
  return [
    '---',
    'title: A cluster',
    'description: One line naming what it holds',
    '---',
    '',
    '# A cluster',
    '',
    ...bodies,
  ].join('\n')
}

describe('readItems', () => {
  it('should read the label and title off each item heading', () => {
    const text = cluster(
      item({ label: '1' }),
      item({ label: '2', title: 'Another' }),
    )

    const items = readItems(text)

    expect(items.map((entry) => [entry.label, entry.title])).toEqual([
      ['1', 'Something is wrong'],
      ['2', 'Another'],
    ])
  })

  it('should read an item whose label carries a letter suffix', () => {
    const text = cluster(
      item({ label: '3' }),
      item({ label: '3a', title: 'Split out of item 3' }),
      item({ label: '3b', title: 'Split out of item 3' }),
    )

    const items = readItems(text)

    expect(items.map((entry) => entry.label)).toEqual(['3', '3a', '3b'])
  })

  it('should report an empty answer slot as unread', () => {
    const items = readItems(cluster(item({ label: '1' })))

    expect(items[0].answer).toBeUndefined()
    expect(isUnread(items[0])).toBe(true)
  })

  it('should report a filled answer slot as read', () => {
    const items = readItems(cluster(item({ label: '1', answer: 'ok' })))

    expect(items[0].answer).toBe('ok')
    expect(isUnread(items[0])).toBe(false)
  })

  it('should carry the open question and its suggestion', () => {
    const items = readItems(
      cluster(
        item({
          label: '1',
          open: 'ship now or later?',
          suggested: 'later, it is cheap',
        }),
      ),
    )

    expect(items[0].open).toBe('ship now or later?')
    expect(items[0].suggested).toBe('later, it is cheap')
  })

  it('should carry the problem and fix whole, past a colon, a code span, and a quote', () => {
    const problem =
      'hook `scratch-guard.sh` fails open: a crash lets "any" write through'
    const fix = 'set `onFailure: "block"` on it'

    const [target] = readItems(cluster(item({ label: '1', problem, fix })))

    expect(target.problem).toBe(problem)
    expect(target.fix).toBe(fix)
  })

  it('should leave problem and fix absent on an item lacking either line', () => {
    const [target] = readItems(
      cluster(item({ label: '1', problem: null, fix: null })),
    )

    expect(target.problem).toBeUndefined()
    expect(target.fix).toBeUndefined()
    expect(isUnread(target)).toBe(true)
  })

  it('should ignore an item displayed inside a fenced sample', () => {
    const text = cluster(
      '## Item format',
      '',
      '```markdown',
      item({ label: '9', title: 'Short title stating the defect' }),
      '```',
      '',
      '## Items',
      '',
      item({ label: '1' }),
    )

    const items = readItems(text)

    expect(items.map((entry) => entry.label)).toEqual(['1'])
  })

  it('should end an item at a heading that is not itself an item', () => {
    const text = cluster(
      item({ label: '1' }),
      '### Notes',
      '',
      '- **You:** stray text',
    )

    const [target] = readItems(text)

    expect(target.answer).toBeUndefined()
    expect(isUnread(target)).toBe(true)
  })

  it('should report an item carrying no answer slot as malformed', () => {
    const text = cluster(
      ['### 1. No slot at all', '', '- **Problem:** a defect', ''].join('\n'),
    )

    const [target] = readItems(text)

    expect(isMalformed(target)).toBe(true)
    expect(isUnread(target)).toBe(false)
  })

  it('should end an item at the next section heading', () => {
    const text = cluster(
      item({ label: '1' }),
      '## Notes',
      '',
      '- **You:** stray',
    )

    const items = readItems(text)

    expect(items).toHaveLength(1)
    expect(items[0].answer).toBeUndefined()
  })
})

describe('writeAnswerLine', () => {
  it('should replace the slot line and leave every other line as it was', () => {
    const text = cluster(item({ label: '1' }))
    const [target] = readItems(text)

    const written = writeAnswerLine(text, target.answerLine ?? 0, 'ok')

    expect(written.split('\n')).toHaveLength(text.split('\n').length)
    expect(readItems(written)[0].answer).toBe('ok')
  })

  it('should keep an answer carrying an ampersand verbatim', () => {
    const text = cluster(item({ label: '1' }))
    const [target] = readItems(text)

    const written = writeAnswerLine(text, target.answerLine ?? 0, 'ship A & B')

    expect(readItems(written)[0].answer).toBe('ship A & B')
  })

  it('should leave a sibling item untouched', () => {
    const text = cluster(item({ label: '1' }), item({ label: '2' }))
    const [first] = readItems(text)

    const written = writeAnswerLine(text, first.answerLine ?? 0, 'ok')
    const items = readItems(written)

    expect(items[0].answer).toBe('ok')
    expect(items[1].answer).toBeUndefined()
  })
})
