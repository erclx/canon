import type { Page } from '@playwright/test'

/** One addressable part of a route, captured beside the whole-page frame. */
export interface CaptureSection {
  name: string
  selector: string
}

export interface Viewport {
  readonly name: string
  readonly width: number
  readonly height: number
  /** Whether a case flagged `evidence: true` also writes its frames at this width. */
  readonly evidence: boolean
}

export interface CaptureCase {
  section: string
  theme: string
  route: string
  /** Names of viewports this case skips, for a route that reflows rather than breaks at that width. */
  excludeViewports?: readonly string[]
  evidence?: boolean
  /** Selectors painted over in every frame the case writes, for a value that moves between runs with no code change. */
  mask?: readonly string[]
  sections?: CaptureSection[]
  setup?: (page: Page) => Promise<void>
}

/** What the harness loads from the project's `e2e/capture/cases.ts`. */
export interface CaptureModule {
  CASES: CaptureCase[]
  /** Where a case flagged `evidence: true` writes its frames, relative to the working directory. */
  EVIDENCE_ROOT: string
}
