import type {
  CaptureCase,
  CaptureSection,
} from '../../../tooling/web/configs/e2e/capture-types'

/** Where a case flagged `evidence: true` writes its committed frames. */
export const EVIDENCE_ROOT = 'evidence'

/**
 * The landing page's own beats, top to bottom. Every entry is a section a
 * reviewer reads on its own, so a diff lands on the part that moved rather
 * than on one image of the whole page.
 */
const HOME_SECTIONS: CaptureSection[] = [
  { name: 'top', selector: '#top' },
  { name: 'proof', selector: '#proof' },
  { name: 'ask', selector: '#ask' },
  { name: 'rules', selector: '#rules' },
  { name: 'skills', selector: '#skills' },
  { name: 'plan', selector: '#plan' },
  { name: 'dispatch', selector: '#dispatch' },
  { name: 'workers', selector: '#workers' },
  { name: 'gate', selector: '#gate' },
  { name: 'evidence', selector: '#evidence' },
  { name: 'loop', selector: '#loop' },
  { name: 'merge', selector: '#merge' },
  { name: 'provenance', selector: '#provenance' },
  { name: 'start', selector: '#start' },
  { name: 'field', selector: '#field' },
  { name: 'close', selector: '#close' },
]

export const CASES: CaptureCase[] = [
  {
    section: 'home',
    theme: 'default',
    route: '/',
    evidence: true,
    mask: ['.version'],
    sections: HOME_SECTIONS,
  },
  {
    section: 'home',
    theme: 'dark',
    route: '/',
    mask: ['.version'],
    sections: HOME_SECTIONS,
    setup: (page) => page.emulateMedia({ colorScheme: 'dark' }),
  },
]
