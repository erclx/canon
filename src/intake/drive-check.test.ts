import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkDrive, readGoals, recordBaseline } from '@/intake/drive-check'
import { readDecisions, readDrawings, readDrawn } from '@/intake/drive-log'

let ROOT: string

const FOLDER = '.canon/intake/13-app-drive-1-0'

const REQUIREMENTS = [
  '# Requirements',
  '',
  '## Goals',
  '',
  '- **Boards.** A designer lays out frames on one board.',
  '- **Export.** A board exports to PNG.',
  '',
  '## Non-goals',
  '',
  '- Host boards for anyone.',
  '',
].join('\n')

function git(...args: string[]): void {
  execaSync('git', ['-C', ROOT, ...args], {
    env: {
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  })
}

function write(path: string, text: string): void {
  mkdirSync(dirname(join(ROOT, path)), { recursive: true })
  writeFileSync(join(ROOT, path), text)
}

function writeRecord(record: unknown): void {
  write(`${FOLDER}/drive.json`, JSON.stringify(record))
}

function writeLog(...findings: string[]): void {
  write(
    `${FOLDER}/evidence/drive-log.md`,
    ['# Drive log', ...findings].join('\n\n'),
  )
}

/** The log example `drive-record.md` carries, which the check must read clean. */
const REFERENCE_LOG = (() => {
  const reference = readFileSync(
    join(
      import.meta.dirname,
      '../../claude/skills/app-drive/references/drive-record.md',
    ),
    'utf8',
  )
  const block = /```markdown\n(# Drive log[\s\S]*?)```/.exec(reference)
  if (!block) throw new Error('drive-record.md carries no drive log example')
  return block[1]
})()

const BOTH_DRIVEN = [
  { goal: 'A designer lays out frames on one board', status: 'driven' },
  { goal: 'A board exports to PNG', status: 'driven' },
]

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-drive-check-'))
  git('init', '-q', '-b', 'main')
  write('.gitignore', '.canon/\n')
  write('canon/REQUIREMENTS.md', REQUIREMENTS)
  write('src/app.ts', 'export {}\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  mkdirSync(join(ROOT, FOLDER, 'evidence'), { recursive: true })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('readGoals', () => {
  it('should read each bullet under Goals with its bold label stripped', () => {
    expect(readGoals(REQUIREMENTS)).toEqual([
      'A designer lays out frames on one board',
      'A board exports to PNG',
    ])
  })

  it('should read bullets grouped under H3s inside Goals', () => {
    const source = [
      '## Goals',
      '',
      '### Editing',
      '',
      '- Frames snap to a grid.',
      '',
      '### Sharing',
      '',
      '- A board opens from a link.',
      '',
      '## Non-goals',
      '',
      '- Realtime cursors.',
    ].join('\n')

    expect(readGoals(source)).toEqual([
      'Frames snap to a grid',
      'A board opens from a link',
    ])
  })

  it('should join a wrapped bullet and skip its nested bullets', () => {
    const source = [
      '## Goals',
      '',
      '- A board exports',
      '  to PNG.',
      '  - at 2x scale',
    ].join('\n')

    expect(readGoals(source)).toEqual(['A board exports to PNG'])
  })

  it('should read no goals from a record without the section', () => {
    expect(readGoals('# Requirements\n\n## Constraints\n\n- Local.\n')).toEqual(
      [],
    )
  })
})

describe('readDrawn', () => {
  it('should read the reference example as drawn, citing its paths', () => {
    expect(readDrawn(REFERENCE_LOG)).toMatchObject({
      undrawn: [],
      paths: ['evidence/layers/02-options.png', 'evidence/mocks/layers/'],
    })
  })

  it('should list a decision whose finding carries no Drawn field', () => {
    const log = REFERENCE_LOG.replace(/^- \*\*Drawn:\*\*.*\n/m, '')

    expect(readDrawn(log).undrawn).toEqual([
      '02. Layers click leaves a half-hidden frame in place',
    ])
  })

  it('should read no path out of a skip reason that backticks a term', () => {
    const log = [
      '## 03. Export prints no record',
      '',
      '- **Drawn:** skipped, the fix changes only the `--json` record',
      '- **Decision (operator):** print the record on stdout',
    ].join('\n')

    expect(readDrawn(log)).toMatchObject({ undrawn: [], paths: [] })
  })

  it('should pass a skipped drawing that gives its reason', () => {
    const log = [
      '## 03. Export drops the alpha channel',
      '',
      '- **Drawn:** skipped, the fix changes no pixel the persona sees',
      '- **Decision (operator):** keep alpha in PNG export',
    ].join('\n')

    expect(readDrawn(log)).toMatchObject({ undrawn: [], paths: [] })
  })

  it('should list a bare skipped drawing as undrawn', () => {
    const log = [
      '## 03. Export drops the alpha channel',
      '',
      '- **Drawn:** skipped',
      '- **Decision (operator):** keep alpha in PNG export',
    ].join('\n')

    expect(readDrawn(log).undrawn).toEqual([
      '03. Export drops the alpha channel',
    ])
  })

  it('should pass a decision pointing back at the finding that drew it', () => {
    const log = [
      '## 04. Layers click on a nested frame',
      '',
      '- **Decision (operator):** see 02',
    ].join('\n')

    expect(readDrawn(log).undrawn).toEqual([])
  })

  it('should ignore a reference shot and a passed goal', () => {
    const log = [
      '## ref-01. The operator Figma panel',
      '',
      '- **Decision (operator):** match this panel',
      '',
      '## 05. Export to PNG',
      '',
      '`pass` · goal · designer',
      '',
      '- **Did:** exported the board',
    ].join('\n')

    expect(readDrawn(log).undrawn).toEqual([])
  })

  it('should pass a last-drive re-check marked fixed with no Drawn field', () => {
    const log = [
      '## 07. The export button sits below the fold',
      '',
      '`minor` · last-drive · developer · fixed',
      '',
      '- **Did:** re-drove finding 06 of the last drive',
    ].join('\n')

    expect(readDrawn(log).undrawn).toEqual([])
  })

  it('should list a last-drive re-check still open with no Drawn field', () => {
    const log = [
      '## 07. The export button sits below the fold',
      '',
      '`minor` · last-drive · developer · still open',
      '',
      '- **Did:** re-drove finding 06 of the last drive',
    ].join('\n')

    expect(readDrawn(log).undrawn).toEqual([
      '07. The export button sits below the fold',
    ])
  })

  it('should list an undecided finding that carries no Drawn field', () => {
    const log = [
      '## 06. Export button sits below the fold',
      '',
      '`minor` · goal · designer',
      '',
      '- **Saw:** the button starts at y 912 on a 900px viewport',
    ].join('\n')

    expect(readDrawn(log).undrawn).toEqual([
      '06. Export button sits below the fold',
    ])
  })

  it('should pass an undecided finding whose drawing cites a path', () => {
    const log = [
      '## 06. Export button sits below the fold',
      '',
      '`minor` · goal · designer',
      '',
      '- **Drawn:** `evidence/export/06-options.png`',
    ].join('\n')

    expect(readDrawn(log)).toMatchObject({
      undrawn: [],
      paths: ['evidence/export/06-options.png'],
    })
  })

  it('should list an undecided finding skipped with a reason as skipped', () => {
    const log = [
      '## 07. Export prints no record',
      '',
      '`minor` · script · developer',
      '',
      '- **Drawn:** skipped, the fix changes only the `--json` record',
    ].join('\n')

    expect(readDrawn(log)).toMatchObject({
      undrawn: [],
      paths: [],
      skipped: [{ finding: 7, heading: '07. Export prints no record' }],
    })
  })
})

describe('readDrawn board and skips', () => {
  it('should read a drive as drawing when the Board row holds a value', () => {
    expect(readDrawn(REFERENCE_LOG).board).toBe(true)
  })

  it('should read a drive as drawing when the Board row holds only a url', () => {
    const log =
      '| Setup | Value |\n| --- | --- |\n| Board | `http://127.0.0.1:4173` |'

    expect(readDrawn(log).board).toBe(true)
  })

  it('should read a drive as drawing no board when the Board row is empty', () => {
    const log =
      '| Setup | Value |\n| --- | --- |\n| Board |  |\n| In flight | none |'

    expect(readDrawn(log).board).toBe(false)
  })

  it('should read a drive with no Board row as drawing no board', () => {
    expect(readDrawn('# Drive log\n\n| Setup | Value |').board).toBe(false)
  })

  it('should list a finding whose drawing was skipped with a reason', () => {
    const log = [
      '## 03. Export drops the alpha channel',
      '',
      '- **Drawn:** skipped, the fix changes no pixel the persona sees',
      '- **Decision (operator):** keep alpha in PNG export',
    ].join('\n')

    expect(readDrawn(log).skipped).toEqual([
      { finding: 3, heading: '03. Export drops the alpha channel' },
    ])
  })

  it('should not list a finding that drew or one pointing at another', () => {
    const log = [
      REFERENCE_LOG,
      '## 04. Layers click on a nested frame',
      '',
      '- **Decision (operator):** see 02',
    ].join('\n')

    expect(readDrawn(log).skipped).toEqual([])
  })
})

describe('readDrawings', () => {
  it('should give a see finding the paths of the finding it names', () => {
    const log = [
      '## 02. Layers click leaves a frame',
      '',
      '- **Drawn:** `evidence/layers/02-options.png`',
      '- **Decision (operator):** close the frame on click',
      '',
      '## 04. Layers click on a nested frame',
      '',
      '- **Decision (operator):** see 02',
    ].join('\n')

    expect(readDrawings(log).get(4)).toEqual(['evidence/layers/02-options.png'])
  })

  it('should give a see finding its target paths past its own skip', () => {
    const log = [
      '## 02. The current tide marker sits under the day list',
      '',
      '- **Drawn:** `evidence/week/02-options.png`',
      '- **Decision (operator):** clamp the marker inside the chart',
      '',
      '## 03. The week chart scrolls sideways at the reflow floor',
      '',
      '- **Drawn:** skipped, the fix restores the layout the record states',
      '- **Decision (operator):** see 02',
    ].join('\n')

    expect(readDrawings(log).get(3)).toEqual(['evidence/week/02-options.png'])
  })
})

describe('readDecisions', () => {
  it('should map each finding number to its operator decision', () => {
    const log = [
      '## 02. Layers click leaves a frame',
      '',
      '- **Decision (operator):** close the frame on click',
      '',
      '## 03. Export drops alpha',
      '',
      '- **Decision (operator):** keep alpha in PNG export',
    ].join('\n')

    expect([...readDecisions(log)]).toEqual([
      [2, 'close the frame on click'],
      [3, 'keep alpha in PNG export'],
    ])
  })

  it('should follow a see hop to the decision it names', () => {
    const log = [
      '## 02. Layers click leaves a frame',
      '',
      '- **Decision (operator):** close the frame on click',
      '',
      '## 04. Layers click on a nested frame',
      '',
      '- **Decision (operator):** see 02',
    ].join('\n')

    expect(readDecisions(log).get(4)).toBe('close the frame on click')
  })

  it('should drop a see hop naming a missing finding', () => {
    const log = [
      '## 04. Layers click on a nested frame',
      '',
      '- **Decision (operator):** see 09',
    ].join('\n')

    expect(readDecisions(log).has(4)).toBe(false)
  })

  it('should drop a see hop landing on another see', () => {
    const log = [
      '## 02. First',
      '',
      '- **Decision (operator):** see 03',
      '',
      '## 03. Second',
      '',
      '- **Decision (operator):** see 02',
    ].join('\n')

    expect(readDecisions(log).size).toBe(0)
  })

  it('should map nothing for a finding with no decision or a ref heading', () => {
    const log = [
      '## ref-01. The operator Figma panel',
      '',
      '- **Decision (operator):** match this panel',
      '',
      '## 05. Export to PNG',
      '',
      '- **Did:** exported the board',
    ].join('\n')

    expect(readDecisions(log).size).toBe(0)
  })
})

describe('recordBaseline', () => {
  it('should store the status under scratch keyed by the bare slug', async () => {
    const outcome = await recordBaseline(ROOT, '13-app-drive-1-0')

    expect(outcome).toMatchObject({
      ok: true,
      slug: 'app-drive-1-0',
      path: join(ROOT, '.canon/tmp/app-drive/app-drive-1-0/baseline.json'),
    })
  })

  it('should refuse a slug that climbs out of scratch', async () => {
    expect(await recordBaseline(ROOT, '../escape')).toMatchObject({
      ok: false,
      reason: 'bad-input',
    })
  })
})

describe('checkDrive', () => {
  it('should pass a drive that mapped every goal and touched nothing', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    write(`${FOLDER}/evidence/01-board.png`, 'png')
    writeRecord({ goals: BOTH_DRIVEN, evidence: ['evidence/01-board.png'] })

    const outcome = await checkDrive(ROOT, 'app-drive-1-0')

    expect(outcome).toMatchObject({ ok: true, reason: 'clean', goals: 2 })
  })

  it('should match a goal written with its bold label and period', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: [
        {
          goal: '**Boards.** A designer lays out frames on one board.',
          status: 'driven',
        },
        BOTH_DRIVEN[1],
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
    })
  })

  it('should fail a goal the record carries no entry for', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: [BOTH_DRIVEN[0]] })

    const outcome = await checkDrive(ROOT, 'app-drive-1-0')

    expect(outcome).toMatchObject({
      reason: 'failed',
      findings: { unmapped: ['A board exports to PNG'] },
    })
  })

  it('should pass a goal marked not driven with a reason', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: [
        BOTH_DRIVEN[0],
        {
          goal: 'A board exports to PNG',
          status: 'not-driven',
          reason: 'export needs a signed build',
        },
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
    })
  })

  it('should fail a goal marked not driven with no reason', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: [
        BOTH_DRIVEN[0],
        { goal: 'A board exports to PNG', status: 'not-driven' },
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { unreasoned: ['A board exports to PNG'] },
    })
  })

  it('should fail an entry naming no goal the record holds', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: [...BOTH_DRIVEN, { goal: 'Host boards', status: 'driven' }],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { unknown: ['Host boards'] },
    })
  })

  it('should fail and name each path the drive changed in the checkout', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    write('src/app.ts', 'export const x = 1\n')
    write('boards/new.json', '{}')
    writeRecord({ goals: BOTH_DRIVEN })

    const outcome = await checkDrive(ROOT, 'app-drive-1-0')

    expect(outcome).toMatchObject({
      reason: 'failed',
      findings: { changed: ['src/app.ts', 'boards/new.json'] },
    })
  })

  it('should fail evidence recorded outside the evidence folder', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    write('.canon/tmp/shot.png', 'png')
    writeRecord({
      goals: BOTH_DRIVEN,
      evidence: ['../../tmp/shot.png', join(ROOT, '.canon/tmp/shot.png')],
    })

    const outcome = await checkDrive(ROOT, 'app-drive-1-0')

    expect(outcome).toMatchObject({
      reason: 'failed',
      findings: {
        strayEvidence: [
          '../../tmp/shot.png',
          join(ROOT, '.canon/tmp/shot.png'),
        ],
      },
    })
  })

  it('should fail evidence the folder does not hold', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, evidence: ['evidence/gone.png'] })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { missingEvidence: ['evidence/gone.png'] },
    })
  })

  it('should fail a drive whose worktree is still on disk', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    const copy = mkdtempSync(join(tmpdir(), 'canon-drive-copy-'))
    writeRecord({ goals: BOTH_DRIVEN, worktree: copy })

    const outcome = await checkDrive(ROOT, 'app-drive-1-0')
    rmSync(copy, { recursive: true, force: true })

    expect(outcome).toMatchObject({
      reason: 'failed',
      findings: { worktreeLeft: [copy] },
    })
  })

  it('should pass a live drive whose record names no worktree', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, worktree: null })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
      findings: { worktreeLeft: [] },
    })
  })

  it('should refuse an empty worktree path, naming null', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, worktree: '' })

    const outcome = await checkDrive(ROOT, 'app-drive-1-0')

    expect(outcome).toMatchObject({ ok: false, reason: 'bad-record' })
    expect((outcome as { message: string }).message).toContain('null')
  })

  it('should refuse a blank worktree path', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, worktree: '   ' })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'bad-record',
    })
  })

  it('should pass a drive whose folder carries no drive log', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
      findings: { undrawn: [] },
    })
  })

  it('should fail a logged decision with no drawn outcome', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeLog(
      '## 02. Layers click leaves a frame half hidden',
      '- **Decision (operator):** center the frame',
    )
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { undrawn: ['02. Layers click leaves a frame half hidden'] },
    })
  })

  it('should pass a drawn decision whose paths hold files', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    write(`${FOLDER}/evidence/layers/02-options.png`, 'png')
    write(`${FOLDER}/evidence/mocks/layers/02-fix.html`, '<div></div>')
    write(`${FOLDER}/evidence/baseline/00-current.png`, 'png')
    writeLog(REFERENCE_LOG.replace(/^# Drive log\n/, ''))
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
    })
  })

  it('should pass evidence grouped in a folder per surface', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    write(`${FOLDER}/evidence/layers/02-options.png`, 'png')
    write(`${FOLDER}/evidence/layers/frames/02-partial.png`, 'png')
    write(`${FOLDER}/evidence/mocks/layers/02-fix.html`, '<div></div>')
    writeLog(
      '## 02. Layers click leaves a frame half hidden',
      '- **Drawn:** `evidence/layers/02-options.png`, `evidence/mocks/layers/`',
      '- **Decision (operator):** center the frame',
    )
    writeRecord({
      goals: BOTH_DRIVEN,
      evidence: [
        'evidence/layers/02-options.png',
        'evidence/layers/frames/02-partial.png',
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
    })
  })

  it('should fail a drawn path holding no file', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeLog(
      '## 02. Layers click leaves a frame half hidden',
      '- **Drawn:** `evidence/02-options.png`',
      '- **Decision (operator):** center the frame',
    )
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { undrawn: [], missingEvidence: ['evidence/02-options.png'] },
    })
  })

  it('should fail a drawn path outside the evidence folder', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    write('.canon/picks/02-fix.png', 'png')
    writeLog(
      '## 02. Layers click leaves a frame half hidden',
      '- **Drawn:** `../../picks/02-fix.png`',
      '- **Decision (operator):** center the frame',
    )
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { strayEvidence: ['../../picks/02-fix.png'] },
    })
  })

  it('should refuse a folder carrying no drive record', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'no-record',
    })
  })

  it('should refuse a drive record carrying no goals list', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ evidence: [] })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'bad-record',
    })
  })

  it('should refuse a check with no baseline recorded', async () => {
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'no-baseline',
    })
  })

  it('should refuse a project carrying no requirements record', async () => {
    rmSync(join(ROOT, 'canon'), { recursive: true })
    git('commit', '-q', '-am', 'drop requirements')
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'no-requirements',
    })
  })
})

describe('checkDrive scripts', () => {
  const BASICS = 'canon/drive/basics.md'
  const DESIGNER = 'a designer laying out a board'
  const AGENT = 'an agent calling the CLI'

  function writeConfig(text: string): void {
    write('canon/config/app-drive.toml', text)
    git('add', '.')
    git('commit', '-q', '-m', 'config')
  }

  const FLAT_CONFIG = [
    `scripts = ["${BASICS}"]`,
    `personas = ["${DESIGNER}", "${AGENT}"]`,
    '',
  ].join('\n')

  it('should pass a drive that ran every script once per persona', async () => {
    writeConfig(FLAT_CONFIG)
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      scripts: [
        { script: BASICS, persona: DESIGNER, status: 'driven' },
        { script: BASICS, persona: AGENT, status: 'driven' },
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: true,
      reason: 'clean',
    })
  })

  it('should fail a script a persona never ran', async () => {
    writeConfig(FLAT_CONFIG)
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      scripts: [{ script: BASICS, persona: DESIGNER, status: 'driven' }],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: true,
      reason: 'failed',
      findings: { unscripted: [`${BASICS} (${AGENT})`] },
    })
  })

  it('should fail a script marked not driven with no reason', async () => {
    writeConfig(FLAT_CONFIG)
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      scripts: [
        { script: BASICS, persona: DESIGNER, status: 'driven' },
        { script: BASICS, persona: AGENT, status: 'not-driven' },
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { unscripted: [`${BASICS} (${AGENT})`] },
    })
  })

  it('should pass a script skipped with a reason', async () => {
    writeConfig(FLAT_CONFIG)
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      scripts: [
        { script: BASICS, persona: DESIGNER, status: 'driven' },
        {
          script: BASICS,
          persona: AGENT,
          status: 'not-driven',
          reason: 'the script file is missing',
        },
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
    })
  })

  it('should check a config naming no scripts as before', async () => {
    writeConfig(`personas = ["${DESIGNER}"]\n`)
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
      findings: { unscripted: [] },
    })
  })

  it('should hold a named target to the flat scripts with its own personas', async () => {
    writeConfig(
      [
        FLAT_CONFIG,
        '[targets.web]',
        'root = "web"',
        `personas = ["${AGENT}"]`,
        '',
      ].join('\n'),
    )
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, target: 'web', scripts: [] })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { unscripted: [`${BASICS} (${AGENT})`] },
    })
  })

  it("should not hold the default target to a named target's scripts", async () => {
    writeConfig(
      [
        `personas = ["${DESIGNER}"]`,
        '[targets.web]',
        `scripts = ["${BASICS}"]`,
        '',
      ].join('\n'),
    )
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, target: null })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
    })
  })

  it('should require each script once when the config names no personas', async () => {
    writeConfig(`scripts = ["${BASICS}"]\n`)
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, scripts: [] })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: { unscripted: [BASICS] },
    })
  })

  it('should refuse a record naming a target the config does not hold', async () => {
    writeConfig(FLAT_CONFIG)
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, target: 'docs' })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'bad-record',
    })
  })

  it('should refuse a config that does not parse', async () => {
    writeConfig('scripts = [\n')
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'bad-config',
    })
  })

  it('should refuse a scripts key that is not a list of paths', async () => {
    writeConfig('scripts = "canon/drive/basics.md"\n')
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'bad-config',
    })
  })

  describe('from the [drive] table of app.toml', () => {
    function writeApp(text: string): void {
      write('canon/config/app.toml', text)
      git('add', '.')
      git('commit', '-q', '-m', 'app config')
    }

    it('should hold a [drive.targets.web] table to its own personas over the flat scripts', async () => {
      writeApp(
        [
          '[drive]',
          `scripts = ["${BASICS}"]`,
          `personas = ["${DESIGNER}"]`,
          '',
          '[drive.targets.web]',
          `personas = ["${AGENT}"]`,
          '',
        ].join('\n'),
      )
      await recordBaseline(ROOT, 'app-drive-1-0')
      writeRecord({ goals: BOTH_DRIVEN, target: 'web', scripts: [] })

      expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
        reason: 'failed',
        findings: { unscripted: [`${BASICS} (${AGENT})`] },
      })
    })

    it('should take the table over an app-drive.toml beside it', async () => {
      writeConfig(`scripts = ["${BASICS}"]\n`)
      writeApp('[drive]\nscripts = []\n')
      await recordBaseline(ROOT, 'app-drive-1-0')
      writeRecord({ goals: BOTH_DRIVEN, scripts: [] })

      expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
        reason: 'clean',
      })
    })

    it('should name the table key on a target the table does not hold', async () => {
      writeApp(`[drive]\nscripts = ["${BASICS}"]\n`)
      await recordBaseline(ROOT, 'app-drive-1-0')
      writeRecord({ goals: BOTH_DRIVEN, target: 'docs' })

      expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
        ok: false,
        reason: 'bad-record',
        message: expect.stringContaining(
          'canon/config/app.toml does not hold under [drive.targets]',
        ),
      })
    })

    it('should name the dotted key on a target list that is not strings', async () => {
      writeApp('[drive]\n\n[drive.targets.web]\nscripts = "basics.md"\n')
      await recordBaseline(ROOT, 'app-drive-1-0')
      writeRecord({ goals: BOTH_DRIVEN, target: 'web' })

      expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
        ok: false,
        reason: 'bad-config',
        message: expect.stringContaining('"drive.targets.web.scripts"'),
      })
    })
  })
})

describe('checkDrive current page and visible skips', () => {
  const BOARD_LOG = [
    '| Setup | Value |',
    '| --- | --- |',
    '| Board | `http://127.0.0.1:4173`, project `drive-13` |',
  ].join('\n')

  const DRAWN = [
    '## 02. Layers click leaves a frame',
    '- **Drawn:** `evidence/layers/02-options.png`',
    '- **Decision (operator):** center the frame',
  ].join('\n\n')

  const SKIPPED = [
    '## 03. Export drops the alpha channel',
    '- **Drawn:** skipped, nothing visible changes',
    '- **Decision (operator):** keep alpha in PNG export',
  ]

  function writeItem(
    fix: string,
    decided = 'evidence/drive-log.md, finding 03',
  ) {
    write(
      `${FOLDER}/01-export.md`,
      [
        '### 1. Export drops alpha',
        '',
        '- **Problem:** alpha is lost',
        `- **Fix:** ${fix}`,
        '- **Worth it:** yes',
        `- **Decided:** ${decided}`,
        '- **You:**',
      ].join('\n'),
    )
  }

  function writeBoardLog(...findings: string[]) {
    write(`${FOLDER}/evidence/layers/02-options.png`, 'png')
    write(
      `${FOLDER}/evidence/drive-log.md`,
      [BOARD_LOG, ...findings].join('\n\n'),
    )
  }

  async function check() {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })
    return checkDrive(ROOT, 'app-drive-1-0')
  }

  it('should pass a board drive that decided no finding and drew nothing', async () => {
    writeBoardLog()

    expect(await check()).toMatchObject({
      reason: 'clean',
      findings: { uncaptured: [] },
    })
  })

  it('should pass a board drive whose only decision skipped its drawing', async () => {
    writeBoardLog(SKIPPED.join('\n\n'))

    expect(await check()).toMatchObject({
      reason: 'clean',
      findings: { uncaptured: [] },
    })
  })

  it('should require the capture of a drawn finding another one points back at', async () => {
    writeBoardLog(
      DRAWN,
      '## 04. Layers click on a nested frame',
      '- **Decision (operator):** see 02',
    )

    expect(await check()).toMatchObject({
      reason: 'failed',
      findings: {
        undrawn: [],
        uncaptured: ['evidence/baseline/00-current'],
      },
    })
  })

  it('should fail a board drive that drew a finding with no current-page capture', async () => {
    writeBoardLog(DRAWN)
    write(`${FOLDER}/evidence/baseline/00-next.png`, 'png')

    expect(await check()).toMatchObject({
      reason: 'failed',
      findings: { uncaptured: ['evidence/baseline/00-current'] },
    })
  })

  it('should pass a board drive holding the capture in any image format', async () => {
    writeBoardLog(DRAWN)
    write(`${FOLDER}/evidence/baseline/00-current.webp`, 'img')

    expect(await check()).toMatchObject({
      reason: 'clean',
      findings: { uncaptured: [] },
    })
  })

  it('should count a current-page capture carrying a width and theme suffix', async () => {
    writeBoardLog(DRAWN)
    write(`${FOLDER}/evidence/baseline/00-current-1440.light.png`, 'img')
    write(`${FOLDER}/evidence/baseline/00-current-1440.dark.png`, 'img')

    expect(await check()).toMatchObject({
      reason: 'clean',
      findings: { uncaptured: [] },
    })
  })

  it('should not count a name that only begins with the stem', async () => {
    writeBoardLog(DRAWN)
    write(`${FOLDER}/evidence/baseline/00-currently.png`, 'img')

    expect(await check()).toMatchObject({
      findings: { uncaptured: ['evidence/baseline/00-current'] },
    })
  })

  it('should pass a drive that names no board and holds no capture', async () => {
    write(`${FOLDER}/evidence/layers/02-options.png`, 'png')
    write(`${FOLDER}/evidence/drive-log.md`, `| Board |  |\n\n${DRAWN}`)

    expect(await check()).toMatchObject({
      reason: 'clean',
      findings: { uncaptured: [] },
    })
  })

  it('should fail a skip on a finding whose item fixes a rendered surface', async () => {
    write(`${FOLDER}/evidence/drive-log.md`, SKIPPED.join('\n\n'))
    writeItem('set the alpha in `web/src/export.css`')

    expect(await check()).toMatchObject({
      reason: 'failed',
      findings: { skippedVisible: ['03. Export drops the alpha channel'] },
    })
  })

  it('should pass a skip on an item that names no rendered surface', async () => {
    write(`${FOLDER}/evidence/drive-log.md`, SKIPPED.join('\n\n'))
    writeItem('keep alpha in `src/export.ts`')

    expect(await check()).toMatchObject({
      reason: 'clean',
      findings: { skippedVisible: [] },
    })
  })

  it('should pass a skip that no intake item points at', async () => {
    write(`${FOLDER}/evidence/drive-log.md`, SKIPPED.join('\n\n'))
    writeItem(
      'set the alpha in `web/src/export.css`',
      'evidence/drive-log.md, finding 09',
    )

    expect(await check()).toMatchObject({
      findings: { skippedVisible: [] },
    })
  })

  it('should read the Fix and Worth it lines alone', async () => {
    write(`${FOLDER}/evidence/drive-log.md`, SKIPPED.join('\n\n'))
    write(
      `${FOLDER}/01-export.md`,
      [
        '### 1. Export drops alpha',
        '',
        '- **Problem:** `web/src/export.css` clips it',
        '- **Fix:** keep alpha in `src/export.ts`',
        '- **Worth it:** yes',
        '- **Decided:** evidence/drive-log.md, finding 03',
        '- **You:**',
      ].join('\n'),
    )

    expect(await check()).toMatchObject({
      findings: { skippedVisible: [] },
    })
  })
})

describe('checkDrive behavior rows', () => {
  const DESIGN = [
    '# Design',
    '',
    '## Iconography',
    '',
    'Lucide at 16px.',
    '',
    '## Behavior',
    '',
    '| Surface | Behavior |',
    '| ------- | -------- |',
    '| `board` | A frame resizes from its corner grips, 120px to 1600px. |',
    '| `export` | **Export.** The export menu opens on tap and closes on Escape. |',
    '',
  ].join('\n')

  const GRIPS = {
    surface: 'board',
    behavior: 'A frame resizes from its corner grips, 120px to 1600px',
    status: 'driven',
  }
  const MENU = {
    surface: 'export',
    behavior: 'The export menu opens on tap and closes on Escape.',
    status: 'driven',
  }

  beforeEach(() => {
    write('canon/DESIGN.md', DESIGN)
    git('add', '.')
    git('commit', '-q', '-m', 'design record')
  })

  it('should pass a drive that mapped every behavior row', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN, behaviors: [GRIPS, MENU] })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
      behaviors: 2,
      findings: { behavior: [] },
    })
  })

  describe('a row bold end to end', () => {
    const SHARE = {
      surface: 'share',
      behavior: 'The share sheet closes on Escape',
      status: 'driven',
    }

    beforeEach(() => {
      write(
        'canon/DESIGN.md',
        DESIGN.replace(
          '| `export` |',
          '| `share` | **The share sheet closes on Escape.** |\n| `export` |',
        ),
      )
      git('add', '.')
      git('commit', '-q', '-m', 'bold row')
    })

    it('should report the row unmapped when no entry maps it', async () => {
      await recordBaseline(ROOT, 'app-drive-1-0')
      writeRecord({ goals: BOTH_DRIVEN, behaviors: [GRIPS, MENU] })

      expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
        reason: 'failed',
        behaviors: 3,
        findings: {
          behavior: ['unmapped: share: The share sheet closes on Escape'],
        },
      })
    })

    it('should pass once the drive maps the row', async () => {
      await recordBaseline(ROOT, 'app-drive-1-0')
      writeRecord({ goals: BOTH_DRIVEN, behaviors: [GRIPS, MENU, SHARE] })

      expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
        reason: 'clean',
        behaviors: 3,
        findings: { behavior: [] },
      })
    })
  })

  it('should report each row unmapped when the record carries no behaviors list', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: true,
      reason: 'failed',
      findings: {
        behavior: [
          'unmapped: board: A frame resizes from its corner grips, 120px to 1600px',
          'unmapped: export: The export menu opens on tap and closes on Escape',
        ],
      },
    })
  })

  it('should pass a row marked not driven with a reason', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      behaviors: [
        GRIPS,
        { ...MENU, status: 'not-driven', reason: 'no export on this target' },
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
    })
  })

  it('should report a row marked not driven with no reason as unreasoned', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      behaviors: [GRIPS, { ...MENU, status: 'not-driven', reason: ' ' }],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: {
        behavior: [
          'unreasoned: export: The export menu opens on tap and closes on Escape',
        ],
      },
    })
  })

  it('should report a reworded row as unmapped and its entry as unknown', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      behaviors: [
        GRIPS,
        { ...MENU, behavior: 'The export menu opens on hover' },
      ],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'failed',
      findings: {
        behavior: [
          'unmapped: export: The export menu opens on tap and closes on Escape',
          'unknown: export: The export menu opens on hover',
        ],
      },
    })
  })

  it('should report an entry under a surface the row does not sit under as unknown', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      behaviors: [GRIPS, MENU, { ...GRIPS, surface: 'canvas' }],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      findings: {
        behavior: [
          'unknown: canvas: A frame resizes from its corner grips, 120px to 1600px',
        ],
      },
    })
  })

  it('should pass with no behavior finding when the record has no Behavior section', async () => {
    write('canon/DESIGN.md', '# Design\n\n## Colors\n\n- Ink on paper.\n')
    git('commit', '-q', '-am', 'drop behavior')
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
      behaviors: 0,
      findings: { behavior: [] },
    })
  })

  it('should pass with no behavior finding in a project with no design record', async () => {
    rmSync(join(ROOT, 'canon/DESIGN.md'))
    git('commit', '-q', '-am', 'drop design')
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({ goals: BOTH_DRIVEN })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      reason: 'clean',
      behaviors: 0,
      findings: { behavior: [] },
    })
  })

  it('should refuse a behaviors entry carrying no surface', async () => {
    await recordBaseline(ROOT, 'app-drive-1-0')
    writeRecord({
      goals: BOTH_DRIVEN,
      behaviors: [{ behavior: GRIPS.behavior, status: 'driven' }],
    })

    expect(await checkDrive(ROOT, 'app-drive-1-0')).toMatchObject({
      ok: false,
      reason: 'bad-record',
    })
  })
})
