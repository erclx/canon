import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { open, rm, stat } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import { RECORD_ROOTS, recordRoot, SCRATCH } from '@/roots/record'
import { type BlockedPath, guardPayload } from '@/records/push-guard'

/**
 * The legacy `.claude`-root allowlist, read only when a project has not moved
 * to `.canon/` yet.
 *
 * That root also tracks `skills/`, `rules/`, and `hooks/`, so only an
 * allowlist separates record folders there, where `.canon/` holds nothing else
 * and takes `EXCLUDED_ENTRIES` instead. Each entry is a top-level folder whose
 * archive sits inside it. Scratch and `worktrees/` stay out. `RECORD_KINDS` in
 * `validate.ts` differs on purpose: it names what a standard governs, and this
 * names what a disk loss would take.
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
 * Folders a retired kind left at a legacy `.claude` root that the allowlist
 * must still read, so a half-finished move that strands one still trips
 * `split-roots`. Absent from `BACKED_FOLDERS` because nothing writes them, and
 * absent from `RETIRED_FOLDERS` because that list stages a deletion and this
 * folder is an archive to keep.
 */
const LEGACY_RECORD_FOLDERS = ['memory'] as const

/**
 * Names that have left `BACKED_FOLDERS` and whose removal still has to reach a
 * records history once.
 *
 * Dropping a name from the list above stops `add` staging its deletion, so
 * the remote keeps the folder and a `pull` restores it beside its replacement.
 * Retire a name here once no history still carries it. Nothing measures that,
 * but a leftover entry matches nothing and is filtered out before `add`.
 */
const RETIRED_FOLDERS = [
  'plans-archive',
  'review-archive',
  'task-archive',
] as const

/** The history directory's own name, which keeps its dot at either record root. */
const RECORDS_GIT_NAME = '.records.git'

/**
 * Top-level `.canon/` entries a backup never carries, named rather than
 * matched by pattern so the whole exemption reads in one place.
 *
 * `tmp` is deletable without loss, `ordinal-locks` is transient per claim, and
 * `.records.git` is the history itself, which would otherwise stage into
 * itself. The list bounds the records index too, since `scopedFolders` filters
 * through `isExcluded`, so a name an older binary committed is removed once
 * rather than re-staged by the `-f` on every push.
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
 * Whether a top-level name stays out of every push, at either root.
 *
 * `SCRATCH` is the retired `.tmp` spelling. It is a guard rather than a lookup,
 * keeping a stray `.tmp` out of a push, and `EXCLUDED_ENTRIES` names the
 * `.canon` spelling only.
 */
function isExcluded(name: string): boolean {
  return (
    name === SCRATCH ||
    EXCLUDED_ENTRIES.includes(name as (typeof EXCLUDED_ENTRIES)[number])
  )
}

/**
 * The record folders sitting at `dir` right now, at either root spelling.
 *
 * A `.claude`-spelled directory reads the fixed allowlist, filtered to what
 * exists, since that root also holds `skills/`, `rules/`, and `hooks/` no
 * exclusion set names. A `.canon`-spelled directory reads its own top-level
 * directories less `EXCLUDED_ENTRIES` instead, since nothing else shares that
 * root and a folder added there is a record folder by construction.
 *
 * Takes a directory rather than a project root so `strandedFolders` can ask it
 * about a candidate root other than the one `workTree` resolved.
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
 * The tree a backup stages, which is the record root itself.
 *
 * It resolves the root rather than each folder under it, so the history and the
 * work tree are one answer. Resolving them apart would let a half-migrated tree
 * open a history at one root and stage a work tree at the other, which stages
 * the deletion of every folder the move relocated and pushes it.
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
 * The branch a records push or pull targets for the project at `root`,
 * one branch per project on the shared records repository.
 *
 * Reduces `origin` through `remoteIdentity`, so clones land on one branch
 * whatever the transport, and falls back to the directory basename with no
 * `origin`. `enclosing` reuses the caller's remote read. An `origin` that
 * changes between pushes silently starts a new branch and orphans the old one,
 * and nothing migrates it.
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
  /** Every pending path the payload guard refused, carried on `unsafe-payload` only. */
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
 * Runs one git command against the records history, from the work tree.
 *
 * All three flags go on every call. `init` with `--git-dir` writes
 * `core.bare = true`, which only `--work-tree` overrides, so dropping it stages
 * the enclosing project. `-C` makes a bare pathspec mean the work-tree root,
 * which a session in a linked worktree would otherwise miss, and `--root`
 * cannot stand in. Paths are absolute, since `-C` applies first.
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
 * Reduces a remote URL to `host/path`, so every spelling of one repository
 * compares equal.
 *
 * Transport is what the reduction drops. `git@github.com:owner/repo.git` and
 * `https://github.com/owner/repo` name the same repository, and comparing them
 * as written passes a records origin that publishes the payload through the
 * other protocol.
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
 * Reads every remote of the enclosing project in one call, or undefined when
 * git cannot answer, since `resolveRemote`'s gate and `projectBranch` both
 * need it.
 *
 * The caller refuses on undefined rather than reading an empty list, which
 * would clear the shared-origin gate for every URL. A project with no remotes
 * answers an empty list with exit zero, so the two states stay distinct.
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
 *
 * The last two are the ones the payload depends on. This repository is public,
 * so a records branch on any of its remotes serves the plans and the
 * groundwork trails to anyone who fetches all refs. Comparing the configured
 * URL against every remote of the enclosing repository is what keeps a
 * misconfigured `origin` from publishing them, and refusing when that list
 * cannot be read is what keeps a failed comparison from reading as a pass.
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
 * Backed folders sitting at a record root other than the one `workTree` chose.
 *
 * A move that failed partway leaves a folder at the old root while the records
 * index still names it, so a push would stage its deletion and drop it from
 * the remote. Both verbs refuse on it, since a `pull` would leave two roots
 * disagreeing. Each candidate is read through `foldersAt`, so `.canon` uses its
 * own exclusion set, and scratch and `worktrees/` never count as stranded.
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
 * The subset of the present, retired, and previously-tracked names a pathspec
 * can name, since a pathspec matching nothing fails the whole `add`.
 *
 * The index joins the candidates, so a folder deleted in full, or under a name
 * `RETIRED_FOLDERS` never listed, still has its deletion staged. `firstSeen`
 * is a folder on disk the index never tracked, shown in the push report. An
 * indexed name `isExcluded` drops comes back as `dropped`, so the push removes
 * it from history once and says so.
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
 * What a report names, which is the folders a reader can go and open.
 *
 * Exported so the scratch-evidence walk and the push and pull help text read
 * the same resolved set rather than each re-deriving it against
 * `BACKED_FOLDERS`, which is silently wrong at a `.canon` root.
 */
export function presentFolders(root: string): string[] {
  return foldersAt(workTree(root))
}

/**
 * The record folder names a project could ever carry, without regard to
 * whether each currently exists: `BACKED_FOLDERS` at the legacy `.claude`
 * root, since nothing else names a folder there, and the live directory
 * listing at `.canon`, since nothing bounds that root's names from outside
 * any more and a name nobody has created yet cannot be listed.
 *
 * Exported for `canon records size`, whose own contract reports every folder
 * whether or not it exists so a caller reading the record gets a stable set
 * of keys. `presentFolders` filters by existence instead, which is right for
 * a push report naming what a reader can go and open and wrong here.
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
 * The files `add -A -f` is about to stage from `scope`, split into those the
 * history has never carried and every pending one.
 *
 * `ls-files -o` without `--exclude-standard` lists ignored files too, which is
 * what `-f` stages. `-m` also lists a deleted file and `-o` lists an embedded
 * repository as a `dir/` entry, so both are filtered down to regular files,
 * which is all a payload check has bytes to read.
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
        `${blocked.length} record(s) cannot be backed up, so nothing was staged or pushed:`,
        ...blocked.map(
          (finding) =>
            `  ${finding.path} (${finding.cause}: ${finding.detail})`,
        ),
        'Move each out of the record folders, such as into .canon/tmp/, or remove the credential, then push again.',
      ].join('\n'),
    ),
    blocked,
  }
}

/**
 * Puts HEAD and the index back where they stood before this run committed.
 *
 * A mixed reset to the recorded HEAD rather than `reset --soft HEAD~1`. A soft
 * reset leaves a dropped name's deletion staged while the next run's index read
 * no longer lists the name, so that run's diff never sees the deletion and it
 * is never committed. The recorded HEAD also covers the root commit, where
 * `HEAD~1` does not exist and only removing the ref restores an unborn branch.
 *
 * Returns an error sentence when the undo itself failed, so the caller appends
 * it rather than reporting a clean history that is not.
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
 * Stages the backed folders, commits when any of them changed, and pushes.
 *
 * The payload guard reads every pending file ahead of the stage, so a refusal
 * leaves the index and object store untouched. The push runs even with no new
 * commit, since an older binary may have committed and failed to reach the
 * network. A commit this call made is undone when the push fails, so a
 * rejecting remote is not handed it again on every run.
 */
export async function pushRecords(
  root: string,
  timing: PushLockTiming = PUSH_LOCK,
): Promise<PushOutcome> {
  // With no history there is no folder to hold a lock in, and the unlocked
  // body refuses `no-repository` before it writes anything.
  if (!existsSync(recordsGitDir(root))) return pushUnlocked(root)
  return withPushLock(root, timing, () => pushUnlocked(root))
}

/** How long a push waits on another push's lock, and the age past which a lock is a dead push's. */
export interface PushLockTiming {
  readonly waitMs: number
  readonly staleMs: number
}

/**
 * A wave of ending sessions queues here, so the wait covers a few pushes. The
 * stale age sits at the 60 second ceiling Claude Code puts on a hook, past
 * which no hook-run push still holds the lock it took.
 */
const PUSH_LOCK: PushLockTiming = { waitMs: 10_000, staleMs: 60_000 }

const PUSH_LOCK_POLL_MS = 50

/**
 * Holds an exclusive lock file inside the records history for one stage,
 * commit, push, and undo, so two pushes never collide on the records index or
 * have one undo reset past a commit the other made.
 */
async function withPushLock(
  root: string,
  timing: PushLockTiming,
  run: () => Promise<PushOutcome>,
): Promise<PushOutcome> {
  const lock = join(recordsGitDir(root), 'canon-push.lock')
  const deadline = Date.now() + timing.waitMs

  for (;;) {
    try {
      await (await open(lock, 'wx')).close()
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const modified = (await stat(lock).catch(() => undefined))?.mtimeMs
      if (modified !== undefined && Date.now() - modified > timing.staleMs) {
        await rm(lock, { force: true })
        continue
      }
      if (Date.now() >= deadline) {
        return refuse(
          'busy',
          `Another records push holds ${relative(root, lock)}. Run canon records push again once it finishes.`,
        )
      }
      await new Promise((settle) => setTimeout(settle, PUSH_LOCK_POLL_MS))
    }
  }

  try {
    return await run()
  } finally {
    await rm(lock, { force: true })
  }
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

  const blocked = await guardPayload(workTree(root), files.pending)
  if (blocked.length > 0) return refuseBlocked(blocked)

  if (scope.length > 0) {
    // `-f` carries the ignored payload, and the pathspecs are the whole list,
    // so nothing outside them can enter the index.
    const staged = await records(root, [
      'add',
      '-A',
      '-f',
      '--',
      ...scope,
      ...MEDIA_PATHSPECS,
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
    added: files.added,
    dropped,
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
 * Fetches the records history and writes it into the backed folders.
 *
 * The two directions are not symmetric. A push only ever adds, while a pull
 * onto a machine holding work that never reached the remote would discard it,
 * so both gates below refuse rather than choosing a merge strategy. A person
 * resolves by pushing first or by moving the local folders aside.
 */
export async function pullRecords(root: string): Promise<PullOutcome> {
  const split = refuseSplitRoots(root)
  if (split) return split

  const enclosing = await enclosingRemotes(root)
  const remote = await resolveRemote(root, enclosing)
  if (typeof remote !== 'string') return remote

  const branch = await projectBranch(root, enclosing)

  // Checked ahead of the fetch, since `--exit-code` answers by a code no
  // locale changes: 2 for no matching ref, 0 for found, else unreachable.
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
