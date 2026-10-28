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
import {
  checkDrive,
  readDrawn,
  readGoals,
  recordBaseline,
} from '@/intake/drive-check'

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
    expect(readDrawn(REFERENCE_LOG)).toEqual({
      undrawn: [],
      paths: ['evidence/02-options.png', 'evidence/mocks/layers/'],
    })
  })

  it('should list a decision whose finding carries no Drawn field', () => {
    const log = REFERENCE_LOG.replace(/^- \*\*Drawn:\*\*.*\n/m, '')

    expect(readDrawn(log).undrawn).toEqual([
      '02. Layers click leaves a half-hidden frame in place',
    ])
  })

  it('should pass a skipped drawing that gives its reason', () => {
    const log = [
      '## 03. Export drops the alpha channel',
      '',
      '- **Drawn:** skipped, the fix changes no pixel the persona sees',
      '- **Decision (operator):** keep alpha in PNG export',
    ].join('\n')

    expect(readDrawn(log)).toEqual({ undrawn: [], paths: [] })
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

  it('should ignore a reference shot and a finding with no decision', () => {
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
    write(`${FOLDER}/evidence/02-options.png`, 'png')
    write(`${FOLDER}/evidence/mocks/layers/02-fix.html`, '<div></div>')
    writeLog(REFERENCE_LOG.replace(/^# Drive log\n/, ''))
    writeRecord({ goals: BOTH_DRIVEN })

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
