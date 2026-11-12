import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isPainted, loadPaintedPatterns } from '@/pr/painted'
import { fitBeats, selectFixtures } from '@/take/fixtures/pr-reel'

function beat(name: string, seconds: number) {
  return { name, seconds }
}

describe('fitBeats', () => {
  it('should keep every beat when they sum within the cap', () => {
    const fit = fitBeats([beat('drag', 4), beat('click', 3)], 12)

    expect(fit).toEqual({
      kept: [beat('drag', 4), beat('click', 3)],
      dropped: [],
    })
  })

  it('should keep a beat that lands exactly on the cap', () => {
    const fit = fitBeats([beat('drag', 6), beat('click', 6)], 12)

    expect(fit.dropped).toEqual([])
  })

  it('should drop the beat that passes the cap and every beat after it', () => {
    const fit = fitBeats(
      [beat('drag', 4), beat('tag', 4), beat('publish', 3), beat('note', 3)],
      12,
    )

    expect(fit).toEqual({
      kept: [beat('drag', 4), beat('tag', 4), beat('publish', 3)],
      dropped: [beat('note', 3)],
    })
  })

  it('should drop a later short beat once an earlier one passed the cap', () => {
    const fit = fitBeats([beat('drag', 10), beat('tag', 5), beat('tap', 1)], 12)

    expect(fit.kept).toEqual([beat('drag', 10)])
  })
})

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

    expect(selection).toEqual({
      kind: 'film',
      stems: ['scrollbars'],
      fallback: false,
    })
  })

  it('should fall back to motion when the changed fixture has no plan', () => {
    const selection = selectFixtures(['src/take/fixtures/focus.html'], FOLDER)

    expect(selection).toEqual({
      kind: 'film',
      stems: ['motion'],
      fallback: true,
    })
  })

  it('should fall back to motion when an engine file changed and no fixture did', () => {
    const selection = selectFixtures(['src/take/camera.ts'], FOLDER)

    expect(selection).toEqual({
      kind: 'film',
      stems: ['motion'],
      fallback: true,
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

    expect(selection).toEqual({
      kind: 'film',
      stems: ['motion', 'scrollbars'],
      fallback: false,
    })
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
