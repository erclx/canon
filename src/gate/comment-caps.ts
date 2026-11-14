import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { plural } from '@/cli/ui'
import {
  BODY_BLOCK_CAP,
  countFile,
  type DegradationHit,
  HISTORY_PATTERNS,
  HEAD_BLOCK_CAP,
  isPruned,
  type LanguageCount,
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

interface CapReading<T> {
  readonly clean: string
  readonly line: (finding: T) => string
  readonly failure: (count: number) => string
}

/**
 * Fails the runs `pick` returns from the files a change touched. Where scoping
 * is off it reports them without failing, since a full run reads every legacy
 * file nobody is editing.
 */
function capMeasure<T>(
  pick: (count: LanguageCount) => readonly T[],
  reading: CapReading<T>,
): Measure {
  return async (ctx: ScopedContext) => {
    const counted = await countRepository(ctx.root, ctx.changed)
    if (counted === undefined) return UNMEASURED

    const scope = plural(
      counted.files,
      ctx.changed === undefined ? 'source file' : 'touched source file',
    )
    const findings = counted.counts.flatMap(pick)
    if (findings.length === 0) {
      return {
        emissions: [{ kind: 'info', text: `${reading.clean} across ${scope}` }],
      }
    }

    const emissions = findings.map((finding) => ({
      kind: 'warn' as const,
      text: reading.line(finding),
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
    return { emissions, failure: reading.failure(findings.length) }
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

const HISTORY_TERMS = new Set(HISTORY_PATTERNS.map(({ term }) => term))

/** Fails a touched file's comment carrying a date, a commit hash, or an issue reference. */
export const commentHistory: Measure = capMeasure(
  (count): readonly DegradationHit[] =>
    count.degradationHits.filter((hit) => HISTORY_TERMS.has(hit.term)),
  {
    clean: 'No date, commit hash, or issue reference in a comment',
    line: (hit) => `${hit.file}:${hit.line} carries a ${hit.term} in a comment`,
    failure: (count) =>
      `${plural(count, 'comment')} carrying change history. Move the history to the pull request and keep the fact the code needs.`,
  },
)
