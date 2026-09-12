import { existsSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git-env'
import { RECORD_ROOTS, recordRoot } from '@/record-root'

/**
 * The folders a backup carries, relative to the record root `workTree` resolves
 * rather than to either root specifically, since the same ten names sit under
 * whichever one a tree holds.
 *
 * Nothing bounds this list any more, and the move is what took the bound away.
 * The claude manifest used to ship a folder apiece, so the `# Claude` group
 * named a superset this could be read against; it ships one `.canon/` root
 * entry now and names no folder at all. Spelling the list out is therefore the
 * whole of the protection rather than half of it, since a record folder added
 * under `.canon/` is ignored the moment it exists and enters no payload until
 * a name is written here.
 *
 * Three counts describe this surface and each is right about a different
 * question, so they are stated apart rather than reconciled. Ten is what a
 * disk loss would take, which is this list. Twelve is what sat under `.claude/`
 * as an ignored folder before the move, which adds the scratch folder that is
 * deletable without loss and `worktrees/`, whose contents belong to the
 * enclosing repository already. Thirteen is what the move relocated, which counts
 * ignore entries rather than folders: the twelve less `worktrees/`, which stayed,
 * plus `.records.git/` and the `README.md` a records pull writes back.
 *
 * Each entry is a top-level record folder and every archive sits inside the one
 * it archives, so the three former archive entries are covered by their parents
 * rather than named here. That is what keeps this list at one line per surface
 * as archives spread, which a sibling-per-archive layout could not.
 *
 * `RECORD_KINDS` in `validate.ts` overlaps this on five names and carries one
 * more that no backup reaches. The two lists differ on purpose: one is what a
 * standard governs, this is what a disk loss would take, and `standards` is
 * tracked so a backup would carry a second copy of committed files.
 */
export const BACKED_FOLDERS = [
  'diagrams',
  'groundwork',
  'intake',
  'memory',
  'plans',
  'proposals',
  'review',
  'tasks',
  'teach',
  'transcripts',
] as const

/**
 * Names that have left `BACKED_FOLDERS` and whose removal still has to reach a
 * records history once.
 *
 * Dropping a name from the list above stops it entering the pathspec, so `add`
 * never stages its deletion, the remote keeps the folder forever, and a `pull`
 * onto another machine restores it beside whatever replaced it. These three are
 * the archives that moved inside the records they archive, so the same files
 * are already on the remote under their new paths.
 *
 * Retire a name here once no records history still carries it. Nothing measures
 * that, so the cost of leaving one is three pathspec entries that match nothing
 * and are filtered out before `add` ever sees them.
 */
const RETIRED_FOLDERS = [
  'plans-archive',
  'review-archive',
  'task-archive',
] as const

/** The history directory's own name, which keeps its dot at either record root. */
const RECORDS_GIT_NAME = '.records.git'

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
 * Reduces the project's own `origin` through the same `remoteIdentity`
 * reduction the shared-origin gate already applies, so two clones of the
 * same project land on the same branch regardless of transport. Falls back
 * to the project directory's own basename for a project with no `origin`,
 * such as a fresh scaffold, which is no worse than the single shared branch
 * this replaces: nothing else here distinguishes two such clones either.
 *
 * `enclosing` is `pushRecords`/`pullRecords`'s own already-fetched remote
 * read, reused here rather than shelled out for a second time. A caller with
 * none, such as a test reading this in isolation, gets one read of its own.
 *
 * A project's `origin` can change (rename, fork, transfer) between one push
 * and the next, which silently starts writing to a new branch and orphans
 * whatever was left on the old one. No migration handles that today.
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
  'git-failed',
] as const

export type BackupRefusal = (typeof BACKUP_REFUSALS)[number]

export interface BackupRefused {
  readonly ok: false
  readonly reason: BackupRefusal
  readonly message: string
}

export interface PushReport {
  readonly ok: true
  readonly root: string
  readonly folders: readonly string[]
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
 * All three flags go on every call. `git --git-dir=<path> init` writes
 * `core.bare = true`, and an explicit `--work-tree` is what overrides it, so
 * dropping that flag on a single call reads the enclosing project as the tree
 * and stages everything in it.
 *
 * `-C` is what makes a bare pathspec like `groundwork` mean the work-tree root
 * wherever the caller stands. Git derives a pathspec prefix from the current
 * directory, so without it a caller sitting inside `.claude/`, which is every
 * session in a linked worktree under `.claude/worktrees/<name>/`, prefixes
 * each name with its own path and matches nothing. The root a caller names
 * does not reach that prefix, so `--root` cannot stand in for this.
 *
 * Both paths are absolute because `-C` takes effect before the other two flags
 * are read, so a relative root would otherwise send them looking inside the
 * work tree.
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
function remoteIdentity(url: string): string {
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
 * git cannot answer.
 *
 * `resolveRemote`'s shared-origin gate needs every remote's identity and
 * `projectBranch` needs specifically `origin`'s raw URL, so both read from
 * this one call rather than each shelling out to git on its own.
 *
 * The caller refuses on undefined rather than smoothing it into an empty list.
 * An empty list clears the gate below for every URL, so a git that failed for
 * any reason would publish the payload to whatever origin the records history
 * happens to name. A project with no remotes answers `0` with an exit of zero,
 * so the two states stay distinguishable.
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
 * so a records branch on any of its remotes serves the memory pen and the
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
      `Cannot read the remotes of the project at ${root}, so the records origin cannot be checked against them. Records carry the memory pen and the groundwork trails, and an unchecked origin risks publishing them.`,
    )
  }

  const url = remoteIdentity(remote.text)
  if (enclosing.identities.includes(url)) {
    return refuse(
      'remote-shared',
      `The records origin ${remote.text} is a remote of this project. Records carry the memory pen and the groundwork trails, so they need a repository of their own.`,
    )
  }

  return url
}

/**
 * Backed folders sitting at a record root other than the one `workTree` chose.
 *
 * A half-migrated tree is the case this reads. `recordRoot` answers for the
 * whole tree on the first root that exists, so one folder left behind by a move
 * that failed partway is absent from the work tree while the records index
 * still names it. `scopedFolders` puts it in the pathspec on the index side,
 * `add -A` stages its deletion, and the push drops it from the remote, which is
 * the harm `RETIRED_FOLDERS` documents reached by a different route.
 *
 * Both verbs refuse on it rather than only `push`. A `pull` resets the resolved
 * work tree hard and leaves the stranded copy beside it, which is not a loss but
 * is a tree where two roots disagree and neither is wrong.
 *
 * Only `BACKED_FOLDERS` is read. The scratch folder is deletable by definition
 * and `worktrees/` belongs to the enclosing repository, so neither stranded
 * anywhere costs a record.
 */
function strandedFolders(root: string): string[] {
  const resolved = resolve(workTree(root))

  return RECORD_ROOTS.flatMap((candidate) => {
    const dir = join(root, candidate)
    if (resolve(dir) === resolved) return []

    return BACKED_FOLDERS.filter((folder) => existsSync(join(dir, folder))).map(
      (folder) => join(candidate, folder),
    )
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
 * The subset of the backed and retired names a pathspec can name: on disk, or
 * already in the records index.
 *
 * A pathspec matching neither fails the whole `add`, which is why the subset
 * exists. The index half is what covers a folder deleted in full. Reading disk
 * alone drops it from the pathspec, so its deletion never stages, the remote
 * keeps it forever, and a later `pull` restores it past the gate that refuses
 * every other unpushed deletion.
 *
 * The retired names are the same case one level up, where the folder left the
 * backed list rather than the disk, and the index is the only side that still
 * knows it existed.
 */
async function scopedFolders(root: string): Promise<string[]> {
  const tracked = await records(root, ['ls-files'])
  const indexed = new Set(
    tracked.ok ? tracked.text.split('\n').filter(Boolean).map(topSegment) : [],
  )

  return [...BACKED_FOLDERS, ...RETIRED_FOLDERS].filter(
    (folder) => existsSync(join(workTree(root), folder)) || indexed.has(folder),
  )
}

function topSegment(path: string): string {
  return path.split('/')[0]
}

/** What a report names, which is the folders a reader can go and open. */
function presentFolders(root: string): string[] {
  return BACKED_FOLDERS.filter((folder) =>
    existsSync(join(workTree(root), folder)),
  )
}

function countLines(text: string): number {
  return text.split('\n').filter(Boolean).length
}

/**
 * Stages the backed folders, commits when any of them changed, and pushes.
 *
 * The push runs whether or not this call committed, because a previous run can
 * have committed and then failed to reach the network. Skipping it would leave
 * that commit on one disk, which is the state the whole verb exists to end.
 */
export async function pushRecords(root: string): Promise<PushOutcome> {
  const split = refuseSplitRoots(root)
  if (split) return split

  const enclosing = await enclosingRemotes(root)
  const remote = await resolveRemote(root, enclosing)
  if (typeof remote !== 'string') return remote

  const scope = await scopedFolders(root)

  if (scope.length > 0) {
    // `-f` is what carries the payload: every backed folder is ignored by the
    // enclosing repository, and the pathspecs are the whole list, so nothing
    // outside them can enter the index however the ignore rules read.
    const staged = await records(root, ['add', '-A', '-f', '--', ...scope])
    if (!staged.ok) return failed('add', staged)
  }

  const diff = await records(root, [
    'diff',
    '--cached',
    '--name-only',
    '--',
    ...scope,
  ])
  if (!diff.ok) return failed('diff', diff)

  const changed = countLines(diff.text)

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

  const folders = presentFolders(root)
  const head = await records(root, ['rev-parse', '--short', 'HEAD'])
  if (!head.ok) {
    return { ok: true, root, folders, changed, pushed: false }
  }

  const branch = await projectBranch(root, enclosing)
  const pushed = await records(root, [
    'push',
    'origin',
    `HEAD:refs/heads/${branch}`,
  ])
  if (!pushed.ok) return failed('push', pushed)

  return { ok: true, root, folders, changed, commit: head.text, pushed: true }
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

  // Checked ahead of the fetch rather than parsed out of a failed fetch's
  // stderr, which is git's own message and translates on a localized
  // machine. `--exit-code` answers through a code no locale changes: 2 for
  // no matching ref, 0 for found, anything else for a remote git could not
  // reach at all.
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

  const scope = await scopedFolders(root)

  if (scope.length > 0) {
    const dirty = await records(root, ['status', '--porcelain', '--', ...scope])
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
