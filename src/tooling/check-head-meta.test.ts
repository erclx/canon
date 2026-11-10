import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/astro/configs/scripts/check-head-meta.sh',
)

// One line per tag the check requires, keyed by the name it reports.
const TAGS = {
  title: '<title>Notes · Example</title>',
  description: '<meta name="description" content="A site.">',
  canonical: '<link rel="canonical" href="https://example.com/notes/">',
  'og:site_name': '<meta property="og:site_name" content="Example">',
  'og:image':
    '<meta property="og:image" content="https://example.com/og-image.png">',
  'twitter:card': '<meta name="twitter:card" content="summary_large_image">',
}

type Tag = keyof typeof TAGS

let root: string

interface Result {
  status: null | number
  stderr: string
  stdout: string
}

const put = (relative: string, content: string): void => {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

const page = (without?: Tag): string => {
  const head = Object.entries(TAGS)
    .filter(([name]) => name !== without)
    .map(([, tag]) => tag)
    .join('\n')
  return `<!doctype html><html><head>${head}</head><body></body></html>\n`
}

const run = (): Result => {
  const { status, stderr, stdout } = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, PROJECT_ROOT: root },
  })
  return { status, stderr, stdout }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'check-head-meta-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('check-head-meta.sh', () => {
  describe('a build whose pages carry every tag', () => {
    it('passes', () => {
      put('dist/index.html', page())
      put('dist/notes/index.html', page())

      expect(run().status).toBe(0)
    })

    it('passes tags written in another attribute order across lines', () => {
      put(
        'dist/index.html',
        page('description').replace(
          '</head>',
          '<meta\n  content="A site."\n  name="description"\n></head>',
        ),
      )

      expect(run().status).toBe(0)
    })

    it('passes a canonical on the reserved fallback address', () => {
      put(
        'dist/index.html',
        page().replace(
          'https://example.com/notes/',
          'https://set-astro-site.invalid/',
        ),
      )

      expect(run().status).toBe(0)
    })
  })

  describe('a page missing a tag', () => {
    it.each(Object.keys(TAGS) as Tag[])('fails without %s', (tag) => {
      put('dist/index.html', page())
      put('dist/notes/index.html', page(tag))

      const result = run()

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('notes/index.html')
      expect(result.stderr).toContain(tag)
    })

    it('fails a tag whose value is empty', () => {
      put('dist/index.html', page().replace('content="Example"', 'content=""'))

      const result = run()

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('og:site_name')
    })
  })

  describe('a project that never built', () => {
    it('fails rather than passing', () => {
      const result = run()

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('bun run build first')
    })

    it('fails a dist holding no page', () => {
      put('dist/assets/app.js', '')

      const result = run()

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('No built page')
    })
  })
})
