/**
 * Fills every assets/captures/*.html.tmpl from the catalogs and the design
 * source, writing the .html beside each one.
 *
 * The name says hero because the hero was the only template when it was written
 * and every citation of it across docs/, canon/context/, and src/ spells that
 * name. The loop below covers whatever templates the folder holds.
 *
 * Each catalog is read through the module its `canon` verb calls, so no child
 * process runs and no stderr is discarded. The palette arrives from
 * `buildDesignCss` without the component half, which is a scrollbar and a
 * status marker a static capture frame renders neither of. The value builder
 * and every guard live in `src/capture/frame-values.ts`, where tsc and vitest
 * reach them.
 *
 * `--check` fills every template into a temp folder and discards it, so a
 * renamed featured skill, an empty catalog, or an unresolved placeholder still
 * fails a branch while no frame file changes. Frames are refreshed after a
 * merge rather than committed by each branch.
 *
 * Only the HTML regenerates here. The PNG beside it is a chromium render whose
 * bytes move with the browser version. Rebuild the images with
 * `canon capture assets/captures --selector .window --out assets/evidence`
 * after this script reports a change. That capture writes a .stamp beside each
 * PNG, which records the digest of the markup it rendered and is what the Hero
 * stage compares, so a frame's three files commit together. The frame carries
 * no version, since `package.json` is bumped on main by the release tooling and
 * embedding it would drift every open branch on the next release.
 *
 * Clone-only. This script reads the repository's own catalogs and
 * `assets/captures`, which a registry install does not carry.
 */
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

import {
  buildFrameValues,
  FrameError,
  fillTemplate,
} from '../../src/capture/frame-values'
import { listSkills } from '../../src/claude/skills-list'
import { countCommands } from '../../src/counts/catalogs'
import { buildDesignCss } from '../../src/design/css'
import { buildGovCatalog } from '../../src/gov/list'
import { listStandardEntries } from '../../src/standards/list'
import { buildStackSummaries } from '../../src/tooling/list'

const root = new URL('../..', import.meta.url).pathname
const assetDir = join(root, 'assets', 'captures')

const [flag, ...extra] = process.argv.slice(2)
if (flag !== undefined && flag !== '--check') {
  console.error(`regen-hero: unknown argument ${flag}`)
  process.exit(1)
}
if (extra.length > 0) {
  console.error(`regen-hero: unknown argument ${extra[0]}`)
  process.exit(1)
}

const outDir =
  flag === '--check' ? mkdtempSync(join(tmpdir(), 'regen-hero-')) : assetDir

function run(): void {
  const templates = readdirSync(assetDir)
    .filter((name) => name.endsWith('.html.tmpl'))
    .sort()
  if (templates.length === 0) {
    throw new FrameError(`no templates under ${assetDir}`)
  }

  const tokenCss = buildDesignCss(undefined, { components: false })
  if (!tokenCss.trim()) {
    throw new FrameError(
      'the design source emitted nothing, refusing to write an unstyled frame',
    )
  }

  const { values, frames } = buildFrameValues({
    skills: listSkills(root).map((entry) => entry.name),
    gov: buildGovCatalog(root),
    // The toolkit root only: a project-local standard would put a row in the
    // hero the toolkit does not ship.
    standards: listStandardEntries(root).filter((entry) =>
      entry.source.startsWith('standards/'),
    ),
    toolingStacks: buildStackSummaries(root),
    commandCount: countCommands(root) ?? 0,
    tokenCss,
    markSvg: readFileSync(join(root, 'assets', 'brand', 'mark.svg'), 'utf8'),
  })

  mkdirSync(outDir, { recursive: true })
  for (const { template, out, tokens } of frames(templates)) {
    const source = readFileSync(join(assetDir, template), 'utf8')
    writeFileSync(
      join(outDir, out),
      fillTemplate(template, source, values, tokens),
    )
  }
}

try {
  run()
} catch (error) {
  if (!(error instanceof FrameError)) throw error
  console.error(`regen-hero: ${error.message}`)
  process.exitCode = 1
} finally {
  if (outDir !== assetDir) rmSync(outDir, { recursive: true, force: true })
}
