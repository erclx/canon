import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { claudeConfigDir } from '@/sessions/registry'

/**
 * The folder holding one subfolder per project the client has run in, each
 * carrying that project's transcripts.
 */
export function projectsDir(): string {
  return join(claudeConfigDir(), 'projects')
}

/**
 * The subfolder name the client files a project's transcripts under.
 *
 * Inferred from observed folders rather than read from a published rule:
 * every character outside `[A-Za-z0-9]` becomes a dash, so a dotted segment
 * doubles the dash before it. How a client shortens a path past its length
 * limit was never observed, so a very long path may land where `--continue`
 * does not look, while `--resume <id>` still finds it by walking every folder.
 */
export function encodeProjectPath(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, '-')
}

export interface TranscriptLocation {
  /** The project subfolder the transcript sits in. */
  readonly folder: string
  readonly transcript: string
  /** Where the client keeps the session's tool output and title, present or not. */
  readonly side: string
}

/**
 * A session id is a plain identifier, and admitting anything else would let
 * the id itself walk out of the projects folder.
 */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/

export function isSessionId(id: string): boolean {
  return SESSION_ID.test(id)
}

/**
 * Finds a session's transcript under any project subfolder.
 *
 * The walk crosses every folder rather than deriving one from the working
 * directory, since a transcript copied from another machine sits under that
 * machine's encoding and `--resume <id>` was measured to find it there.
 */
export function locateTranscript(
  id: string,
  dir: string = projectsDir(),
): TranscriptLocation | null {
  if (!isSessionId(id)) return null

  let folders: string[]
  try {
    folders = readdirSync(dir)
  } catch {
    return null
  }

  for (const name of folders) {
    const transcript = join(dir, name, `${id}.jsonl`)
    if (existsSync(transcript)) {
      return { folder: join(dir, name), transcript, side: join(dir, name, id) }
    }
  }

  return null
}

/**
 * Every file under a side folder by its path relative to it, or none when it
 * is absent. Paths use `/` on every platform, since they become archive entry
 * names and an import refuses a backslash as a path it cannot contain.
 */
export function readSideFolder(side: string): string[] {
  if (!existsSync(side)) return []

  return readdirSync(side, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(side, join(entry.parentPath, entry.name)).split(sep).join('/'),
    )
}

const NEWLINE = 0x0a

/**
 * Reads a transcript up to its last newline.
 *
 * The client appends a line per event, so a session exporting itself is
 * mid-write, and a copy taken at that moment can end on half a line. Cutting
 * at the last newline keeps every whole line and never rewrites one.
 */
export function readTranscript(path: string): Uint8Array {
  const bytes = readFileSync(path)
  const end = bytes.lastIndexOf(NEWLINE)
  return end === -1 ? new Uint8Array() : bytes.subarray(0, end + 1)
}

export interface TranscriptFacts {
  readonly title: string | null
  readonly cwd: string | null
  readonly startedAt: string | null
  readonly compacted: boolean
}

/**
 * Reads the few facts a manifest carries off a transcript's lines, without
 * changing any of them. The format belongs to the client, so a line that does
 * not parse is skipped rather than reported.
 */
export function transcriptFacts(bytes: Uint8Array): TranscriptFacts {
  let title: string | null = null
  let cwd: string | null = null
  let startedAt: string | null = null
  let compacted = false

  for (const line of new TextDecoder().decode(bytes).split('\n')) {
    if (!line) continue

    let record: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(line)
      if (typeof parsed !== 'object' || parsed === null) continue
      record = parsed as Record<string, unknown>
    } catch {
      continue
    }

    if (
      record.type === 'custom-title' &&
      typeof record.customTitle === 'string'
    ) {
      title = record.customTitle
    }
    if (typeof record.cwd === 'string') cwd = record.cwd
    if (startedAt === null && typeof record.timestamp === 'string') {
      startedAt = record.timestamp
    }
    if (record.subtype === 'compact_boundary') compacted = true
  }

  return { title, cwd, startedAt, compacted }
}
