import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { plural } from '@/cli/ui'
import {
  BODY_BLOCK_CAP,
  countFile,
  FILE_LONG_BLOCK_CAP,
  HEAD_BLOCK_CAP,
  isPruned,
  LONG_BLOCK_FLOOR,
  type LanguageCount,
  type LongBlock,
  languageFor,
} from '@/comments/scan'
import type { Measure, MeasureContext, MeasureReport } from '@/gate/measures'
import { listRepositoryFiles } from '@/git/files'

/**
 * Counts every source `canon comments scan` reads, tests, `sandbox/`, and
 * `scripts/` included, through the scan's own counter, so the report and the
 * gate agree on what a block is and where it sits. A changed set narrows the
 * count to the files a change touched. No exempt marker, since a marker on a
 * long comment is one more comment line.
 */
async function countRepository(
  root: string,
  changed?: readonly string[],
): Promise<{ counts: LanguageCount[]; files: number } | undefined> {
  const paths = await listRepositoryFiles(root)
  if (paths === undefined) return undefined
  const touched = changed === undefined ? undefined : new Set(changed)

  const counts = paths.flatMap((path) => {
    const language = languageFor(path)
    if (language === undefined || isPruned(path)) return []
    if (touched !== undefined && !touched.has(path)) return []
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

/**
 * The sequencer hands every measure its whole gate context, which carries the
 * changed set where scoping is on and none under `--all` or a widening fallback.
 */
interface ScopedContext extends MeasureContext {
  readonly changed?: readonly string[]
}

interface CapReading {
  readonly clean: string
  readonly line: (block: LongBlock) => string
  readonly failure: (count: number) => string
}

/**
 * Fails the runs `pick` returns from the files a change touched. Where scoping
 * is off it reports them without failing, since a full run reads every legacy
 * file nobody is editing.
 */
function capMeasure(
  pick: (count: LanguageCount) => readonly LongBlock[],
  reading: CapReading,
): Measure {
  return async (ctx: ScopedContext) => {
    const counted = await countRepository(ctx.root, ctx.changed)
    if (counted === undefined) return UNMEASURED

    const scope = plural(
      counted.files,
      ctx.changed === undefined ? 'source file' : 'touched source file',
    )
    const blocks = counted.counts.flatMap(pick)
    if (blocks.length === 0) {
      return {
        emissions: [{ kind: 'info', text: `${reading.clean} across ${scope}` }],
      }
    }

    const emissions = blocks.map((block) => ({
      kind: 'warn' as const,
      text: reading.line(block),
    }))
    if (ctx.changed === undefined) {
      return {
        emissions: [
          ...emissions,
          {
            kind: 'info',
            text: `Reported across ${scope} and not failed, since only a touched file fails`,
          },
        ],
      }
    }
    return { emissions, failure: reading.failure(blocks.length) }
  }
}

/** Fails a touched file's run outside every function body past `HEAD_BLOCK_CAP` lines. */
export const commentHeadBlocks: Measure = capMeasure(
  (count) => count.headBlocks,
  {
    clean: `No head comment run past ${HEAD_BLOCK_CAP} lines`,
    line: (block) =>
      `${block.file}:${block.line} runs ${block.lines} comment lines outside a function body, past ${HEAD_BLOCK_CAP}`,
    failure: (count) =>
      `${plural(count, 'head comment run')} past ${HEAD_BLOCK_CAP} lines. Cut each to the contract or the constraint the code cannot carry.`,
  },
)

/** Fails a touched file's run inside a function body past `BODY_BLOCK_CAP` lines. */
export const commentBodyBlocks: Measure = capMeasure(
  (count) => count.bodyBlocks,
  {
    clean: `No in-body comment run past ${BODY_BLOCK_CAP} lines`,
    line: (block) =>
      `${block.file}:${block.line} runs ${block.lines} comment lines inside a function body, past ${BODY_BLOCK_CAP}`,
    failure: (count) =>
      `${plural(count, 'in-body comment run')} past ${BODY_BLOCK_CAP} lines. Move the reason above the function or into the code it explains.`,
  },
)

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
