import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll } from 'vitest'

/**
 * Redirects this machine's toolkit state for the whole run, since `putDomain`
 * records every stamped target into the machine-level registry and a stamp test
 * would leave fixture paths in the runner's state folder.
 */
const STATE = mkdtempSync(join(tmpdir(), 'canon-test-state-'))

process.env.CANON_STATE_DIR = STATE

afterAll(() => {
  rmSync(STATE, { recursive: true, force: true })
})
