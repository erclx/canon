import { createHash } from 'node:crypto'
import { basename, dirname, extname, join } from 'node:path'

const HASH_ALGORITHM = 'sha256'
const STAMP_EXTENSION = '.stamp'

/**
 * Provenance for one rendered PNG: the markup it came from and a digest over
 * each side of the pair. Nothing reads the digests back today, so no check
 * fails when either side moves.
 *
 * Both sides are recorded because either can move alone. The markup digest
 * would show an edit committed with no capture, and the image digest a PNG
 * replaced under markup that never changed.
 */
export interface CaptureStamp {
  readonly source: string
  readonly sourceSha256: string
  readonly imageSha256: string
}

/**
 * A capture writes its stamp beside its PNG rather than beside its HTML,
 * because `--out` moves the image away from the source and the stamp answers a
 * question about the image.
 */
export function stampPath(pngPath: string): string {
  return join(
    dirname(pngPath),
    `${basename(pngPath, extname(pngPath))}${STAMP_EXTENSION}`,
  )
}

/**
 * Digests the whole file rather than the counts inside it. A template edit
 * changes what the image shows without moving any count, and the whole point of
 * the stamp is that it needs no knowledge of what the markup renders.
 */
export function hashSource(bytes: Uint8Array): string {
  return createHash(HASH_ALGORITHM).update(bytes).digest('hex')
}

export function formatStamp(stamp: CaptureStamp): string {
  return [
    `source: ${stamp.source}`,
    `source-sha256: ${stamp.sourceSha256}`,
    `image-sha256: ${stamp.imageSha256}`,
    '',
  ].join('\n')
}
