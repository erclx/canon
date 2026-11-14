import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  answerItems,
  intakeDir,
  listFolders,
  readFolder,
} from '@/intake/folder'
import { readItems } from '@/intake/items'

let ROOT: string

interface ItemFixture {
  readonly label: string
  readonly open?: string
  readonly answer?: string
}

function item({ label, open, answer }: ItemFixture): string {
  const lines = [
    `### ${label}. Item ${label}`,
    '',
    '- **Problem:** a measured defect',
    '- **Fix:** the one change proposed',
    '- **Worth it:** yes',
  ]

  if (open) lines.push(`- **Open:** ${open}`)
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

async function seedFolder(
  slug: string,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const folder = join(intakeDir(ROOT), slug)
  mkdirSync(folder, { recursive: true })

  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(folder, name), body)
  }

  return folder
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-intake-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('listFolders', () => {
  it('should refuse when the project holds no intake', async () => {
    const outcome = await listFolders(ROOT)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('no-intake')
  })

  it('should count items, open questions, and unread slots per folder', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(
        item({ label: '1', open: 'which way?' }),
        item({ label: '2', answer: 'ok' }),
      ),
    })

    const outcome = await listFolders(ROOT)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.folders).toEqual([
      { slug: 'a-dump', items: 2, open: 1, unread: 1, malformed: 0 },
    ])
  })

  it('should count an item carrying no answer slot apart from unread', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(
        ['### 1. No slot at all', '', '- **Problem:** a defect', ''].join('\n'),
        item({ label: '2', answer: 'ok' }),
      ),
    })

    const outcome = await listFolders(ROOT)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.folders).toEqual([
      { slug: 'a-dump', items: 2, open: 0, unread: 0, malformed: 1 },
    ])
  })

  it('should skip the index when counting items', async () => {
    await seedFolder('a-dump', {
      '00-overview.md': cluster(item({ label: '1' })),
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await listFolders(ROOT)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.folders[0].items).toBe(1)
  })
})

describe('readFolder', () => {
  it('should refuse an unknown folder and name the ones that exist', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await readFolder(ROOT, 'missing')

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-folder')
    expect(outcome.detail).toEqual(['a-dump'])
  })

  it('should refuse a bare slug matching two ordinal-prefixed folders as ambiguous rather than missing', async () => {
    await seedFolder('03-a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })
    await seedFolder('07-a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await readFolder(ROOT, 'a-dump')

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('ambiguous-slug')
    expect(outcome.detail).toEqual(['03-a-dump', '07-a-dump'])
  })

  it('should resolve a bare slug against a folder carrying an ordinal', async () => {
    await seedFolder('07-a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await readFolder(ROOT, 'a-dump')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.clusters).toHaveLength(1)
  })

  it('should group items by the cluster holding them', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
      '02-other.md': cluster(item({ label: '1' }), item({ label: '2' })),
    })

    const outcome = await readFolder(ROOT, 'a-dump')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(
      outcome.clusters.map((entry) => [entry.cluster, entry.items.length]),
    ).toEqual([
      ['01-domain.md', 1],
      ['02-other.md', 2],
    ])
  })
})

describe('answerItems', () => {
  it('should land a selection in the slot it names', async () => {
    const folder = await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' }), item({ label: '2' })),
    })

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '2', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(true)
    const items = readItems(
      await readFile(join(folder, '01-domain.md'), 'utf8'),
    )
    expect(items[0].answer).toBeUndefined()
    expect(items[1].answer).toBe('ok')
  })

  it('should land a whole batch in one write', async () => {
    const folder = await seedFolder('a-dump', {
      '01-domain.md': cluster(
        item({ label: '1' }),
        item({ label: '2' }),
        item({ label: '3' }),
      ),
    })

    await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '1', answer: 'ok' },
      { label: '3', answer: 'not worth it' },
    ])

    const items = readItems(
      await readFile(join(folder, '01-domain.md'), 'utf8'),
    )
    expect(items.map((entry) => entry.answer)).toEqual([
      'ok',
      undefined,
      'not worth it',
    ])
  })

  it('should land a selection on a label carrying a letter suffix', async () => {
    const folder = await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '3' }), item({ label: '3a' })),
    })

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '3a', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(true)
    const items = readItems(
      await readFile(join(folder, '01-domain.md'), 'utf8'),
    )
    expect(items[0].answer).toBeUndefined()
    expect(items[1].answer).toBe('ok')
  })

  it('should accept a cluster named without its extension', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain', [
      { label: '1', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(true)
  })

  it('should refuse an item that already carries an answer', async () => {
    const folder = await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1', answer: 'already decided' })),
    })
    const before = await readFile(join(folder, '01-domain.md'), 'utf8')

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '1', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('answered')
    expect(await readFile(join(folder, '01-domain.md'), 'utf8')).toBe(before)
  })

  it('should refuse the whole batch when one item is already answered', async () => {
    const folder = await seedFolder('a-dump', {
      '01-domain.md': cluster(
        item({ label: '1' }),
        item({ label: '2', answer: 'already decided' }),
      ),
    })
    const before = await readFile(join(folder, '01-domain.md'), 'utf8')

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '1', answer: 'ok' },
      { label: '2', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(false)
    expect(await readFile(join(folder, '01-domain.md'), 'utf8')).toBe(before)
  })

  it('should refuse an answer carrying a line break and leave the slot unread', async () => {
    const folder = await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })
    const before = await readFile(join(folder, '01-domain.md'), 'utf8')

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '1', answer: 'first line\nsecond line' },
    ])

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('bad-input')
    expect(outcome.detail).toEqual(['1'])
    expect(await readFile(join(folder, '01-domain.md'), 'utf8')).toBe(before)
  })

  it('should refuse an answer carrying a carriage return', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '1', answer: 'first\rsecond' },
    ])

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('bad-input')
  })

  it('should refuse the whole batch when one answer carries a line break', async () => {
    const folder = await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' }), item({ label: '2' })),
    })
    const before = await readFile(join(folder, '01-domain.md'), 'utf8')

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '1', answer: 'ok' },
      { label: '2', answer: 'first\nsecond' },
    ])

    expect(outcome.ok).toBe(false)
    expect(await readFile(join(folder, '01-domain.md'), 'utf8')).toBe(before)
  })

  it('should refuse an item carrying no answer slot', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(
        ['### 1. No slot at all', '', '- **Problem:** a defect', ''].join('\n'),
      ),
    })

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '1', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-item')
  })

  it('should refuse an item number the cluster does not carry', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await answerItems(ROOT, 'a-dump', '01-domain.md', [
      { label: '7', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-item')
  })

  it('should refuse a cluster the folder does not hold', async () => {
    await seedFolder('a-dump', {
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await answerItems(ROOT, 'a-dump', '09-missing.md', [
      { label: '1', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-cluster')
    expect(outcome.detail).toEqual(['01-domain.md'])
  })

  it('should refuse the index, which carries no answer slot', async () => {
    await seedFolder('a-dump', {
      '00-overview.md': cluster(item({ label: '1' })),
      '01-domain.md': cluster(item({ label: '1' })),
    })

    const outcome = await answerItems(ROOT, 'a-dump', '00-overview.md', [
      { label: '1', answer: 'ok' },
    ])

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-cluster')
  })
})

function decidedItem(label: string, pointer: string, answer?: string): string {
  return item({ label, answer }).replace(
    '- **You:**',
    `- **Decided:** ${pointer}\n- **You:**`,
  )
}

const DRIVE_LOG = [
  '# Drive log',
  '',
  '## 02. Layers click leaves a frame',
  '',
  '- **Decision (operator):** close the frame on click',
  '',
  '## 04. Layers click on a nested frame',
  '',
  '- **Decision (operator):** see 02',
  '',
  '## 05. Export to PNG',
  '',
  '- **Did:** exported the board',
].join('\n')

async function seedDrive(...items: readonly string[]): Promise<string> {
  const folder = await seedFolder('drive', {
    '01-layers.md': cluster(...items),
  })
  mkdirSync(join(folder, 'evidence'))
  await writeFile(join(folder, 'evidence', 'drive-log.md'), DRIVE_LOG)
  return folder
}

describe('Decided route', () => {
  it('should resolve each pointer into the decision it reaches on read', async () => {
    await seedDrive(
      decidedItem('1', 'evidence/drive-log.md, finding 2'),
      decidedItem('2', 'evidence/drive-log.md, finding 04'),
      item({ label: '3' }),
    )

    const outcome = await readFolder(ROOT, 'drive')

    if (!outcome.ok) throw new Error(outcome.message)
    expect(outcome.clusters[0].items.map((entry) => entry.decision)).toEqual([
      'close the frame on click',
      'close the frame on click',
      undefined,
    ])
  })

  it('should land the cited answer on every decided label', async () => {
    const folder = await seedDrive(
      decidedItem('1', 'evidence/drive-log.md, finding 2'),
      decidedItem('2', 'evidence/drive-log.md, finding 04'),
    )

    const outcome = await answerItems(
      ROOT,
      'drive',
      '01-layers.md',
      [],
      ['1', '2'],
    )

    expect(outcome.ok).toBe(true)
    const text = await readFile(join(folder, '01-layers.md'), 'utf8')
    expect(readItems(text).map((entry) => entry.answer)).toEqual([
      'ok, as decided in drive-log finding 02',
      'ok, as decided in drive-log finding 04',
    ])
  })

  it.each([
    ['an item with no Decided field', item({ label: '2' })],
    [
      'a finding carrying no decision',
      decidedItem('2', 'evidence/drive-log.md, finding 05'),
    ],
    [
      'a finding missing from the log',
      decidedItem('2', 'evidence/drive-log.md, finding 09'),
    ],
    [
      'a pointer at a path other than the folder log',
      decidedItem('2', 'notes/drive-log.md, finding 02'),
    ],
  ])('should refuse undecided for %s and write no slot', async (_, second) => {
    const folder = await seedDrive(
      decidedItem('1', 'evidence/drive-log.md, finding 2'),
      second,
    )
    const before = await readFile(join(folder, '01-layers.md'), 'utf8')

    const outcome = await answerItems(
      ROOT,
      'drive',
      '01-layers.md',
      [],
      ['1', '2'],
    )

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('undecided')
    expect(await readFile(join(folder, '01-layers.md'), 'utf8')).toBe(before)
  })

  it('should refuse undecided when the folder holds no drive log', async () => {
    await seedFolder('drive', {
      '01-layers.md': cluster(
        decidedItem('1', 'evidence/drive-log.md, finding 2'),
      ),
    })

    const outcome = await answerItems(ROOT, 'drive', '01-layers.md', [], ['1'])

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('undecided')
  })

  it('should refuse answered for a decided label whose slot is filled', async () => {
    await seedDrive(
      decidedItem('1', 'evidence/drive-log.md, finding 2', 'skip'),
    )

    const outcome = await answerItems(ROOT, 'drive', '01-layers.md', [], ['1'])

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toBe('answered')
  })
})
