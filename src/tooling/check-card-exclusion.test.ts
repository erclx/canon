import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/astro/configs/scripts/check-card-exclusion.sh',
)

const MARKER = '<meta name="og-card-marker" content="1">'

let root: string

interface Result {
  status: null | number
  stderr: string
  stdout: string
}

const put = (relative: string, content = ''): void => {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

// A project the script accepts before any case adds a leak: a card config, a
// card route carrying its marker, and a built page without it.
const cleanProject = (): void => {
  put('card.config.mjs', 'export default {}\n')
  put('card-src/pages/og-card.astro', `${MARKER}\n`)
  put('dist/index.html', '<html></html>\n')
}

const run = (): Result => {
  const { status, stderr, stdout } = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, PROJECT_ROOT: root },
  })
  return { status, stderr, stdout }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'check-card-exclusion-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('check-card-exclusion.sh', () => {
  describe('a project with a clean build', () => {
    it('passes', () => {
      cleanProject()

      expect(run().status).toBe(0)
    })

    it('passes an image named for the route', () => {
      cleanProject()
      put('dist/assets/og-card.png', 'png')

      expect(run().status).toBe(0)
    })

    it('passes a page when only the project directory carries the route name', () => {
      const parent = mkdtempSync(join(tmpdir(), 'check-card-exclusion-parent-'))
      const nested = join(parent, 'blog-card-site')
      mkdirSync(nested)
      const previous = root
      root = nested
      cleanProject()

      const result = run()

      root = previous
      rmSync(parent, { force: true, recursive: true })
      expect(result.status).toBe(0)
    })
  })

  describe('a project with no card route', () => {
    it('exits 0 with its notice', () => {
      put('dist/index.html', '<html></html>\n')

      const result = run()

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('no card.config.mjs')
    })
  })

  describe('a card page that reached dist', () => {
    it.each([
      ['dist/og-card/index.html', 'directory format'],
      ['dist/og-card.html', 'file format'],
    ])('fails %s without the marker (%s)', (page) => {
      cleanProject()
      put(page, '<html></html>\n')

      const result = run()

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('page named for the card route')
      expect(result.stderr).toContain("card.config.mjs's srcDir")
    })

    it.each([
      ['dist/og-card/index.html', 'directory format'],
      ['dist/og-card.html', 'file format'],
    ])('fails %s with the marker (%s)', (page) => {
      cleanProject()
      put(page, `${MARKER}\n`)

      expect(run().status).toBe(1)
    })

    it('fails a differently named page carrying the marker', () => {
      cleanProject()
      put('dist/social/index.html', `${MARKER}\n`)

      const result = run()

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('og-card-marker')
    })
  })

  describe('a card route that lost its marker', () => {
    it('fails', () => {
      cleanProject()
      put('card-src/pages/og-card.astro', '<meta name="other">\n')

      const result = run()

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('dropped its own marker')
    })
  })

  describe('a project that never built', () => {
    it('fails', () => {
      put('card.config.mjs', 'export default {}\n')
      put('card-src/pages/og-card.astro', `${MARKER}\n`)

      const result = run()

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('bun run build first')
    })
  })
})
