import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { renderDesignDocument } from '@/design/document'

/**
 * The record the token module renders, written by `canon design regen` and
 * asserted for drift by the `design` stage of `bun run check`. It is never
 * edited by hand. That is the cost the operator took on when the tokens moved
 * into a module: a regen step that has to run or the record goes stale
 * silently. The gate stage is what keeps silently out of it.
 */

/** The rendered record, at the path `claude/skills/design-record/references/design.md` fixes for it. */
export const DESIGN_DOCUMENT = join('canon', 'DESIGN.md')

export interface RegenResult {
  readonly documentPath: string
}

function write(root: string, rel: string, body: string): string {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
  return path
}

export function regenDesign(root: string): RegenResult {
  return {
    documentPath: write(root, DESIGN_DOCUMENT, renderDesignDocument()),
  }
}
