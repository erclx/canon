import type { CaptureCase } from '../capture-types'

/** Where a case flagged `evidence: true` writes its committed frames. */
export const EVIDENCE_ROOT = 'e2e/evidence'

/**
 * One case per output file. Add a case per route and theme the project
 * renders, and name `sections` once the page has parts worth reviewing alone.
 */
export const CASES: CaptureCase[] = [
  {
    section: 'home',
    theme: 'default',
    route: '/',
    evidence: true,
  },
]
