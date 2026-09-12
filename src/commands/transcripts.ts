import { resolve } from 'node:path'
import type { Command } from 'commander'
import { recordDir } from '@/record-root'
import { ensureYtDlp, fetchOne } from '@/transcripts/fetch'
import { palette } from '@/ui'
import { mainWorktreeRoot } from '@/worktree'

interface TranscriptOptions {
  out?: string
  keepTimestamps?: boolean
}

/**
 * A caller-supplied `--out` resolves against the CWD, since naming a path
 * explicitly opts out of the backed default. With none, the destination is
 * the backed `transcripts` record folder at the main worktree root, which
 * `canon records push` and `canon records pull` carry along with the rest.
 */
export async function resolveOutDir(opts: TranscriptOptions): Promise<string> {
  return opts.out
    ? resolve(process.cwd(), opts.out)
    : recordDir(await mainWorktreeRoot(), 'transcripts')
}

export function register(program: Command): void {
  program
    .command('transcripts <url>')
    .description('Fetch a YouTube transcript with metadata frontmatter')
    .option(
      '-o, --out <path>',
      'Output directory, defaulting to the backed transcripts record folder',
    )
    .option(
      '--keep-timestamps',
      'Prefix each line with [mm:ss] instead of prose',
    )
    .action(async (url: string, opts: TranscriptOptions) => {
      const outDir = await resolveOutDir(opts)
      const { GREEN, GREY, NC, RED, WHITE } = palette(process.stderr)
      process.stderr.write(
        `${GREY}┌${NC}\n${GREY}│${NC} ${WHITE}canon transcripts${NC}\n`,
      )
      try {
        ensureYtDlp()
        const target = await fetchOne(url, {
          outDir,
          keepTimestamps: opts.keepTimestamps ?? false,
        })
        process.stdout.write(`${target}\n`)
        process.stderr.write(
          `${GREY}│${NC} ${GREEN}✓${NC} ${target}\n${GREY}└${NC}\n`,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(
          `${GREY}│${NC} ${RED}✗${NC} ${message}\n${GREY}└${NC}\n`,
        )
        process.exitCode = 1
      }
    })
}
