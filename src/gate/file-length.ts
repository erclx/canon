import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { plural } from '@/cli/ui'
import { FILE_LINE_LIMIT, LENGTH_SOURCE, lineCount } from '@/code/length'
import type { Measure } from '@/gate/measures'
import { listRepositoryFiles } from '@/git/files'

/**
 * Fails any tracked code file past the line limit, tests included, so a file
 * no single read can return never lands. The extension set and the line rule
 * come from `code/length`, the module the length report reads, so the report
 * and the gate agree on what a file is. No baseline and no exempt marker: the
 * first file to cross fails.
 *
 * The listing is the tracked files plus untracked ones git does not ignore, and
 * leaves out a tracked path deleted in the working tree.
 */
export const fileLength: Measure = async (ctx) => {
  const files = await listRepositoryFiles(ctx.root)
  if (files === undefined) {
    return {
      emissions: [],
      unmeasured:
        'The tracked file list could not be read, so no file length was measured.',
    }
  }

  const sources = files.filter((path) => LENGTH_SOURCE.test(path))
  const long = sources
    .map((path) => ({
      path,
      lines: lineCount(readFileSync(join(ctx.root, path), 'utf8')),
    }))
    .filter((file) => file.lines > FILE_LINE_LIMIT)

  if (long.length === 0) {
    return {
      emissions: [
        {
          kind: 'info',
          text: `No code file past ${FILE_LINE_LIMIT} lines across ${plural(sources.length, 'source file')}`,
        },
      ],
    }
  }

  return {
    emissions: long.map((file) => ({
      kind: 'warn',
      text: `${file.path} has ${file.lines} lines, past the ${FILE_LINE_LIMIT} line limit`,
    })),
    failure: `${long.length} ${long.length === 1 ? 'file' : 'files'} past ${FILE_LINE_LIMIT} lines. Split each at a seam into files of their own, since a file past the limit cannot be read in one call.`,
  }
}
