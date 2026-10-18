import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

  it('exits 1 naming the missing cases file instead of capturing nothing', () => {
    const result = spawnSync('bun', [join(PROJECT_ROOT, HARNESS_REL)], {
      cwd: target,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('e2e/capture/cases.ts is missing')
  })
})
