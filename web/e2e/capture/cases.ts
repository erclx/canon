import type {
  CaptureCase,
  CaptureSection,
} from '../../../tooling/web/configs/e2e/capture-types'

/** Where a case flagged `evidence: true` writes its committed frames. */
export const EVIDENCE_ROOT = 'evidence'

/**
 * The landing page's nine sections, top to bottom. Every entry is a section a
 * reviewer reads on its own, so a diff lands on the part that moved rather
 * than on one image of the whole page.
 */
const HOME_SECTIONS: CaptureSection[] = [
  { name: 'top', selector: '#top' },
  { name: 'how', selector: '#how' },
  { name: 'groundwork', selector: '#groundwork' },
  { name: 'plan', selector: '#plan' },
  { name: 'dispatch', selector: '#dispatch' },
  { name: 'build', selector: '#build' },
  { name: 'review', selector: '#review' },
  { name: 'merge', selector: '#merge' },
  { name: 'start', selector: '#start' },
]

export const CASES: CaptureCase[] = [
  {
    section: 'home',
    theme: 'default',
    route: '/',
    evidence: true,
    sections: HOME_SECTIONS,
  },
  {
    section: 'home',
    theme: 'dark',
    route: '/',
    sections: HOME_SECTIONS,
    setup: (page) => page.emulateMedia({ colorScheme: 'dark' }),
  },
]
