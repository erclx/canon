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
  /**
   * Names of viewports this case skips, for a route that reflows rather than breaks at that width.
   * `320` defers the reflow check, which fails the run on a sideways scroll or a clipped control.
   * A name no viewport carries is warned on and ignored.
   */
  excludeViewports?: readonly string[]
  evidence?: boolean
  /**
   * The scope under `[device-classes.scopes]` in `canon/config/app.toml` whose classes this case captures at,
   * the config's default when absent. A name the config does not declare exits the run 1.
   */
  deviceScope?: string
  /** Selectors painted over in every frame the case writes, for a value that moves between runs with no code change. */
  mask?: readonly string[]
  sections?: CaptureSection[]
  setup?: (page: Page) => Promise<void>
}

/**
 * What the harness loads from the project's `e2e/capture/cases.ts` and from
 * each `e2e/capture/cases/*.ts`, concatenating their `CASES` with the single
 * file first and the folder in file-name order. Either form alone is enough.
 */
export interface CaptureModule {
  CASES: CaptureCase[]
  /**
   * Where a case flagged `evidence: true` writes its frames, relative to the
   * working directory. Read from `cases.ts` alone, and `e2e/evidence` when the
   * project holds the folder alone.
   */
  EVIDENCE_ROOT: string
}
