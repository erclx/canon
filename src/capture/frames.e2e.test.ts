import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listSkills } from '@/claude/skills-list'
import { captureSources } from '@/capture/render'
import { buildFrameValues, fillTemplate } from '@/capture/frame-values'
import { countCommands } from '@/counts/catalogs'
import { buildDesignCss } from '@/design/css'
import { buildGovCatalog } from '@/gov/list'
import { buildStackSummaries } from '@/tooling/list'

/**
 * Renders every committed capture template through the real engine and the font
 * guard, so a `pre` or `code` element left on the user-agent `monospace` fails
 * here rather than in the Refresh Capture Frames workflow after a merge.
 *
 * It fills the templates into a temp folder the way `regen-hero.ts` does, since
 * the committed markup lags the template until the refresh pull request merges.
 * The suite needs a browser binary and skips without one.
 */

const root = new URL('../..', import.meta.url).pathname
const templateDir = join(root, 'assets', 'captures')

async function browserAvailable(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright-core')
    const browser = await chromium.launch()
    await browser.close()
    return true
  } catch {
    return false
  }
}

const hasBrowser = await browserAvailable()

describe.skipIf(!hasBrowser)('committed capture frames', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'capture-frames-'))
    const { values, frames } = buildFrameValues({
      skills: listSkills(root).map((entry) => entry.name),
      gov: buildGovCatalog(root),
      toolingStacks: buildStackSummaries(root),
      commandCount: countCommands(root) ?? 0,
      tokenCss: buildDesignCss(undefined, { components: false }),
      markSvg: readFileSync(join(root, 'assets', 'brand', 'mark.svg'), 'utf8'),
    })
    const templates = readdirSync(templateDir)
      .filter((name) => name.endsWith('.html.tmpl'))
      .sort()
    mkdirSync(join(dir, 'src'))
    for (const { template, out, tokens } of frames(templates)) {
      const source = readFileSync(join(templateDir, template), 'utf8')
      writeFileSync(
        join(dir, 'src', out),
        fillTemplate(template, source, values, tokens),
      )
    }
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should name a real font on every text-bearing element', async () => {
    const results = await captureSources(join(dir, 'src'), {
      selector: '.window',
      outDir: join(dir, 'out'),
    })

    const genericFamilyReasons = results.flatMap((result) =>
      result.status === 'failed' && result.reason.includes('generic family')
        ? [`${result.source}: ${result.reason}`]
        : [],
    )
    expect(results.length).toBeGreaterThan(0)
    expect(genericFamilyReasons).toEqual([])
  }, 120_000)
})
