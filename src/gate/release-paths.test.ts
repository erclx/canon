import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '../..')

// The plugin marketplace ships these outside npm's `files`, and
// `extra-files` versions a manifest under `plugins/`, so a commit to either
// belongs in the release
const SHIPPED_OUTSIDE_NPM = ['plugins', '.claude-plugin']

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8')) as T

const topFolder = (path: string): string => path.split('/')[0]

const firstTwo = (path: string): string => path.split('/').slice(0, 2).join('/')

// A negated glob narrows what npm packs and never adds a folder, so only the
// positive entries say which folders ship
const npmFiles = readJson<{ files: string[] }>('package.json').files.filter(
  (entry) => !entry.startsWith('!'),
)

const excludePaths =
  readJson<{
    packages: Record<string, { 'exclude-paths'?: string[] }>
  }>('release-please-config.json').packages['.']['exclude-paths'] ?? []

const shipped = [...npmFiles, ...SHIPPED_OUTSIDE_NPM]

// A folder npm ships only part of, such as `assets` through
// `assets/brand/mark.svg`, is read one level down, so a new subfolder beside
// the shipped file still has to be shipped or excluded
const wholeTops = new Set(
  shipped.filter((entry) => !entry.includes('/')).map(topFolder),
)
const partialTops = new Set(
  shipped
    .filter((entry) => entry.includes('/'))
    .map(topFolder)
    .filter((top) => !wholeTops.has(top)),
)

const unitOf = (path: string): string =>
  partialTops.has(topFolder(path)) ? firstTwo(path) : topFolder(path)

// Tracked paths alone, so a folder living only in `node_modules` or a
// gitignored path never reads as a leak
const trackedUnits = [
  ...new Set(
    execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((path) => path.includes('/'))
      .map(unitOf),
  ),
]

describe('release-please exclude-paths', () => {
  it('should ship or exclude every tracked folder', () => {
    const covered = new Set([...shipped, ...excludePaths].map(unitOf))

    const uncovered = trackedUnits.filter((unit) => !covered.has(unit))

    expect(uncovered).toEqual([])
  })

  // release-please skips a commit whose every file sits under an excluded
  // prefix, so an exclusion reaching a shipped path drops a real change
  it('should exclude no path npm or the marketplace ships', () => {
    const overlapping = excludePaths.filter((excluded) =>
      shipped.some(
        (entry) =>
          entry === excluded ||
          entry.startsWith(`${excluded}/`) ||
          excluded.startsWith(`${entry}/`),
      ),
    )

    expect(overlapping).toEqual([])
  })
})
