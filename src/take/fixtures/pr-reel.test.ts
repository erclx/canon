import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isPainted, loadPaintedPatterns } from '@/pr/painted'
import {
  REEL_CAP_SECONDS,
  readReelArgs,
  selectFixtures,
} from '@/take/fixtures/pr-reel'

const FOLDER = [
  'motion.html',
  'motion.json',
  'scrollbars.html',
  'scrollbars.json',
  'focus.html',
  'pr-reel.ts',
]

describe('selectFixtures', () => {
  it('should film nothing when no path under the engine changed', () => {
    const selection = selectFixtures(['src/pr/lift.ts', 'README.md'], FOLDER)

    expect(selection).toEqual({ kind: 'untouched' })
  })

  it('should film nothing when only engine tests changed', () => {
    const selection = selectFixtures(
      ['src/take/camera.test.ts', 'src/take/film.e2e.test.ts'],
      FOLDER,
    )

    expect(selection).toEqual({ kind: 'untouched' })
  })

  it('should film a changed fixture with its plan beside it', () => {
    const selection = selectFixtures(
      ['src/take/fixtures/scrollbars.html', 'src/take/film.ts'],
      FOLDER,
    )

    expect(selection).toEqual({ kind: 'film', stems: ['scrollbars'] })
  })

  it('should refuse a changed fixture that has no plan, naming it', () => {
    const selection = selectFixtures(['src/take/fixtures/focus.html'], FOLDER)

    expect(selection).toEqual({
      kind: 'unplanned',
      paths: ['src/take/fixtures/focus.html'],
    })
  })

  it('should refuse an engine change that touches no fixture, naming the engine paths', () => {
    const selection = selectFixtures(
      ['src/take/camera.ts', 'src/take/camera.test.ts', 'src/take/film.ts'],
      FOLDER,
    )

    expect(selection).toEqual({
      kind: 'unplanned',
      paths: ['src/take/camera.ts', 'src/take/film.ts'],
    })
  })

  it('should film the planned fixture when an unplanned engine file changed beside it', () => {
    const selection = selectFixtures(
      ['src/take/camera.ts', 'src/take/fixtures/scrollbars.html'],
      FOLDER,
    )

    expect(selection).toEqual({ kind: 'film', stems: ['scrollbars'] })
  })

  it('should film a fixture whose plan alone changed', () => {
    const selection = selectFixtures(['src/take/fixtures/motion.json'], FOLDER)

    expect(selection).toEqual({ kind: 'film', stems: ['motion'] })
  })

  it('should film a fixture once when its page and plan both changed', () => {
    const selection = selectFixtures(
      [
        'src/take/fixtures/scrollbars.html',
        'src/take/fixtures/scrollbars.json',
      ],
      FOLDER,
    )

    expect(selection).toEqual({ kind: 'film', stems: ['scrollbars'] })
  })

  it('should refuse a changed plan whose fixture page is gone', () => {
    const selection = selectFixtures(
      ['src/take/fixtures/stale.json'],
      [...FOLDER, 'stale.json'],
    )

    expect(selection).toEqual({
      kind: 'unplanned',
      paths: ['src/take/fixtures/stale.json'],
    })
  })

  it('should film every changed planned fixture once, in name order', () => {
    const selection = selectFixtures(
      [
        'src/take/fixtures/scrollbars.html',
        'src/take/fixtures/motion.html',
        'src/take/fixtures/focus.html',
      ],
      FOLDER,
    )

    expect(selection).toEqual({ kind: 'film', stems: ['motion', 'scrollbars'] })
  })
})

describe('readReelArgs', () => {
  it('should film no authored plan when none is passed', () => {
    const args = readReelArgs(
      ['--base', 'origin/main', '--out', 'reel'],
      FOLDER,
    )

    expect(args).toEqual({
      kind: 'run',
      base: 'origin/main',
      out: 'reel',
      json: false,
    })
  })

  it('should film an authored plan on motion when no fixture is named', () => {
    const args = readReelArgs(
      ['--base', 'origin/main', '--out', 'reel', '--plan', 'stall.json'],
      FOLDER,
    )

    expect(args).toMatchObject({
      kind: 'run',
      authored: { plan: 'stall.json', fixture: 'motion' },
    })
  })

  it('should film an authored plan on the fixture it names', () => {
    const args = readReelArgs(
      [
        '--base',
        'origin/main',
        '--out',
        'reel',
        '--plan',
        'focus.json',
        '--fixture',
        'focus',
      ],
      FOLDER,
    )

    expect(args).toMatchObject({
      authored: { plan: 'focus.json', fixture: 'focus' },
    })
  })

  it('should refuse a fixture named without a plan', () => {
    const args = readReelArgs(
      ['--base', 'origin/main', '--out', 'reel', '--fixture', 'focus'],
      FOLDER,
    )

    expect(args.kind).toBe('usage')
  })

  it('should refuse a fixture the folder holds no page for', () => {
    const args = readReelArgs(
      [
        '--base',
        'origin/main',
        '--out',
        'reel',
        '--plan',
        'x.json',
        '--fixture',
        'ticket',
      ],
      FOLDER,
    )

    expect(args.kind).toBe('usage')
  })

  it('should refuse a run missing its base', () => {
    const args = readReelArgs(['--out', 'reel'], FOLDER)

    expect(args.kind).toBe('usage')
  })
})

describe('the fixture shelf', () => {
  it('should hold every page-and-plan pair under the reel cap on its waits alone', () => {
    const shelf = readdirSync(fileURLToPath(new URL('.', import.meta.url)))
    const paired = shelf
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .filter((stem) => shelf.includes(`${stem}.html`))

    const over = paired.filter((stem) => {
      const plan = JSON.parse(
        readFileSync(new URL(`./${stem}.json`, import.meta.url), 'utf8'),
      ) as { beats: { steps: { kind: string; ms?: number }[] }[] }
      const waits = plan.beats
        .flatMap((beat) => beat.steps)
        .reduce(
          (sum, step) => sum + (step.kind === 'wait' ? (step.ms ?? 0) : 0),
          0,
        )
      return waits >= REEL_CAP_SECONDS * 1000
    })

    expect(paired).toContain('motion')
    expect(over).toEqual([])
  })
})

describe('the declared reel inputs', () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const TAKE = 'src/take/'

  function filesUnder(rel: string): string[] {
    return readdirSync(join(root, rel), { recursive: true, encoding: 'utf8' })
      .map((name) => join(rel, name))
      .filter((path) => statSync(join(root, path)).isFile())
  }

  /** Resolves an `@/`, `./`, or `../` specifier to a tracked file, and a package name to nothing. */
  function resolveImport(from: string, spec: string): string | undefined {
    const base = spec.startsWith('@/')
      ? `src/${spec.slice(2)}`
      : spec.startsWith('.')
        ? relative(root, join(dirname(join(root, from)), spec))
        : undefined
    if (base === undefined) return undefined
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(
      (path) =>
        existsSync(join(root, path)) && statSync(join(root, path)).isFile(),
    )
  }

  /** Every repository path a module reaches by an import of any form or reads through `new URL`. */
  function readsOf(path: string): string[] {
    const text = readFileSync(join(root, path), 'utf8')
    const imports = [
      ...text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g),
    ]
      .map((match) => resolveImport(path, match[1] ?? ''))
      .filter((found): found is string => found !== undefined)
    const urls = [
      ...text.matchAll(/new URL\(\s*'([^']+)',\s*import\.meta\.url\s*\)/g),
    ].flatMap((match) => {
      const target = relative(
        root,
        join(dirname(join(root, path)), match[1] ?? ''),
      )
      if (!existsSync(join(root, target))) return []
      return statSync(join(root, target)).isDirectory()
        ? filesUnder(target)
        : [target]
    })
    return [...imports, ...urls]
  }

  const isModule = (path: string): boolean =>
    path.endsWith('.ts') && !path.endsWith('.test.ts')

  it('should follow a relative import as well as an alias', () => {
    expect(readsOf('src/design/favicon.ts')).toContain('src/design/template.ts')
  })

  it('should paint or declare every path outside the engine a reel reads', () => {
    const patterns = loadPaintedPatterns(root)
    const inputs = patterns.reelInputs ?? []
    const queue = filesUnder(TAKE).filter(isModule)
    const seen = new Set(queue)
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      for (const read of readsOf(path)) {
        if (seen.has(read)) continue
        seen.add(read)
        if (isModule(read)) queue.push(read)
      }
    }

    const outside = [...seen].filter((path) => !path.startsWith(TAKE))
    const undeclared = outside.filter(
      (path) =>
        !isPainted(path, patterns) &&
        !inputs.some((glob) => new Bun.Glob(glob).match(path)),
    )

    expect(outside).toContain('src/browser/engine.ts')
    expect(outside).toContain('web/src/styles/tokens.css')
    expect(undeclared).toEqual([])
  })
})
