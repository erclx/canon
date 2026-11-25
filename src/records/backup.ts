import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import { RECORD_ROOTS, recordRoot, SCRATCH } from '@/roots/record'
import {
  type BlockedPath,
  guardPayload,
  type SkippedPath,
} from '@/records/push-guard'
import { type LockTiming, withLock } from '@/records/push-lock'

/**
 * The legacy `.claude`-root allowlist. That root also tracks `skills/`,
 * `rules/`, and `hooks/`, so only a list separates record folders there.
 * `RECORD_KINDS` differs on purpose: it names what a standard governs.
 */
export const BACKED_FOLDERS = [
  'diagrams',
  'groundwork',
  'intake',
  'plans',
  'proposals',
  'review',
  'slides',
  'tasks',
  'teach',
  'transcripts',
  'upstream',
  'walkthroughs',
] as const

/**
 * Folders a retired kind left at a legacy `.claude` root, read so a stranded
 * one still trips `split-roots`. Nothing writes them, and `RETIRED_FOLDERS`
 * would stage their deletion, so they sit in neither list.
 */
const LEGACY_RECORD_FOLDERS = ['memory'] as const

/**
 * Names that left `BACKED_FOLDERS` and whose removal must still reach a
 * records history once, since dropping a name stops `add` staging its
 * deletion and a `pull` would restore it. Retire one once no history carries it.
 */
const RETIRED_FOLDERS = [
  'plans-archive',
  'review-archive',
  'task-archive',
] as const

/** The history directory's own name, which keeps its dot at either record root. */
const RECORDS_GIT_NAME = '.records.git'

/**
 * Top-level `.canon/` entries a backup never carries. `.records.git` would
 * stage into itself, and `scopedFolders` filters the index through this list,
 * so a name an older binary committed is removed once rather than re-staged.
 */
export const EXCLUDED_ENTRIES = [
  'tmp',
  'ordinal-locks',
  RECORDS_GIT_NAME,
] as const

/** Media under a video workspace, remade from its plan and composition, so never backed up. */
export const MEDIA_PATHSPECS = [
  ':(exclude,glob)video/*/takes/**',
  ':(exclude,glob)video/*/scratch/**',
  ':(exclude,glob)video/**/renders/**',
  ':(exclude,glob)video/**/snapshots/**',
  ':(exclude,glob)video/**/node_modules/**',
  ':(exclude,glob,icase)video/**/*.mp4',
  ':(exclude,glob,icase)video/**/*.webm',
  ':(exclude,glob,icase)video/**/*.mov',
] as const

/**
 * `SCRATCH` is the retired `.tmp` spelling, kept as a guard so a stray `.tmp`
 * stays out of a push, since `EXCLUDED_ENTRIES` names the `.canon` spelling.
 */
function isExcluded(name: string): boolean {
  return (
    name === SCRATCH ||
    EXCLUDED_ENTRIES.includes(name as (typeof EXCLUDED_ENTRIES)[number])
  )
}

/**
 * A `.claude` root reads the fixed allowlist, since it also holds `skills/`
 * and `rules/`. A `.canon` root reads its own directories less
 * `EXCLUDED_ENTRIES`. Takes a directory so `strandedFolders` can ask any root.
 */
function foldersAt(dir: string): string[] {
  if (basename(dir) === '.claude') {
    return [...BACKED_FOLDERS, ...LEGACY_RECORD_FOLDERS].filter((folder) =>
      existsSync(join(dir, folder)),
    )
  }

  const entries = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
    : []

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !isExcluded(name))
}

/**
 * The record root, resolved once so the history and the work tree are one
 * answer. Apart, a half-migrated tree would stage every relocated folder as
 * deleted and push it.
 */
function workTree(root: string): string {
  return recordRoot(root)
}

/** Holds the records history beside the folders it tracks, ignored by the enclosing repository. */
function recordsGitDir(root: string): string {
  return join(workTree(root), RECORDS_GIT_NAME)
}

/**
 * A run of characters outside what git accepts in a ref segment, replaced
 * with a single dash, with a leading or trailing `/` or `.` trimmed after.
 */
function sanitizeRefSegment(segment: string): string {
  return segment
    .replace(/[^a-z0-9_./-]+/g, '-')
    .replace(/^[/.]+/, '')
    .replace(/[/.]+$/, '')
}

/**
 * One branch per project on the shared records repository, reduced through
 * `remoteIdentity` so every transport lands on one branch. An `origin` that
 * changes between pushes starts a new branch and orphans the old one.
 */
export async function projectBranch(
  root: string,
  enclosing?: EnclosingRemotes,
): Promise<string> {
  const remotes = enclosing ?? (await enclosingRemotes(root))
  const raw = remotes?.originUrl
    ? remoteIdentity(remotes.originUrl)
    : basename(resolve(root)).toLowerCase()
  return sanitizeRefSegment(raw)
}

/**
 * The records history is machine-written and nobody reads its authorship, so a
 * fixed identity keeps `push` from failing inside a git hook on a machine where
 * `user.email` was never configured.
 */
const COMMIT_IDENTITY = [
  '-c',
  'user.name=canon',
  '-c',
  'user.email=canon@local',
]

export const BACKUP_REFUSALS = [
  'split-roots',
  'no-repository',
  'no-remote',
  'remote-unreadable',
  'remote-shared',
  'no-remote-records',
  'local-changes',
  'local-ahead',
  'unsafe-payload',
  'git-failed',
  'busy',
] as const

export type BackupRefusal = (typeof BACKUP_REFUSALS)[number]

export interface BackupRefused {
  readonly ok: false
  readonly reason: BackupRefusal
  readonly message: string
  /** Every pending path carrying a credential, carried on `unsafe-payload` only. */
  readonly blocked?: readonly BlockedPath[]
}

export interface PushReport {
  readonly ok: true
  readonly root: string
  readonly folders: readonly string[]
  /** A folder in scope this push found on disk but the records index had never tracked. */
  readonly firstSeen: readonly string[]
  /** Every file this push stages that the records history has never carried. */
  readonly added: readonly string[]
  /** An excluded name the records index still tracked, removed from the history going forward. */
  readonly dropped: readonly string[]
  /** An oversized file this push left behind, at its last backed-up version where it has one. */
  readonly skipped: readonly SkippedPath[]
  readonly changed: number
  readonly commit?: string
  readonly pushed: boolean
}

export interface PullReport {
  readonly ok: true
  readonly root: string
  readonly folders: readonly string[]
  readonly commit: string
  readonly files: number
}

export type PushOutcome = PushReport | BackupRefused
export type PullOutcome = PullReport | BackupRefused

interface GitResult {
  readonly ok: boolean
  readonly code: number
  readonly text: string
  readonly stderr: string
}

/**
 * All three flags go on every call. `init` with `--git-dir` writes
 * `core.bare = true`, which only `--work-tree` overrides, and `-C` makes a bare
 * pathspec mean the work-tree root, which a linked worktree would otherwise miss.
 */
async function records(root: string, args: string[]): Promise<GitResult> {
  const gitDir = resolve(recordsGitDir(root))
  const tree = resolve(workTree(root))

  const result =
    await $`git -C ${tree} --git-dir=${gitDir} --work-tree=${tree} ${args}`
      .env(gitEnv())
      .quiet()
      .nothrow()

  return {
    ok: result.exitCode === 0,
    code: result.exitCode,
    text: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  }
}

function refuse(reason: BackupRefusal, message: string): BackupRefused {
  return { ok: false, reason, message }
}

function failed(action: string, result: GitResult): BackupRefused {
  return refuse(
    'git-failed',
    `git ${action} failed against the records history: ${result.stderr || 'no output'}.`,
  )
}

/**
 * Reduces a remote URL to `host/path`, dropping the transport, so an SSH and
 * an HTTPS spelling of one repository compare equal and a records origin
 * cannot publish the payload through the other protocol.
 */
export function remoteIdentity(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^[a-z+]+:\/\//, '')
    .replace(/^[^@/]+@/, '')
    .replace(/^([^/:]+):/, '$1/')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
}

interface EnclosingRemotes {
  readonly identities: readonly string[]
  readonly originUrl: string | undefined
}

/**
 * Every remote of the enclosing project, or undefined when the read fails.
 * The caller refuses on undefined, since an empty list would clear the
 * shared-origin gate for every URL.
 */
async function enclosingRemotes(
  root: string,
): Promise<EnclosingRemotes | undefined> {
  const result = await $`git -C ${root} remote -v`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode !== 0) return undefined

  const identities: string[] = []
  let originUrl: string | undefined

  for (const line of result.stdout.toString().split('\n')) {
    if (!line) continue
    const [name, url] = line.split(/\s+/)
    if (!url) continue
    identities.push(remoteIdentity(url))
    if (name === 'origin' && originUrl === undefined) originUrl = url
  }

  return { identities, originUrl }
}

/**
 * Clears the four gates both verbs share and returns the records remote URL.
 * A records branch on any remote of this public repository would publish the
 * plans, so an unreadable remote list refuses rather than passing.
 */
async function resolveRemote(
  root: string,
  enclosing: EnclosingRemotes | undefined,
): Promise<string | BackupRefused> {
  const gitDir = recordsGitDir(root)

  if (!existsSync(gitDir)) {
    return refuse(
      'no-repository',
      [
        `No records history at ${relative(root, gitDir)}. One private repository backs every project on this machine, each on its own branch, so create it once, against whichever project sets it up first:`,
        `  git --git-dir=${gitDir} init`,
        `  git --git-dir=${gitDir} remote add origin <private-repo-url>`,
        `A person commits a README to that repository's main branch once. It is never machine-written.`,
      ].join('\n'),
    )
  }

  const remote = await records(root, ['remote', 'get-url', 'origin'])
  if (!remote.ok || remote.text.length === 0) {
    return refuse(
      'no-remote',
      [
        'The records history has no origin. Point it at a private repository:',
        `  git --git-dir=${gitDir} remote add origin <private-repo-url>`,
      ].join('\n'),
    )
  }

  if (!enclosing) {
    return refuse(
      'remote-unreadable',
      `Cannot read the remotes of the project at ${root}, so the records origin cannot be checked against them. Records carry the plans and the groundwork trails, and an unchecked origin risks publishing them.`,
    )
  }

  const url = remoteIdentity(remote.text)
  if (enclosing.identities.includes(url)) {
    return refuse(
      'remote-shared',
      `The records origin ${remote.text} is a remote of this project. Records carry the plans and the groundwork trails, so they need a repository of their own.`,
    )
  }

  return url
}

/**
 * Backed folders left at the record root `workTree` did not choose. A push
 * would stage their deletion and drop them from the remote, and a `pull` would
 * leave two roots disagreeing, so both verbs refuse on any.
 */
function strandedFolders(root: string): string[] {
  const resolved = resolve(workTree(root))

  return RECORD_ROOTS.flatMap((candidate) => {
    const dir = join(root, candidate)
    if (resolve(dir) === resolved) return []

    return foldersAt(dir).map((folder) => join(candidate, folder))
  })
}

/** Refuses a tree whose records sit under both roots, naming what to move. */
function refuseSplitRoots(root: string): BackupRefused | undefined {
  const stranded = strandedFolders(root)
  if (stranded.length === 0) return undefined

  return refuse(
    'split-roots',
    [
      `Records sit under both roots, so ${relative(root, workTree(root))} is not the whole set and a push would stage the rest as deleted:`,
      ...stranded.map((path) => `  ${path}`),
      'Finish the move with canon migrate records --write, or put these back beside the others by hand.',
    ].join('\n'),
  )
}

/**
 * A pathspec-safe subset, which of it never entered the records index before,
 * and which excluded names the index still tracks.
 */
interface FolderScope {
  readonly scope: readonly string[]
  readonly firstSeen: readonly string[]
  readonly dropped: readonly string[]
}

/**
 * The present, retired, and indexed names a pathspec can name, since one
 * matching nothing fails the whole `add`. The index joins in so a fully
 * deleted folder still stages its deletion, and excluded names come back `dropped`.
 */
async function scopedFolders(root: string): Promise<FolderScope> {
  const tracked = await records(root, ['ls-files'])
  const everIndexed = new Set(
    tracked.ok ? tracked.text.split('\n').filter(Boolean).map(topSegment) : [],
  )
  const indexed = new Set([...everIndexed].filter((name) => !isExcluded(name)))
  const dropped = [...everIndexed].filter(isExcluded).sort()

  const present = new Set(foldersAt(workTree(root)))
  const retired = RETIRED_FOLDERS.filter(
    (folder) => existsSync(join(workTree(root), folder)) || indexed.has(folder),
  )
  const scope = [...new Set([...present, ...retired, ...indexed])].sort()
  const firstSeen = scope.filter(
    (folder) => present.has(folder) && !indexed.has(folder),
  )

  return { scope, firstSeen, dropped }
}

function topSegment(path: string): string {
  return path.split('/')[0]
}

/**
 * The folders a report names. Exported so the scratch-evidence walk and the
 * help text read one resolved set, since `BACKED_FOLDERS` is wrong at `.canon`.
 */
export function presentFolders(root: string): string[] {
  return foldersAt(workTree(root))
}

/**
 * Every record folder a project could carry, present or not, for
 * `canon records size`, whose record keeps a stable set of keys.
 * `presentFolders` filters by existence instead, which is wrong here.
 */
export function candidateFolders(root: string): string[] {
  const tree = workTree(root)
  return basename(tree) === '.claude' ? [...BACKED_FOLDERS] : foldersAt(tree)
}

function countLines(text: string): number {
  return text.split('\n').filter(Boolean).length
}

function splitNul(text: string): string[] {
  return text.split('\0').filter(Boolean)
}

/**
 * The files `add -A -f` is about to stage, split into never-carried and all
 * pending. `-o` without `--exclude-standard` lists ignored files as `-f`
 * stages them, filtered to regular files, which is all a payload check reads.
 */
async function pendingFiles(
  root: string,
  scope: readonly string[],
): Promise<{ added: string[]; pending: string[] } | BackupRefused> {
  if (scope.length === 0) return { added: [], pending: [] }

  const [others, modified] = await Promise.all([
    records(root, ['ls-files', '-z', '-o', '--', ...scope, ...MEDIA_PATHSPECS]),
    records(root, ['ls-files', '-z', '-m', '--', ...scope, ...MEDIA_PATHSPECS]),
  ])
  if (!others.ok) return failed('ls-files', others)
  if (!modified.ok) return failed('ls-files', modified)

  const tree = workTree(root)
  const isRegularFile = (path: string): boolean => {
    try {
      return lstatSync(join(tree, path)).isFile()
    } catch {
      return false
    }
  }

  const added = splitNul(others.text).filter(isRegularFile).sort()
  const pending = [
    ...new Set([...added, ...splitNul(modified.text).filter(isRegularFile)]),
  ].sort()

  return { added, pending }
}

function refuseBlocked(blocked: readonly BlockedPath[]): BackupRefused {
  return {
    ...refuse(
      'unsafe-payload',
      [
        `${blocked.length} record(s) carry a credential, so nothing was staged or pushed:`,
        ...blocked.map(
          (finding) =>
            `  ${finding.path} (${finding.cause}: ${finding.detail})`,
        ),
        'Remove the credential, or move the file out of the record folders, such as into .canon/tmp/, then push again.',
      ].join('\n'),
    ),
    blocked,
  }
}

/**
 * Resets to the recorded head, since a soft reset leaves a dropped name's
 * deletion staged, and removes the ref at the root commit, where `HEAD~1` does
 * not exist. Returns an error sentence when the undo itself failed.
 */
async function undoCommit(
  root: string,
  priorHead: string,
): Promise<string | undefined> {
  if (priorHead.length > 0) {
    const reset = await records(root, ['reset', '--quiet', priorHead])
    return reset.ok ? undefined : `Undoing it failed: ${reset.stderr}.`
  }

  const unref = await records(root, ['update-ref', '-d', 'HEAD'])
  if (!unref.ok) return `Undoing it failed: ${unref.stderr}.`
  const reset = await records(root, ['reset', '--quiet'])
  return reset.ok ? undefined : `Undoing it failed: ${reset.stderr}.`
}

/**
 * The payload guard runs before the stage, leaving an oversized file out and
 * refusing on a credential. The push runs even with no new commit to reach an
 * older one, and a commit this call made is undone when the push fails.
 */
export async function pushRecords(
  root: string,
  timing: LockTiming = PUSH_LOCK,
): Promise<PushOutcome> {
  // No history means no folder for the lock, and the body refuses unwritten.
  if (!existsSync(recordsGitDir(root))) return pushUnlocked(root)
  return withPushLock(root, timing, () => pushUnlocked(root))
}

/**
 * A wave of ending sessions queues here, so the wait covers a few pushes and
 * still fits the session-end hook's timeout with a push behind it.
 */
const PUSH_LOCK: LockTiming = { waitMs: 10_000, staleMs: 30_000 }

/**
 * Holds the lock inside the records history for one stage, commit, push, and
 * undo, so two pushes never collide on the records index or have one undo
 * reset past a commit the other made.
 */
async function withPushLock(
  root: string,
  timing: LockTiming,
  run: () => Promise<PushOutcome>,
): Promise<PushOutcome> {
  const lock = join(recordsGitDir(root), 'canon-push.lock')
  const held = await withLock(lock, timing, run)
  if (!held.busy) return held.value
  return refuse(
    'busy',
    `Another records push holds ${relative(root, lock)}. Run canon records push again once it finishes.`,
  )
}

async function pushUnlocked(root: string): Promise<PushOutcome> {
  const split = refuseSplitRoots(root)
  if (split) return split

  const enclosing = await enclosingRemotes(root)
  const remote = await resolveRemote(root, enclosing)
  if (typeof remote !== 'string') return remote

  const { scope, firstSeen, dropped } = await scopedFolders(root)

  const files = await pendingFiles(root, scope)
  if ('ok' in files) return files

  const verdict = await guardPayload(workTree(root), files.pending)
  if (verdict.credentials.length > 0) return refuseBlocked(verdict.credentials)

  const skipped = verdict.oversized
  const skippedPaths = new Set(skipped.map((entry) => entry.path))

  if (scope.length > 0) {
    // `-f` carries the ignored payload, and the pathspecs bound what enters the index.
    const staged = await records(root, [
      'add',
      '-A',
      '-f',
      '--',
      ...scope,
      ...MEDIA_PATHSPECS,
      ...skipped.map((entry) => `:(exclude,literal)${entry.path}`),
    ])
    if (!staged.ok) return failed('add', staged)
  }

  if (dropped.length > 0) {
    const removed = await records(root, [
      'rm',
      '-r',
      '--cached',
      '--quiet',
      '--',
      ...dropped,
    ])
    if (!removed.ok) return failed('rm', removed)
  }

  // Scope alone would miss the dropped deletions, which sit outside it.
  const diff = await records(root, [
    'diff',
    '--cached',
    '--name-only',
    '--',
    ...scope,
    ...dropped,
  ])
  if (!diff.ok) return failed('diff', diff)

  const changed = countLines(diff.text)

  const prior = await records(root, [
    'rev-parse',
    '--verify',
    '--quiet',
    'HEAD',
  ])
  const priorHead = prior.ok ? prior.text : ''

  if (changed > 0) {
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
    const commit = await records(root, [
      ...COMMIT_IDENTITY,
      'commit',
      '--quiet',
      '-m',
      `records: ${changed} changed at ${stamp}`,
    ])
    if (!commit.ok) return failed('commit', commit)
  }

  const report = {
    ok: true,
    root,
    folders: presentFolders(root),
    firstSeen,
    added: files.added.filter((path) => !skippedPaths.has(path)),
    dropped,
    skipped,
    changed,
  } as const
  const head = await records(root, ['rev-parse', '--short', 'HEAD'])
  if (!head.ok) return { ...report, pushed: false }

  const branch = await projectBranch(root, enclosing)
  const pushed = await records(root, [
    'push',
    'origin',
    `HEAD:refs/heads/${branch}`,
  ])
  if (!pushed.ok) {
    const refused = failed('push', pushed)
    if (changed === 0) return refused

    const undoError = await undoCommit(root, priorHead)
    return refuse(
      'git-failed',
      [
        refused.message,
        'The commit this run made was undone, and the records are still on disk.',
        undoError,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  return { ...report, commit: head.text, pushed: true }
}

/**
 * Fetches the records history into the backed folders. A pull onto unpushed
 * work would discard it, so both gates refuse rather than choosing a merge
 * strategy, and a person pushes first or moves the folders aside.
 */
export async function pullRecords(root: string): Promise<PullOutcome> {
  const split = refuseSplitRoots(root)
  if (split) return split

  const enclosing = await enclosingRemotes(root)
  const remote = await resolveRemote(root, enclosing)
  if (typeof remote !== 'string') return remote

  const branch = await projectBranch(root, enclosing)

  // `--exit-code` answers by code no locale changes: 2 no ref, 0 found, else unreachable.
  const remoteBranch = await records(root, [
    'ls-remote',
    '--exit-code',
    'origin',
    `refs/heads/${branch}`,
  ])
  if (remoteBranch.code === 2) {
    return refuse(
      'no-remote-records',
      `The records origin carries no ${branch} branch yet. Run canon records push from the machine holding the records.`,
    )
  }
  if (!remoteBranch.ok) return failed('ls-remote', remoteBranch)

  const fetched = await records(root, [
    'fetch',
    '--quiet',
    'origin',
    `refs/heads/${branch}`,
  ])
  if (!fetched.ok) return failed('fetch', fetched)

  const target = await records(root, ['rev-parse', 'FETCH_HEAD'])
  if (!target.ok) return failed('rev-parse', target)

  const { scope } = await scopedFolders(root)

  if (scope.length > 0) {
    const dirty = await records(root, [
      'status',
      '--porcelain',
      '--',
      ...scope,
      ...MEDIA_PATHSPECS,
    ])
    if (!dirty.ok) return failed('status', dirty)

    if (dirty.text.length > 0) {
      return refuse(
        'local-changes',
        `${countLines(dirty.text)} local record(s) are not in the records history. Run canon records push first, or move them aside.`,
      )
    }
  }

  const head = await records(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])
  if (head.ok && head.text.length > 0) {
    const ahead = await records(root, ['rev-list', `${target.text}..HEAD`])
    if (!ahead.ok) return failed('rev-list', ahead)

    if (ahead.text.length > 0) {
      return refuse(
        'local-ahead',
        `${countLines(ahead.text)} local commit(s) have not reached the records origin. Run canon records push first.`,
      )
    }
  }

  const reset = await records(root, ['reset', '--hard', '--quiet', target.text])
  if (!reset.ok) return failed('reset', reset)

  const files = await records(root, ['ls-files'])
  if (!files.ok) return failed('ls-files', files)

  return {
    ok: true,
    root,
    folders: presentFolders(root),
    commit: target.text.slice(0, 7),
    files: countLines(files.text),
  }
}
