import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'
import { injectConfigs, injectSeeds } from '@/tooling/inject'
import { resolveChain } from '@/tooling/manifest'

const HARNESS_REL = 'tooling/web/configs/e2e/screenshot.ts'
const MARKER = '\n// project edit\n'

let target: string

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'canon-capture-seed-'))
})

afterEach(() => {
  rmSync(target, { recursive: true, force: true })
})

/** Writes a case file under the target's `e2e/capture/`, one default-theme case per section named. */
const writeCases = (relative: string, sections: string[]): void => {
  const file = join(target, 'e2e/capture', relative)
  mkdirSync(join(file, '..'), { recursive: true })
  const cases = sections
    .map((section) => `{ section: '${section}', theme: 'default', route: '/' }`)
    .join(', ')
  writeFileSync(file, `export const CASES = [${cases}]\n`)
}

/** Runs the harness with a filter nothing matches, which lists every label and exits before a browser starts. */
const listLabels = () =>
  spawnSync('bun', [join(PROJECT_ROOT, HARNESS_REL)], {
    cwd: target,
    encoding: 'utf8',
    env: { ...process.env, SCREENSHOT_FILTER: 'no-such-label' },
  })

const sync = async (): Promise<void> => {
  const chain = resolveChain(PROJECT_ROOT, 'web')
  await injectConfigs(chain, target)
  await injectSeeds(chain, target)
}

describe('the capture cases seed', () => {
  it('seeds the cases once and lets sync overwrite only the harness', async () => {
    await sync()
    const cases = join(target, 'e2e/capture/cases.ts')
    const harness = join(target, 'e2e/screenshot.ts')
    appendFileSync(cases, MARKER)
    appendFileSync(harness, MARKER)

    await sync()

    expect(readFileSync(cases, 'utf8')).toContain(MARKER)
    expect(readFileSync(harness, 'utf8')).not.toContain(MARKER)
  })

  it('seeds cases that write evidence under e2e/evidence', async () => {
    await sync()

    const seeded = (await import(join(target, 'e2e/capture/cases.ts'))) as {
      CASES: unknown[]
      EVIDENCE_ROOT: string
    }

    expect(seeded.CASES.length).toBeGreaterThan(0)
    expect(seeded.EVIDENCE_ROOT).toBe('e2e/evidence')
  })

  it('seeds cases that name no section and no mask', async () => {
    await sync()

    const seeded = (await import(join(target, 'e2e/capture/cases.ts'))) as {
      CASES: Record<string, unknown>[]
    }

    expect(seeded.CASES.filter((c) => 'sections' in c || 'mask' in c)).toEqual(
      [],
    )
  })

  it('exits 1 naming the missing cases file instead of capturing nothing', () => {
    const result = spawnSync('bun', [join(PROJECT_ROOT, HARNESS_REL)], {
      cwd: target,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('e2e/capture/cases.ts')
  })
})

describe('the capture cases folder', () => {
  it('captures a project holding the folder alone', () => {
    writeCases('cases/menu.ts', ['menu'])

    const result = listLabels()

    expect(result.stderr).toContain('menu/1280--default')
  })

  it('reads the single file ahead of the folder, and the folder in file-name order', () => {
    writeCases('cases.ts', ['home'])
    writeCases('cases/b-search.ts', ['search'])
    writeCases('cases/a-menu.ts', ['menu'])

    const result = listLabels()
    const order = ['home', 'menu', 'search'].map((section) =>
      result.stderr.indexOf(`${section}/1280--default`),
    )

    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('exits 1 naming both files when two cases write one output file', () => {
    writeCases('cases.ts', ['home'])
    writeCases('cases/home.ts', ['home'])

    const result = listLabels()

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(
      /home\/1280--default.*cases\.ts.*cases\/home\.ts/s,
    )
  })

  it('warns on an excluded viewport name no viewport carries', () => {
    mkdirSync(join(target, 'e2e/capture'), { recursive: true })
    writeFileSync(
      join(target, 'e2e/capture/cases.ts'),
      "export const CASES = [{ section: 'home', theme: 'default', route: '/', excludeViewports: ['1600'] }]\n",
    )

    const result = listLabels()

    expect(result.stderr).toMatch(/home.*'1600'/)
  })
})
