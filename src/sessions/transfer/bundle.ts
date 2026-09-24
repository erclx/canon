import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git-env'
import { recordDir, recordRoot, SCRATCH } from '@/record-root'
import { remoteIdentity } from '@/records/backup'
import {
  encodeProjectPath,
  isSessionId,
  locateTranscript,
  projectsDir,
  readSideFolder,
  readTranscript,
  transcriptFacts,
} from '@/sessions/transfer/transcript'

/** Bumped when a field changes meaning, so an older import refuses a newer bundle. */
export const BUNDLE_FORMAT = 1

/**
 * What travels beside the transcript, so the target can tell whether its own
 * checkout is ready to resume the session and which route to take.
 */
export interface Manifest {
  readonly format: number
  readonly sessionId: string
  readonly title: string | null
  /** The working directory the transcript last recorded. */
  readonly cwd: string | null
  /** The main worktree root of the repository the export read. */
  readonly root: string
  /** The `origin` remote reduced to `host/path`, or null where none is set. */
  readonly origin: string | null
  readonly branch: string | null
  readonly head: string | null
  /** The records history `HEAD`, or null where no records history exists. */
  readonly recordsHead: string | null
  readonly compacted: boolean
  /** Whether the id was live in the roster at export, so a resume would fork it. */
  readonly live: boolean
  /** The newest compact note written since the session began, relative to the root. */
  readonly handoff: string | null
  /** Whether that note is committed in the records history. */
  readonly handoffCommitted: boolean
  readonly recommend: 'handoff' | 'transcript'
}

export type TransferRefusal =
  | 'no-archive'
  | 'not-found'
  | 'not-a-bundle'
  | 'other-repository'
  | 'exists'
  | 'live-here'
  | 'write-failed'

/** A lag the import reports and does not refuse on, since each has a remedy the reader runs. */
export type Behind = 'repository-behind' | 'records-behind'

export interface TransferRefused {
  readonly ok: false
  readonly reason: TransferRefusal
  readonly message: string
}

function refuse(reason: TransferRefusal, message: string): TransferRefused {
  return { ok: false, reason, message }
}

const MANIFEST_PATH = 'manifest.json'
const SESSION_FOLDER = 'session'

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== 'object' || value === null) return false
  const manifest = value as Partial<Manifest>
  return (
    manifest.format === BUNDLE_FORMAT &&
    typeof manifest.sessionId === 'string' &&
    isSessionId(manifest.sessionId) &&
    typeof manifest.root === 'string' &&
    (manifest.origin === null || typeof manifest.origin === 'string') &&
    (manifest.head === null || typeof manifest.head === 'string') &&
    (manifest.recordsHead === null ||
      typeof manifest.recordsHead === 'string') &&
    (manifest.recommend === 'handoff' || manifest.recommend === 'transcript')
  )
}

/**
 * `Bun.Archive` landed in a Bun the package declares no floor for, so an older
 * runtime meets a missing constructor rather than a missing dependency.
 */
function archiveUnavailable(): TransferRefused | undefined {
  if (typeof Bun.Archive === 'function') return undefined
  return refuse(
    'no-archive',
    `This Bun (${Bun.version}) has no Bun.Archive, so no bundle can be packed or read. Upgrade Bun and re-run.`,
  )
}

async function gitRead(cwd: string, args: string[]): Promise<string | null> {
  const result = await $`git -C ${cwd} ${args}`.env(gitEnv()).quiet().nothrow()
  if (result.exitCode !== 0) return null
  const text = result.stdout.toString().trim()
  return text.length > 0 ? text : null
}

async function hasCommit(gitArgs: string[], sha: string): Promise<boolean> {
  const result = await $`git ${gitArgs} cat-file -e ${`${sha}^{commit}`}`
    .env(gitEnv())
    .quiet()
    .nothrow()
  return result.exitCode === 0
}

/**
 * The main worktree root of the repository at `cwd`, read off the shared git
 * directory so a linked worktree answers with the checkout its records sit at.
 */
async function repositoryRoot(cwd: string): Promise<string> {
  const common = await gitRead(cwd, [
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ])
  if (common === null) return cwd
  return basename(common) === '.git' ? dirname(common) : common
}

async function originIdentity(root: string): Promise<string | null> {
  const url = await gitRead(root, ['remote', 'get-url', 'origin'])
  return url === null ? null : remoteIdentity(url)
}

function recordsGitDir(root: string): string {
  return join(recordRoot(root), '.records.git')
}

async function recordsHead(root: string): Promise<string | null> {
  const dir = recordsGitDir(root)
  if (!existsSync(dir)) return null
  return gitRead(root, [`--git-dir=${dir}`, 'rev-parse', 'HEAD'])
}

/**
 * The newest compact note modified since the transcript's first timestamp.
 * A note older than the session was written for a different one.
 */
function newestHandoff(root: string, startedAt: string | null): string | null {
  const dir = recordDir(root, 'compact')
  if (!existsSync(dir)) return null

  const since = startedAt === null ? 0 : Date.parse(startedAt)
  let newest: { path: string; at: number } | null = null

  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue
    const path = join(dir, name)
    const at = statSync(path).mtimeMs
    if (at >= since && (newest === null || at > newest.at)) {
      newest = { path, at }
    }
  }

  return newest === null ? null : newest.path
}

async function isCommittedInRecords(
  root: string,
  note: string,
): Promise<boolean> {
  const dir = recordsGitDir(root)
  if (!existsSync(dir)) return false
  const inside = relative(recordRoot(root), note)
  const result = await $`git --git-dir=${dir} cat-file -e ${`HEAD:${inside}`}`
    .env(gitEnv())
    .quiet()
    .nothrow()
  return result.exitCode === 0
}

export interface ExportOptions {
  readonly id: string
  /** Where the repository facts are read. Defaults to the working directory. */
  readonly cwd?: string
  readonly projects?: string
  readonly out?: string
  readonly isLive: (id: string) => Promise<boolean>
}

export type ExportOutcome =
  | {
      readonly ok: true
      readonly path: string
      readonly manifest: Manifest
      readonly files: readonly string[]
    }
  | TransferRefused

/**
 * Packs a session's transcript, its side folder with paths kept, and a
 * manifest into one gzip tarball on local disk. Nothing is uploaded.
 */
export async function exportSession(
  options: ExportOptions,
): Promise<ExportOutcome> {
  const unavailable = archiveUnavailable()
  if (unavailable) return unavailable

  const location = locateTranscript(
    options.id,
    options.projects ?? projectsDir(),
  )
  if (location === null) {
    return refuse(
      'not-found',
      `No transcript for ${options.id} under ${options.projects ?? projectsDir()}. Check the id with canon sessions list --json, which carries sessionId per row.`,
    )
  }

  const transcript = readTranscript(location.transcript)
  const facts = transcriptFacts(transcript)
  // The branch and HEAD come from the checkout the caller stands in, which is
  // the linked worktree a worker builds in, while the records and the handoff
  // sit at the main root every worktree shares.
  const cwd = options.cwd ?? process.cwd()
  const root = await repositoryRoot(cwd)
  const handoffPath = newestHandoff(root, facts.startedAt)

  const manifest: Manifest = {
    format: BUNDLE_FORMAT,
    sessionId: options.id,
    title: facts.title,
    cwd: facts.cwd,
    root,
    origin: await originIdentity(root),
    branch: await gitRead(cwd, ['branch', '--show-current']),
    head: await gitRead(cwd, ['rev-parse', 'HEAD']),
    recordsHead: await recordsHead(root),
    compacted: facts.compacted,
    live: await options.isLive(options.id),
    handoff: handoffPath === null ? null : relative(root, handoffPath),
    handoffCommitted:
      handoffPath !== null && (await isCommittedInRecords(root, handoffPath)),
    recommend: handoffPath === null ? 'transcript' : 'handoff',
  }

  const side = readSideFolder(location.side)
  const entries: Record<string, Uint8Array | string> = {
    [MANIFEST_PATH]: `${JSON.stringify(manifest, null, 2)}\n`,
    [`${SESSION_FOLDER}/${options.id}.jsonl`]: transcript,
  }
  for (const file of side) {
    entries[`${SESSION_FOLDER}/${options.id}/${file}`] = readFileSync(
      join(location.side, file),
    )
  }

  const path =
    options.out ??
    recordDir(root, SCRATCH, 'session-export', `${options.id}.tar.gz`)
  mkdirSync(dirname(path), { recursive: true })
  const archive = new Bun.Archive(entries, { compress: 'gzip' })
  writeFileSync(path, await archive.bytes())

  return { ok: true, path, manifest, files: side }
}

interface Unpacked {
  readonly manifest: Manifest
  readonly transcript: Uint8Array
  /** Side folder files keyed by their path relative to the side folder. */
  readonly side: ReadonlyMap<string, Uint8Array>
}

/**
 * Whether an archive entry name stays inside the folder it is written under.
 * A bundle is a file handed over from another machine, so its names are input.
 */
function isContained(name: string): boolean {
  return (
    !isAbsolute(name) &&
    !name.includes('\\') &&
    !name.split('/').some((segment) => segment === '..' || segment === '')
  )
}

async function unpack(bytes: Uint8Array): Promise<Unpacked | TransferRefused> {
  let files: Map<string, File>
  try {
    files = await new Bun.Archive(bytes).files()
  } catch {
    return refuse('not-a-bundle', 'The file does not read as a gzip tarball.')
  }

  const raw = files.get(MANIFEST_PATH)
  let manifest: unknown
  try {
    manifest = raw ? JSON.parse(await raw.text()) : undefined
  } catch {
    manifest = undefined
  }
  if (!isManifest(manifest)) {
    return refuse(
      'not-a-bundle',
      `The archive carries no ${MANIFEST_PATH} this binary reads, or one at a format other than ${BUNDLE_FORMAT}.`,
    )
  }

  const transcriptName = `${SESSION_FOLDER}/${manifest.sessionId}.jsonl`
  const sidePrefix = `${SESSION_FOLDER}/${manifest.sessionId}/`
  let transcript: Uint8Array | undefined
  const side = new Map<string, Uint8Array>()

  for (const [name, file] of files) {
    if (name === MANIFEST_PATH) continue
    const inside = name.startsWith(sidePrefix)
      ? name.slice(sidePrefix.length)
      : null

    if (name === transcriptName) {
      transcript = await file.bytes()
    } else if (inside !== null && isContained(inside)) {
      side.set(inside, await file.bytes())
    } else {
      return refuse(
        'not-a-bundle',
        `The archive carries ${JSON.stringify(name)}, which sits outside the session it names. Nothing was written.`,
      )
    }
  }

  if (transcript === undefined) {
    return refuse(
      'not-a-bundle',
      `The archive carries no ${transcriptName}, so there is no transcript to place.`,
    )
  }

  return { manifest, transcript, side }
}

/** Removes a directory tree bottom-up, keeping any folder that still holds a file. */
function pruneEmpty(dir: string): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.isDirectory()) pruneEmpty(join(dir, entry.name))
  }
  try {
    rmdirSync(dir)
  } catch {
    // Not empty, so something besides this run's files sits there.
  }
}

/**
 * Removes the files an import wrote and the folders it created, and returns
 * whatever could not be removed. A folder is removed only once empty, so a
 * file some other writer placed there in the meantime survives.
 */
function rollBack(
  written: readonly string[],
  created: readonly string[],
): string[] {
  const left: string[] = []
  for (const path of written) {
    try {
      unlinkSync(path)
    } catch {
      left.push(path)
    }
  }
  for (const dir of [...created].reverse()) pruneEmpty(dir)
  return left
}

export interface ImportOptions {
  readonly bundle: string
  /** The repository the session resumes in, which decides the encoded folder. */
  readonly root: string
  readonly projects?: string
  readonly isLive: (id: string) => Promise<boolean>
}

export type ImportOutcome =
  | {
      readonly ok: true
      readonly manifest: Manifest
      readonly folder: string
      readonly transcript: string
      readonly files: readonly string[]
      readonly behind: readonly Behind[]
      readonly routes: readonly string[]
    }
  | TransferRefused

/**
 * Places a bundle's transcript and side folder under the local encoding of
 * `root`, refusing rather than overwriting anything already there.
 */
export async function importSession(
  options: ImportOptions,
): Promise<ImportOutcome> {
  const unavailable = archiveUnavailable()
  if (unavailable) return unavailable

  let bytes: Uint8Array
  try {
    bytes = readFileSync(options.bundle)
  } catch {
    return refuse('not-a-bundle', `No readable file at ${options.bundle}.`)
  }

  const unpacked = await unpack(bytes)
  if ('ok' in unpacked) return unpacked
  const { manifest } = unpacked
  const id = manifest.sessionId

  const origin = await originIdentity(options.root)
  if (origin !== manifest.origin) {
    return refuse(
      'other-repository',
      `The bundle came from ${manifest.origin ?? 'a repository with no origin'}, and ${options.root} is ${origin ?? 'a repository with no origin'}. Import it inside a checkout of the same repository.`,
    )
  }

  if (await options.isLive(id)) {
    return refuse(
      'live-here',
      `Session ${id} is live on this machine, so placing a second copy would fork it. End that session first.`,
    )
  }

  const projects = options.projects ?? projectsDir()
  const folder = join(projects, encodeProjectPath(options.root))
  const transcript = join(folder, `${id}.jsonl`)
  const sideDir = join(folder, id)
  // A copy under any other project folder counts too, since `--resume <id>`
  // walks every folder and would pick whichever copy it reached first.
  const elsewhere = locateTranscript(id, projects)?.transcript
  const taken = [
    ...new Set(
      [transcript, sideDir, elsewhere].filter(
        (path): path is string => path !== undefined && existsSync(path),
      ),
    ),
  ]
  if (taken.length > 0) {
    return refuse(
      'exists',
      `Already present: ${taken.join(', ')}. Nothing was written, so move the existing copy aside if the bundle should replace it.`,
    )
  }

  const behind: Behind[] = []
  if (
    manifest.head !== null &&
    !(await hasCommit(['-C', options.root], manifest.head))
  ) {
    behind.push('repository-behind')
  }
  if (manifest.recordsHead !== null) {
    const dir = recordsGitDir(options.root)
    if (
      !existsSync(dir) ||
      !(await hasCommit([`--git-dir=${dir}`], manifest.recordsHead))
    ) {
      behind.push('records-behind')
    }
  }

  // The existence check above and these writes are not atomic, so `wx` is what
  // keeps a copy that appeared in between from being overwritten. A failure
  // partway removes what this run placed, since a leftover would make the next
  // import of the same bundle refuse on it.
  const written: string[] = []
  const created: string[] = []
  // `mkdir` over a file raises EEXIST too, so the code alone cannot say a copy
  // appeared. Only a `wx` write refusing an existing path means that.
  let isWriting = false
  const makeDir = (dir: string): void => {
    const first = mkdirSync(dir, { recursive: true })
    if (first !== undefined) created.push(first)
  }
  const place = (path: string, content: Uint8Array): void => {
    makeDir(dirname(path))
    isWriting = true
    writeFileSync(path, content, { flag: 'wx' })
    isWriting = false
    written.push(path)
  }
  try {
    place(transcript, unpacked.transcript)
    for (const [name, content] of unpacked.side) {
      place(join(sideDir, name), content)
    }
  } catch (error) {
    const left = rollBack(written, created)
    const cause = error instanceof Error ? error.message : String(error)
    const residue =
      left.length === 0
        ? 'Everything this run wrote was removed.'
        : `These could not be removed, so move them aside before retrying: ${left.join(', ')}.`
    const isTaken =
      isWriting &&
      error instanceof Error &&
      'code' in error &&
      error.code === 'EEXIST'
    return isTaken
      ? refuse(
          'exists',
          `A file appeared under ${folder} while the import was writing, so it stopped rather than overwrite it: ${cause}. ${residue}`,
        )
      : refuse(
          'write-failed',
          `The import could not write under ${folder}: ${cause}. ${residue}`,
        )
  }

  return {
    ok: true,
    manifest,
    folder,
    transcript,
    files: [...unpacked.side.keys()],
    behind,
    routes: [
      `cd ${options.root} && claude --resume ${id}`,
      `cd ${options.root} && claude "/canon:session-resume"`,
    ],
  }
}
