import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  defineTerms,
  listWorkspaces,
  openWorkspace,
  readRevisits,
  readWorkspace,
  recordSources,
  teachDir,
  writeStylesheet,
} from '@/teach/workspace'

let ROOT: string

const REQUEST = {
  topic: 'regular-expressions',
  subject: 'Reading and writing regular expressions',
  startingPoint: 'Comfortable with the shell, has never written a group',
  success: ['Write a pattern matching a date'],
  outOfScope: [],
  date: '2026-08-19',
}

function workspaceDir(slug: string): string {
  return join(teachDir(ROOT), slug)
}

async function seed(slug: string, files: Record<string, string>) {
  const dir = workspaceDir(slug)
  mkdirSync(dir, { recursive: true })

  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(dir, name), text)
  }

  return dir
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-teach-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('teachDir', () => {
  it('wraps an ordinary root in the record-root resolver', () => {
    expect(teachDir(ROOT)).toBe(join(ROOT, '.canon', 'teach'))
  })

  it('takes a root already named teach as the teach folder itself', () => {
    const direct = join(ROOT, 'examples', 'teach')

    expect(teachDir(direct)).toBe(direct)
  })
})

describe('listWorkspaces', () => {
  it('refuses a root carrying no teach folder', async () => {
    const outcome = await listWorkspaces(ROOT)

    expect(outcome).toMatchObject({ ok: false, reason: 'no-teach' })
  })

  it('reports the ordinal a new workspace would take', async () => {
    await openWorkspace(ROOT, REQUEST)

    expect(await listWorkspaces(ROOT)).toMatchObject({ ok: true, next: '02' })
  })

  it('starts the ordinal at 01 on an empty folder', async () => {
    mkdirSync(teachDir(ROOT), { recursive: true })

    expect(await listWorkspaces(ROOT)).toMatchObject({
      ok: true,
      next: '01',
      workspaces: [],
    })
  })

  it('counts what each workspace holds', async () => {
    await openWorkspace(ROOT, REQUEST)
    const dir = workspaceDir('01-regular-expressions')
    mkdirSync(join(dir, 'lessons'), { recursive: true })
    mkdirSync(join(dir, 'learning-records'), { recursive: true })
    await writeFile(join(dir, 'lessons', '0001-anchors.html'), '<p>one</p>')
    await writeFile(join(dir, 'learning-records', '0001-first.md'), '# One')

    const outcome = await listWorkspaces(ROOT)

    expect(outcome).toMatchObject({
      ok: true,
      workspaces: [{ slug: '01-regular-expressions', lessons: 1, records: 1 }],
    })
  })

  it('sorts by ordinal and puts a malformed name last', async () => {
    await seed('later', { 'MISSION.md': '# Later' })
    await seed('02-second', { 'MISSION.md': '# Second' })
    await seed('01-first', { 'MISSION.md': '# First' })

    const outcome = await listWorkspaces(ROOT)

    expect(outcome.ok && outcome.workspaces.map((one) => one.slug)).toEqual([
      '01-first',
      '02-second',
      'later',
    ])
  })

  it('lets a malformed name move no ordinal', async () => {
    await seed('later', { 'MISSION.md': '# Later' })

    expect(await listWorkspaces(ROOT)).toMatchObject({ ok: true, next: '01' })
  })

  it('names every required file a workspace does not carry', async () => {
    await seed('01-first', { 'MISSION.md': '# First' })

    const outcome = await listWorkspaces(ROOT)

    expect(outcome.ok && outcome.workspaces[0].missing).toEqual([
      'RESOURCES.md',
      'GLOSSARY.md',
    ])
  })
})

describe('readWorkspace', () => {
  it('matches on the topic behind the ordinal', async () => {
    await openWorkspace(ROOT, REQUEST)

    expect(await readWorkspace(ROOT, 'regular-expressions')).toMatchObject({
      ok: true,
      workspace: { slug: '01-regular-expressions' },
    })
  })

  it('matches on the folder name', async () => {
    await openWorkspace(ROOT, REQUEST)

    expect(await readWorkspace(ROOT, '01-regular-expressions')).toMatchObject({
      ok: true,
      workspace: { topic: 'regular-expressions' },
    })
  })

  it('refuses a topic no workspace covers', async () => {
    await openWorkspace(ROOT, REQUEST)

    expect(await readWorkspace(ROOT, 'pointers')).toMatchObject({
      ok: false,
      reason: 'no-workspace',
    })
  })

  it('refuses a topic two workspaces claim', async () => {
    await seed('01-pointers', { 'MISSION.md': '# One' })
    await seed('02-pointers', { 'MISSION.md': '# Two' })

    expect(await readWorkspace(ROOT, 'pointers')).toMatchObject({
      ok: false,
      reason: 'ambiguous',
    })
  })
})

describe('openWorkspace', () => {
  it('writes all three required files at the next ordinal', async () => {
    const outcome = await openWorkspace(ROOT, REQUEST)

    expect(outcome).toMatchObject({ ok: true, slug: '01-regular-expressions' })
    expect(outcome.ok && outcome.created).toHaveLength(3)
  })

  it('dates the mission and states the success lines', async () => {
    await openWorkspace(ROOT, {
      ...REQUEST,
      success: ['Write a pattern matching a date', 'Explain a backreference'],
    })

    const mission = await readFile(
      join(workspaceDir('01-regular-expressions'), 'MISSION.md'),
      'utf8',
    )

    expect(mission).toContain('date: 2026-08-19')
    expect(mission).toContain('## Success looks like')
    expect(mission).toContain('- Explain a backreference')
  })

  it('carries an out-of-scope section when the caller names none', async () => {
    await openWorkspace(ROOT, REQUEST)

    const mission = await readFile(
      join(workspaceDir('01-regular-expressions'), 'MISSION.md'),
      'utf8',
    )

    expect(mission).toContain('## Out of scope')
  })

  it('takes the ordinal past the highest already present', async () => {
    await seed('07-pointers', { 'MISSION.md': '# Pointers' })

    expect(await openWorkspace(ROOT, REQUEST)).toMatchObject({
      ok: true,
      slug: '08-regular-expressions',
    })
  })

  it('refuses a topic another workspace already covers', async () => {
    await openWorkspace(ROOT, REQUEST)

    expect(await openWorkspace(ROOT, REQUEST)).toMatchObject({
      ok: false,
      reason: 'exists',
    })
  })

  it('refuses a topic that is not a kebab slug', async () => {
    expect(
      await openWorkspace(ROOT, { ...REQUEST, topic: 'Regular Expressions' }),
    ).toMatchObject({ ok: false, reason: 'bad-input' })
  })

  it('refuses a mission carrying no success line', async () => {
    expect(
      await openWorkspace(ROOT, { ...REQUEST, success: [] }),
    ).toMatchObject({ ok: false, reason: 'bad-input' })
  })

  it('titles the workspace from the topic when none is given', async () => {
    await openWorkspace(ROOT, REQUEST)

    const mission = await readFile(
      join(workspaceDir('01-regular-expressions'), 'MISSION.md'),
      'utf8',
    )

    expect(mission).toContain('title: Regular expressions')
  })
})

describe('recordSources', () => {
  it('writes a read source under the read heading', async () => {
    await openWorkspace(ROOT, REQUEST)

    const outcome = await recordSources(
      ROOT,
      'regular-expressions',
      [{ title: 'MDN', url: 'https://example.test/a?x=1' }],
      [],
    )

    expect(outcome).toMatchObject({ ok: true })

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'RESOURCES.md'),
      'utf8',
    )

    expect(text).toContain('## Read\n\n- [MDN](https://example.test/a?x=1)')
    expect(text).toContain('## Leads\n\n- None yet.')
  })

  it('writes a lead under the leads heading', async () => {
    await openWorkspace(ROOT, REQUEST)
    await recordSources(
      ROOT,
      'regular-expressions',
      [],
      [{ title: 'RE2', url: 'https://example.test/b' }],
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'RESOURCES.md'),
      'utf8',
    )

    expect(text).toContain('## Leads\n\n- [RE2](https://example.test/b)')
    expect(text).toContain('## Read\n\n- None yet.')
  })

  it('keeps both sources when one call carries each kind', async () => {
    await openWorkspace(ROOT, REQUEST)
    await recordSources(
      ROOT,
      'regular-expressions',
      [{ title: 'MDN', url: 'https://example.test/a' }],
      [{ title: 'RE2', url: 'https://example.test/b' }],
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'RESOURCES.md'),
      'utf8',
    )

    expect(text).toContain('- [MDN](https://example.test/a)')
    expect(text).toContain('- [RE2](https://example.test/b)')
  })

  it('appends beside a source already listed', async () => {
    await openWorkspace(ROOT, REQUEST)
    await recordSources(
      ROOT,
      'regular-expressions',
      [{ title: 'MDN', url: 'https://example.test/a' }],
      [],
    )
    await recordSources(
      ROOT,
      'regular-expressions',
      [{ title: 'POSIX', url: 'https://example.test/c' }],
      [],
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'RESOURCES.md'),
      'utf8',
    )

    expect(text).toContain(
      '- [MDN](https://example.test/a)\n- [POSIX](https://example.test/c)',
    )
  })

  it('refuses a url either heading already lists', async () => {
    await openWorkspace(ROOT, REQUEST)
    await recordSources(
      ROOT,
      'regular-expressions',
      [{ title: 'MDN', url: 'https://example.test/a' }],
      [],
    )

    expect(
      await recordSources(
        ROOT,
        'regular-expressions',
        [],
        [{ title: 'MDN again', url: 'https://example.test/a' }],
      ),
    ).toMatchObject({ ok: false, reason: 'listed' })
  })

  it('refuses a workspace carrying no resources file', async () => {
    await seed('01-pointers', { 'MISSION.md': '# Pointers' })

    expect(
      await recordSources(
        ROOT,
        'pointers',
        [{ title: 'A', url: 'https://example.test/a' }],
        [],
      ),
    ).toMatchObject({ ok: false, reason: 'no-file' })
  })

  it('leaves a url quoted inside a fence out of the duplicate test', async () => {
    await openWorkspace(ROOT, REQUEST)
    const path = join(workspaceDir('01-regular-expressions'), 'RESOURCES.md')
    const text = await readFile(path, 'utf8')
    await writeFile(
      path,
      `${text}\n\`\`\`markdown\n- [MDN](https://example.test/a)\n\`\`\`\n`,
    )

    expect(
      await recordSources(
        ROOT,
        'regular-expressions',
        [{ title: 'MDN', url: 'https://example.test/a' }],
        [],
      ),
    ).toMatchObject({ ok: true })
  })
})

describe('defineTerms', () => {
  it('replaces the placeholder with the first entry', async () => {
    await openWorkspace(ROOT, REQUEST)
    await defineTerms(
      ROOT,
      'regular-expressions',
      [{ term: 'anchor', definition: 'A zero-width position assertion' }],
      undefined,
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text).toContain('- **anchor**: A zero-width position assertion.')
    expect(text).not.toContain('- None yet.')
  })

  it('terminates a definition before naming where it was first seen', async () => {
    await openWorkspace(ROOT, REQUEST)
    await defineTerms(
      ROOT,
      'regular-expressions',
      [{ term: 'anchor', definition: 'A zero-width position assertion' }],
      '0001-anchors.html',
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text).toContain('assertion. First seen in 0001-anchors.html.')
  })

  it('leaves a definition that already ends in a full stop alone', async () => {
    await openWorkspace(ROOT, REQUEST)
    await defineTerms(
      ROOT,
      'regular-expressions',
      [{ term: 'anchor', definition: 'A zero-width position assertion.' }],
      undefined,
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text).not.toContain('assertion..')
  })

  it('names where a term is first seen when the caller gives one', async () => {
    await openWorkspace(ROOT, REQUEST)
    await defineTerms(
      ROOT,
      'regular-expressions',
      [{ term: 'anchor', definition: 'A zero-width position assertion' }],
      '0001-anchors.html',
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text).toContain('First seen in 0001-anchors.html.')
  })

  it('keeps the entries alphabetical across calls', async () => {
    await openWorkspace(ROOT, REQUEST)
    await defineTerms(
      ROOT,
      'regular-expressions',
      [{ term: 'quantifier', definition: 'How many times to match' }],
      undefined,
    )
    await defineTerms(
      ROOT,
      'regular-expressions',
      [{ term: 'anchor', definition: 'A zero-width position assertion' }],
      undefined,
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text.indexOf('**anchor**')).toBeLessThan(
      text.indexOf('**quantifier**'),
    )
  })

  it('refuses a term the glossary already defines', async () => {
    await openWorkspace(ROOT, REQUEST)
    await defineTerms(
      ROOT,
      'regular-expressions',
      [{ term: 'anchor', definition: 'A zero-width position assertion' }],
      undefined,
    )

    expect(
      await defineTerms(
        ROOT,
        'regular-expressions',
        [{ term: 'Anchor', definition: 'Something else' }],
        undefined,
      ),
    ).toMatchObject({ ok: false, reason: 'defined' })
  })

  it('writes nothing when one term of a batch is already defined', async () => {
    await openWorkspace(ROOT, REQUEST)
    await defineTerms(
      ROOT,
      'regular-expressions',
      [{ term: 'anchor', definition: 'A zero-width position assertion' }],
      undefined,
    )

    await defineTerms(
      ROOT,
      'regular-expressions',
      [
        { term: 'anchor', definition: 'A repeat' },
        { term: 'quantifier', definition: 'How many times to match' },
      ],
      undefined,
    )

    const text = await readFile(
      join(workspaceDir('01-regular-expressions'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text).not.toContain('**quantifier**')
  })

  it('keeps the continuation lines of an entry wrapped at the margin', async () => {
    await seed('01-pointers', {
      'GLOSSARY.md': [
        '---',
        'title: Glossary',
        'description: Terms',
        '---',
        '',
        '# Glossary',
        '',
        '- **stack**: memory whose lifetime is the call that claimed it.',
        '  First seen in `0001-memory`.',
        '',
      ].join('\n'),
    })

    await defineTerms(
      ROOT,
      'pointers',
      [{ term: 'arena', definition: 'A region freed in one call' }],
      undefined,
    )

    const text = await readFile(
      join(workspaceDir('01-pointers'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text).toContain('  First seen in `0001-memory`.')
    expect(text.indexOf('**arena**')).toBeLessThan(text.indexOf('**stack**'))
  })

  it('leaves a paragraph written under the list outside it', async () => {
    await seed('01-pointers', {
      'GLOSSARY.md': [
        '---',
        'title: Glossary',
        'description: Terms',
        '---',
        '',
        '# Glossary',
        '',
        '- **stack**: memory whose lifetime is the call that claimed it.',
        '',
        'Every entry above is defined without using the term.',
        '',
      ].join('\n'),
    })

    await defineTerms(
      ROOT,
      'pointers',
      [{ term: 'arena', definition: 'A region freed in one call' }],
      undefined,
    )

    const text = await readFile(
      join(workspaceDir('01-pointers'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text.indexOf('**stack**')).toBeLessThan(
      text.indexOf('Every entry above'),
    )
  })

  it('appends to a glossary carrying no bullet list', async () => {
    await seed('01-pointers', {
      'GLOSSARY.md': '---\ntitle: Glossary\ndescription: Terms\n---\n\n# G\n',
    })

    await defineTerms(
      ROOT,
      'pointers',
      [{ term: 'arena', definition: 'A region freed in one call' }],
      undefined,
    )

    const text = await readFile(
      join(workspaceDir('01-pointers'), 'GLOSSARY.md'),
      'utf8',
    )

    expect(text).toContain('- **arena**: A region freed in one call')
  })

  it('reports every term counted by a listing', async () => {
    await openWorkspace(ROOT, REQUEST)
    await defineTerms(
      ROOT,
      'regular-expressions',
      [
        { term: 'anchor', definition: 'A zero-width position assertion' },
        { term: 'quantifier', definition: 'How many times to match' },
      ],
      undefined,
    )

    expect(await readWorkspace(ROOT, 'regular-expressions')).toMatchObject({
      ok: true,
      workspace: { terms: 2 },
    })
  })
})

describe('writeStylesheet', () => {
  it('refuses a topic no workspace carries', async () => {
    mkdirSync(teachDir(ROOT), { recursive: true })

    const outcome = await writeStylesheet(ROOT, 'nothing-here')

    expect(outcome.ok).toBe(false)
  })

  it('seeds the base file from the design source rather than from a hand copy', async () => {
    await seed('01-regular-expressions', { 'MISSION.md': '# Mission\n' })

    const outcome = await writeStylesheet(ROOT, 'regular-expressions')
    if (!outcome.ok) throw new Error(outcome.message)

    const body = await readFile(join(ROOT, outcome.basePath), 'utf8')

    expect(outcome.written).toBe(true)
    expect(body).toContain('--color-accent: #c76b5f;')
    expect(body).toContain('.status::before')
    expect(body).toContain('@font-face')
    expect(body).toContain('base64,')
  })

  it('carries the teach chrome, not just the generic tokens and components', async () => {
    await seed('01-regular-expressions', { 'MISSION.md': '# Mission\n' })

    const outcome = await writeStylesheet(ROOT, 'regular-expressions')
    if (!outcome.ok) throw new Error(outcome.message)

    const body = await readFile(join(ROOT, outcome.basePath), 'utf8')

    expect(body).toContain('.bar {')
    expect(body).toContain('.quiz')
    expect(body).toContain('.theme:hover { border-color: var(--color-accent)')
    expect(body).toContain("font-family: 'Nunito';")
    expect(body).toContain("font-family: 'Virgil';")
    expect(body).toContain("font-family: 'Cascadia Code';")
  })

  it('aliases the retired palette so an already-written lesson diagram still resolves its fill and stroke', async () => {
    await seed('01-regular-expressions', { 'MISSION.md': '# Mission\n' })

    const outcome = await writeStylesheet(ROOT, 'regular-expressions')
    if (!outcome.ok) throw new Error(outcome.message)

    const body = await readFile(join(ROOT, outcome.basePath), 'utf8')

    for (const retired of [
      '--panel',
      '--rule',
      '--ink',
      '--ink-soft',
      '--ink-faint',
      '--accent',
      '--accent-bg',
    ]) {
      expect(body).toContain(`${retired}: var(`)
    }
  })

  it('imports the base file from the workspace-owned stylesheet on first write', async () => {
    await seed('01-regular-expressions', { 'MISSION.md': '# Mission\n' })

    const outcome = await writeStylesheet(ROOT, 'regular-expressions')
    if (!outcome.ok) throw new Error(outcome.message)

    expect(await readFile(join(ROOT, outcome.path), 'utf8')).toBe(
      "@import url('./base.css');\n",
    )
  })

  it('leaves a workspace-owned stylesheet alone, since lessons add to it', async () => {
    await seed('01-regular-expressions', { 'MISSION.md': '# Mission\n' })
    const first = await writeStylesheet(ROOT, 'regular-expressions')
    if (!first.ok) throw new Error(first.message)

    await writeFile(
      join(ROOT, first.path),
      "@import url('./base.css');\n\n.lesson { color: red }\n",
    )
    const second = await writeStylesheet(ROOT, 'regular-expressions')
    if (!second.ok) throw new Error(second.message)

    expect(second.written).toBe(false)
    expect(await readFile(join(ROOT, second.path), 'utf8')).toBe(
      "@import url('./base.css');\n\n.lesson { color: red }\n",
    )
  })

  it('resyncs the base file even when the workspace-owned stylesheet is left alone', async () => {
    await seed('01-regular-expressions', { 'MISSION.md': '# Mission\n' })
    const first = await writeStylesheet(ROOT, 'regular-expressions')
    if (!first.ok) throw new Error(first.message)

    await writeFile(join(ROOT, first.basePath), '/* stale */\n')
    const second = await writeStylesheet(ROOT, 'regular-expressions')
    if (!second.ok) throw new Error(second.message)

    expect(second.written).toBe(false)
    expect(await readFile(join(ROOT, second.basePath), 'utf8')).toContain(
      '--color-accent:',
    )
  })

  it('takes the seed back over an existing workspace-owned stylesheet when forced', async () => {
    await seed('01-regular-expressions', { 'MISSION.md': '# Mission\n' })
    const first = await writeStylesheet(ROOT, 'regular-expressions')
    if (!first.ok) throw new Error(first.message)

    await writeFile(join(ROOT, first.path), '.lesson { color: red }\n')
    const forced = await writeStylesheet(ROOT, 'regular-expressions', true)
    if (!forced.ok) throw new Error(forced.message)

    expect(forced.written).toBe(true)
    expect(await readFile(join(ROOT, forced.path), 'utf8')).toBe(
      "@import url('./base.css');\n",
    )
  })

  it('creates the assets folder a workspace opened without one lacks', async () => {
    const dir = await seed('01-regular-expressions', {
      'MISSION.md': '# Mission\n',
    })

    expect(existsSync(join(dir, 'assets'))).toBe(false)

    const outcome = await writeStylesheet(ROOT, 'regular-expressions')

    expect(outcome.ok).toBe(true)
    expect(existsSync(join(dir, 'assets'))).toBe(true)
  })
})

describe('readRevisits', () => {
  function record(file: string, ...entries: string[]) {
    return {
      file,
      text: ['# Session', '', '## Revisit', '', ...entries, ''].join('\n'),
    }
  }

  it('lets a later record supersede an earlier schedule for one item', () => {
    const items = readRevisits(
      [
        record(
          '0001-anchors.md',
          '- **Lazy quantifiers**: due 2026-09-01, rung 1',
        ),
        record(
          '0002-groups.md',
          '- **Lazy quantifiers**: due 2026-09-20, rung 3',
        ),
      ],
      '2026-09-04',
    )

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      item: 'Lazy quantifiers',
      date: '2026-09-20',
      rung: 3,
      record: '0002-groups.md',
    })
  })

  it('supersedes across a spelling the later record capitalized differently', () => {
    const items = readRevisits(
      [
        record(
          '0001-anchors.md',
          '- **Lazy quantifiers**: due 2026-09-01, rung 1',
        ),
        record(
          '0002-groups.md',
          '- **lazy quantifiers**: due 2026-09-20, rung 2',
        ),
      ],
      '2026-09-04',
    )

    expect(items).toHaveLength(1)
    expect(items[0].rung).toBe(2)
  })

  it('reads an item due today and one already past as overdue', () => {
    const items = readRevisits(
      [
        record(
          '0001-anchors.md',
          '- **Anchors**: due 2026-09-04, rung 2',
          '- **Backreferences**: due 2026-08-30, rung 1',
        ),
      ],
      '2026-09-04',
    )

    expect(items.map((item) => [item.item, item.overdue])).toEqual([
      ['Backreferences', true],
      ['Anchors', true],
    ])
  })

  it('reports an item dated ahead without marking it overdue', () => {
    const items = readRevisits(
      [record('0001-anchors.md', '- **Anchors**: due 2026-09-11, rung 3')],
      '2026-09-04',
    )

    expect(items[0].overdue).toBe(false)
  })

  it('reads nothing from a record carrying no revisit section', () => {
    expect(
      readRevisits(
        [
          {
            file: '0001-anchors.md',
            text: '# Session\n\nNothing scheduled.\n',
          },
        ],
        '2026-09-04',
      ),
    ).toEqual([])
  })

  it('widens the gap on a hit and narrows it on a miss', () => {
    const items = readRevisits(
      [record('0001-anchors.md', '- **Anchors**: due 2026-09-04, rung 2')],
      '2026-09-04',
    )

    expect(items[0].hit).toBe('2026-09-11')
    expect(items[0].miss).toBe('2026-09-05')
  })

  it('holds both ladder dates inside the ladder at either end', () => {
    const [bottom] = readRevisits(
      [record('0001-anchors.md', '- **Anchors**: due 2026-09-04, rung 1')],
      '2026-09-04',
    )
    const [top] = readRevisits(
      [record('0001-anchors.md', '- **Anchors**: due 2026-09-04, rung 5')],
      '2026-09-04',
    )

    expect([bottom.miss, bottom.hit]).toEqual(['2026-09-05', '2026-09-07'])
    expect([top.miss, top.hit]).toEqual(['2026-09-20', '2026-10-09'])
  })

  it('skips an entry carrying no date, which schedules nothing', () => {
    expect(
      readRevisits(
        [record('0001-anchors.md', '- **Anchors**: soon, rung 2')],
        '2026-09-04',
      ),
    ).toEqual([])
  })

  it('skips a date naming no real day rather than throwing on it', () => {
    expect(
      readRevisits(
        [record('0001-anchors.md', '- **Anchors**: due 2026-13-45, rung 2')],
        '2026-09-04',
      ),
    ).toEqual([])
  })

  it('keeps a well-formed entry beside one carrying an impossible date', () => {
    const items = readRevisits(
      [
        record(
          '0001-anchors.md',
          '- **Anchors**: due 2026-13-45, rung 2',
          '- **Backreferences**: due 2026-09-02, rung 1',
        ),
      ],
      '2026-09-04',
    )

    expect(items.map((item) => item.item)).toEqual(['Backreferences'])
  })

  it('carries the schedule onto the workspace a listing reports', async () => {
    await seed('01-regular-expressions', { 'MISSION.md': '# Mission\n' })
    mkdirSync(
      join(workspaceDir('01-regular-expressions'), 'learning-records'),
      {
        recursive: true,
      },
    )
    await writeFile(
      join(
        workspaceDir('01-regular-expressions'),
        'learning-records',
        '0001-anchors.md',
      ),
      '# Session\n\n## Revisit\n\n- **Anchors**: due 2026-09-11, rung 3\n',
    )

    const outcome = await readWorkspace(ROOT, 'regular-expressions')

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.workspace.due).toHaveLength(1)
    expect(outcome.workspace.due[0].item).toBe('Anchors')
  })
})
