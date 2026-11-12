import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { plural } from '@/cli/ui'
import {
  BODY_BLOCK_CAP,
  countFile,
  FILE_LONG_BLOCK_CAP,
  isPruned,
  LONG_BLOCK_FLOOR,
  type LanguageCount,
  languageFor,
} from '@/comments/scan'
import type { Measure, MeasureReport } from '@/gate/measures'
import { listRepositoryFiles } from '@/git/files'

/**
 * Counts every source `canon comments scan` reads, tests, `sandbox/`, and
 * `scripts/` included, through the scan's own counter, so the report and the
 * gate agree on what a block is and where it sits. No exempt marker, since a
 * marker on a long comment is one more comment line.
 */
async function countRepository(
  root: string,
): Promise<{ counts: LanguageCount[]; files: number } | undefined> {
  const paths = await listRepositoryFiles(root)
  if (paths === undefined) return undefined

  const counts = paths.flatMap((path) => {
    const language = languageFor(path)
    if (language === undefined || isPruned(path)) return []
    const text = readFileSync(join(root, path), 'utf8')
    return [countFile({ path, text }, language)]
  })
  return { counts, files: counts.length }
}

const UNMEASURED: MeasureReport = {
  emissions: [],
  unmeasured:
    'The tracked file list could not be read, so no comment block was measured.',
}

/** Fails any comment run inside a function body past `BODY_BLOCK_CAP` lines. */
export const commentBodyBlocks: Measure = async (ctx) => {
  const counted = await countRepository(ctx.root)
  if (counted === undefined) return UNMEASURED

  const blocks = counted.counts.flatMap((count) => count.bodyBlocks)
  if (blocks.length === 0) {
    return {
      emissions: [
        {
          kind: 'info',
          text: `No in-body comment run past ${BODY_BLOCK_CAP} lines across ${plural(counted.files, 'source file')}`,
        },
      ],
    }
  }

  return {
    emissions: blocks.map((block) => ({
      kind: 'warn',
      text: `${block.file}:${block.line} runs ${block.lines} comment lines inside a function body, past ${BODY_BLOCK_CAP}`,
    })),
    failure: `${plural(blocks.length, 'in-body comment run')} past ${BODY_BLOCK_CAP} lines. Move the reason above the function or into the code it explains.`,
  }
}

/**
 * Fails any file holding more than `FILE_LONG_BLOCK_CAP` comment lines in runs
 * of `LONG_BLOCK_FLOOR` lines or more.
 */
export const commentFileLines: Measure = async (ctx) => {
  const counted = await countRepository(ctx.root)
  if (counted === undefined) return UNMEASURED

  const files = counted.counts
    .flatMap((count) => count.longBlockFiles)
    .filter((file) => file.lines > FILE_LONG_BLOCK_CAP)
  if (files.length === 0) {
    return {
      emissions: [
        {
          kind: 'info',
          text: `No file past ${FILE_LONG_BLOCK_CAP} lines in comment runs of ${LONG_BLOCK_FLOOR} or more across ${plural(counted.files, 'source file')}`,
        },
      ],
    }
  }

  return {
    emissions: files.map((file) => ({
      kind: 'warn',
      text: `${file.file} has ${file.lines} lines in comment runs of ${LONG_BLOCK_FLOOR} or more, past ${FILE_LONG_BLOCK_CAP}`,
    })),
    failure: `${plural(files.length, 'file')} past ${FILE_LONG_BLOCK_CAP} lines in long comment runs. Cut each run to the fact the code cannot carry.`,
  }
}
