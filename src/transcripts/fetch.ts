import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { execa } from 'execa'
import {
  type VideoMetadata,
  formatUploadDate,
  renderFrontmatter,
  slugify,
} from '@/transcripts/metadata'
import { dedupeRollingCues, parseVtt, renderBody } from '@/transcripts/vtt'

const YT_DLP_TIMEOUT_MS = 120_000

export function ensureYtDlp(): void {
  if (Bun.which('yt-dlp') === null) {
    throw new Error(
      'yt-dlp not found on PATH. Install it from https://github.com/yt-dlp/yt-dlp.',
    )
  }
}

interface FetchResult {
  readonly metadata: VideoMetadata
  readonly subPath: string | null
}

async function runYtDlp(url: string, workDir: string): Promise<FetchResult> {
  const outputTemplate = join(workDir, '%(id)s.%(ext)s')
  let stdout: string
  try {
    const result = await execa(
      'yt-dlp',
      [
        '--dump-json',
        '--no-simulate',
        '--write-sub',
        '--write-auto-sub',
        '--sub-langs',
        'en,en-orig',
        '--sub-format',
        'vtt',
        '--skip-download',
        '-o',
        outputTemplate,
        url,
      ],
      { timeout: YT_DLP_TIMEOUT_MS },
    )
    stdout = result.stdout
  } catch (error) {
    throw new Error(`yt-dlp failed for ${url}: ${lastLine(error)}`)
  }

  const info = JSON.parse(stdout) as Record<string, unknown>
  const videoId = String(info['id'] ?? '').trim()
  if (!videoId) throw new Error('yt-dlp returned no video id')

  const metadata: VideoMetadata = {
    videoId,
    title: String(info['title'] || 'untitled'),
    channel: String(info['channel'] || info['uploader'] || 'unknown'),
    durationSeconds: Number(info['duration'] || 0),
    published: formatUploadDate(asString(info['upload_date'])),
    url: String(info['webpage_url'] || url),
  }
  const subPath = findSubtitle(workDir, videoId)
  return { metadata, subPath }
}

interface WriteOptions {
  readonly outDir: string
  readonly keepTimestamps: boolean
  readonly fetchedAt: string
}

const INDEX_FILE = 'index.md'

/**
 * Writes a minimal index.md stub if the output directory carries none yet,
 * so `canon indexes regen` has frontmatter to render entries against. Left
 * alone once present, since a project may have customized it.
 */
function ensureIndex(outDir: string): void {
  const indexPath = join(outDir, INDEX_FILE)
  if (existsSync(indexPath)) return

  const content = [
    '---',
    'title: Transcripts',
    'subtitle: YouTube transcripts fetched by canon transcripts, one file per video.',
    '---',
    '',
    '# Transcripts',
    '',
    'YouTube transcripts fetched by canon transcripts, one file per video.',
    '',
    'This folder is machine-written. Run canon indexes regen here to refresh its entries.',
    '',
  ].join('\n')

  writeFileSync(indexPath, content)
}

export function writeTranscript(
  metadata: VideoMetadata,
  subPath: string | null,
  { outDir, keepTimestamps, fetchedAt }: WriteOptions,
): string {
  mkdirSync(outDir, { recursive: true })
  ensureIndex(outDir)
  const slug = `${fetchedAt}--${slugify(metadata.title)}--${metadata.videoId}`
  const target = join(outDir, `${slug}.md`)

  const hasTranscript = subPath !== null
  let body = ''
  if (subPath !== null) {
    const cues = parseVtt(readFileSync(subPath, 'utf8'))
    body = renderBody(dedupeRollingCues(cues), { keepTimestamps })
  } else {
    body =
      'Transcript unavailable. Auto-captions are not enabled for this video.\n'
  }

  const frontmatter = renderFrontmatter(metadata, { hasTranscript, fetchedAt })
  const heading = `# ${metadata.title}\n\n`
  writeFileSync(target, frontmatter + heading + body)
  return target
}

interface FetchOptions {
  readonly outDir: string
  readonly keepTimestamps: boolean
}

export async function fetchOne(
  url: string,
  { outDir, keepTimestamps }: FetchOptions,
): Promise<string> {
  const workDir = mkdtempSync(join(tmpdir(), 'yt-transcripts-'))
  try {
    const { metadata, subPath } = await runYtDlp(url, workDir)
    return writeTranscript(metadata, subPath, {
      outDir,
      keepTimestamps,
      fetchedAt: todayLocal(),
    })
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

function findSubtitle(workDir: string, videoId: string): string | null {
  const matches = readdirSync(workDir)
    .filter((name) => name.startsWith(videoId) && name.endsWith('.vtt'))
    .sort()
  return matches.length ? join(workDir, matches[0]) : null
}

function todayLocal(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function lastLine(error: unknown): string {
  const stderr =
    error instanceof Error && 'stderr' in error ? String(error.stderr) : ''
  const lines = stderr.trim().split('\n').filter(Boolean)
  if (lines.length) return lines[lines.length - 1]
  return error instanceof Error ? error.message : String(error)
}
