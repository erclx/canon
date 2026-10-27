/**
 * The pure half of `scripts/core/design-sync.ts`, ported from Frameboard's
 * own sync. Frameboard frames load a shared kit, while this board's frames
 * load their project's `../assets/`, so each project's assets land under
 * `kit/<project>/` in `canon/design/` and no two projects can overwrite one
 * another's files of the same name.
 */

/** A `frames.json` entry the sync cannot capture, named so the file can be fixed. */
export class MappingError extends Error {}

const REFERENCE = /^[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*$/
const BOARD_REF = /^[^/\s]+\/[^/\s]+\/[^/\s]+$/
const BOARD_ASSETS = '../assets/'
const BOARD_ASSET = /\.\.\/assets\/([^"'()\s]+)/g

/**
 * Reads `frames.json`, mapping each reference, `<group>/<name>`, to the
 * board frame `<project>/<page>/<frame>` it is captured from. An entry in
 * any other shape throws rather than filing into the wrong folder.
 */
export function parseFrameMap(json: string): Map<string, string> {
  const parsed: unknown = JSON.parse(json)
  const frames =
    typeof parsed === 'object' && parsed !== null && 'frames' in parsed
      ? parsed.frames
      : undefined
  if (typeof frames !== 'object' || frames === null) {
    throw new MappingError('frames.json needs a frames object.')
  }
  const map = new Map<string, string>()
  for (const [reference, ref] of Object.entries(frames)) {
    if (!REFERENCE.test(reference)) {
      throw new MappingError(
        `frames.json entry "${reference}" needs a kebab-case <group>/<name>.`,
      )
    }
    if (typeof ref !== 'string' || !BOARD_REF.test(ref)) {
      throw new MappingError(
        `frames.json entry "${reference}" needs a board frame as <project>/<page>/<frame>.`,
      )
    }
    map.set(reference, ref)
  }
  return map
}

/** The mapped board frames the board does not hold. */
export function missingFrames(
  map: ReadonlyMap<string, string>,
  board: ReadonlySet<string>,
): string[] {
  return [...map.values()].filter((ref) => !board.has(ref))
}

/**
 * What the folder holds of a board frame: its project asset links moved to
 * the project's kit, every other link left as the frame wrote it. The HTML
 * is not reformatted, since the formatter ignores the folder and the sync is
 * its one writer.
 */
export function toReference(html: string, project: string): string {
  return html.replaceAll(BOARD_ASSETS, `../kit/${project}/`)
}

/** The project assets a frame loads, by their path under `assets/`, each once. */
export function boardAssets(html: string): string[] {
  return [...new Set([...html.matchAll(BOARD_ASSET)].map((match) => match[1]))]
}

export interface Drift {
  readonly changed: readonly string[]
  /** PNGs whose bytes differ, a warning since a PNG varies with the browser build. */
  readonly pngDiffers: readonly string[]
  readonly missing: readonly string[]
  readonly stray: readonly string[]
}

/** Compares what a sync would write against the files the folder holds, the HTML as the source and a PNG as derived. */
export function classifyDrift(
  expected: ReadonlyMap<string, string | Uint8Array>,
  tracked: ReadonlyMap<string, string | Uint8Array>,
): Drift {
  const changed: string[] = []
  const pngDiffers: string[] = []
  const missing: string[] = []
  for (const [path, data] of expected) {
    const copy = tracked.get(path)
    if (copy === undefined) missing.push(path)
    else if (!Buffer.from(copy).equals(Buffer.from(data))) {
      ;(path.endsWith('.png') ? pngDiffers : changed).push(path)
    }
  }
  const stray = [...tracked.keys()].filter((path) => !expected.has(path))
  return { changed, pngDiffers, missing, stray }
}
