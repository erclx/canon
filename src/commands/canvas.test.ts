import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeSelection } from '@/canvas/content'

const CLI = join(import.meta.dirname, '../cli.ts')

let ROOT = ''

interface Run {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
}

function canvas(...args: string[]): Run {
  return canvasAt(ROOT, ...args)
}

function canvasAt(root: string, ...args: string[]): Run {
  const result = spawnSync('bun', [CLI, 'canvas', ...args, '--root', root], {
    encoding: 'utf8',
    env: { ...process.env, CANON_NON_INTERACTIVE: '1', NO_COLOR: '1' },
  })
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-command-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('canon canvas', () => {
  it('should add a page and report it as one JSON record on stdout', () => {
    const run = canvas('page', 'add', 'drafts', '--json')

    expect(run.status).toBe(0)
    expect(JSON.parse(run.stdout)).toEqual({ ok: true, page: 'drafts' })
    expect(run.stderr).toContain('page drafts')
  })

  it('should add a frame at the size it was given', () => {
    canvas('page', 'add', 'drafts')

    const run = canvas(
      'frame',
      'add',
      'drafts',
      'hero',
      '--width',
      '390',
      '--height',
      '844',
      '--json',
    )

    const record = JSON.parse(run.stdout)
    expect(record).toMatchObject({
      ok: true,
      page: 'drafts',
      frame: 'hero',
      box: { x: 0, y: 0, width: 390, height: 844 },
    })
    expect(existsSync(record.path)).toBe(true)
  })

  it('should list pages and frames as JSON with nothing else on stdout', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero')

    const run = canvas('list', '--json')

    const record = JSON.parse(run.stdout)
    expect(record.pages).toEqual([
      expect.objectContaining({
        name: 'drafts',
        frames: [expect.objectContaining({ name: 'hero', width: 1440 })],
      }),
    ])
    expect(run.stdout.trim().split('\n')).toHaveLength(1)
  })

  it('should rename a page', () => {
    canvas('page', 'add', 'drafts')

    const run = canvas('page', 'rename', 'drafts', 'approved', '--json')

    expect(JSON.parse(run.stdout)).toEqual({
      ok: true,
      page: 'approved',
      from: 'drafts',
    })
  })

  it('should refuse a frame on a missing page with exit 1 and a reason', () => {
    const run = canvas('frame', 'add', 'missing', 'hero', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      reason: 'no-page',
    })
    expect(run.stderr).toContain('page missing does not exist')
  })

  it('should refuse a size that is not a positive integer', () => {
    canvas('page', 'add', 'drafts')

    const run = canvas('frame', 'add', 'drafts', 'hero', '--width', 'wide')

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('width and height must be positive')
  })

  it('should refuse a root that does not exist rather than create it', () => {
    const missing = join(ROOT, 'typo')

    const run = canvasAt(missing, 'page', 'add', 'drafts', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      reason: 'no-root',
    })
    expect(existsSync(missing)).toBe(false)
  })
})

describe('canon canvas frame move', () => {
  it('should move a frame and report the box as one JSON record', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero', '--width', '390')

    const run = canvas(
      'frame',
      'move',
      'drafts',
      'hero',
      '--x',
      '200',
      '--y',
      '120',
      '--json',
    )

    expect(run.status).toBe(0)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: true,
      frame: 'hero',
      box: { x: 200, y: 120, width: 390 },
    })
  })

  it('should leave the other axis where the frame is', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero')
    canvas('frame', 'move', 'drafts', 'hero', '--x', '30', '--y', '40')

    const run = canvas('frame', 'move', 'drafts', 'hero', '--x', '90', '--json')

    expect(JSON.parse(run.stdout).box).toMatchObject({ x: 90, y: 40 })
  })

  it('should refuse a frame that does not exist with exit 1 and a reason', () => {
    canvas('page', 'add', 'drafts')

    const run = canvas('frame', 'move', 'drafts', 'hero', '--x', '1', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      reason: 'no-frame',
    })
  })

  it('should refuse a position that is not a number', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero')

    const run = canvas(
      'frame',
      'move',
      'drafts',
      'hero',
      '--x',
      'left',
      '--json',
    )

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      reason: 'invalid-position',
    })
  })
})

describe('canon canvas selection', () => {
  it('should report none when nothing is selected', () => {
    const run = canvas('selection', '--json')

    expect(run.status).toBe(0)
    expect(JSON.parse(run.stdout)).toEqual({ ok: true, selection: null })
  })

  it('should report the selected frame with its box and path', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero', '--width', '390')
    writeSelection(ROOT, { page: 'drafts', frame: 'hero' })

    const run = canvas('selection', '--json')

    const { selection } = JSON.parse(run.stdout)
    expect(selection).toMatchObject({
      page: 'drafts',
      frame: 'hero',
      box: { width: 390 },
    })
    expect(existsSync(selection.path)).toBe(true)
  })

  it('should report the selected element with its index, tag, classes, and text', () => {
    canvas('page', 'add', 'drafts')
    writeFileSync(
      join(ROOT, '.canon', 'canvas', 'drafts', 'hero.html'),
      '<html><head></head><body><button class="cta">Start</button></body></html>',
    )
    writeSelection(ROOT, {
      page: 'drafts',
      frame: 'hero',
      element: { index: 3, tag: 'button', count: 4 },
    })

    const run = canvas('selection', '--json')

    expect(JSON.parse(run.stdout).selection.element).toEqual({
      index: 3,
      tag: 'button',
      classes: ['cta'],
      text: 'Start',
      stale: false,
    })
  })

  it('should report none once the selected frame is removed', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero')
    writeSelection(ROOT, { page: 'drafts', frame: 'hero' })
    rmSync(join(ROOT, '.canon', 'canvas', 'drafts', 'hero.html'))

    const run = canvas('selection', '--json')

    expect(JSON.parse(run.stdout)).toEqual({ ok: true, selection: null })
  })

  it('should keep stdout to the one record', () => {
    const run = canvas('selection', '--json')

    expect(run.stdout.trim().split('\n')).toHaveLength(1)
  })
})

describe('canon canvas edit', () => {
  const HERO =
    '<html><head></head><body>\n  <h1 class="title">Hero</h1>\n</body></html>\n'

  function seedHero(): string {
    canvas('page', 'add', 'drafts')
    const path = join(ROOT, '.canon', 'canvas', 'drafts', 'hero.html')
    writeFileSync(path, HERO)
    return path
  }

  it('should write one attribute and report it as one JSON record', () => {
    const path = seedHero()

    const run = canvas(
      'edit',
      'drafts/hero',
      '--element',
      '3',
      '--set',
      'color=var(--color-accent)',
      '--json',
    )

    expect(run.status).toBe(0)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: true,
      page: 'drafts',
      frame: 'hero',
      property: 'color',
      value: 'var(--color-accent)',
      path,
    })
    expect(readFileSync(path, 'utf8')).toBe(
      HERO.replace(
        'class="title"',
        'class="title" style="color: var(--color-accent)"',
      ),
    )
  })

  it('should refuse a setting with no property name', () => {
    seedHero()

    const run = canvas(
      'edit',
      'drafts/hero',
      '--element',
      '3',
      '--set',
      'blue',
      '--json',
    )

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({ reason: 'invalid-edit' })
  })

  it('should refuse a target that does not name a page and a frame', () => {
    seedHero()

    const run = canvas(
      'edit',
      'drafts',
      '--element',
      '3',
      '--set',
      'color=blue',
      '--json',
    )

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({ reason: 'invalid-name' })
  })
})

describe('canon canvas capture', () => {
  it('should refuse a page that does not exist before starting a browser', () => {
    const run = canvas('capture', 'missing', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      reason: 'no-page',
    })
  })

  it('should refuse a frame that does not exist', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero')

    const run = canvas('capture', 'drafts/nope', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({ reason: 'no-frame' })
  })

  it('should refuse --composite on a frame address rather than capture the frame', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero')

    const run = canvas('capture', 'drafts/hero', '--composite', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      reason: 'invalid-name',
    })
    expect(run.stderr).toContain('--composite takes a page')
  })

  it('should refuse --composite on a page that does not exist', () => {
    const run = canvas('capture', 'missing', '--composite', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({ reason: 'no-page' })
  })

  it('should refuse --composite on a page with no frames', () => {
    canvas('page', 'add', 'drafts')

    const run = canvas('capture', 'drafts', '--composite', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({ reason: 'no-frame' })
  })
})
