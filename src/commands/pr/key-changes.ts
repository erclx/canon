import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { $ } from 'bun'
import type { Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  listChangedFiles,
  listIgnoreAdditions,
  listRenames,
  listRepositoryFiles,
  parseIgnoreAdditions,
  type RenamePair,
  resolveBaseRef,
} from '@/git/files'
import {
  type Bijection,
  type BijectionRefusal,
  compareKeyChanges,
  treeRoots,
} from '@/pr/bijection'
import { linkKeyChanges } from '@/pr/links'
import { KEY_CHANGES } from '@/pr/paths'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  AMBIGUOUS_PULL,
  GH_TIMEOUT_MS,
  gh,
  readPull,
  refuseWith,
} from '@/commands/pr/pull'

/** How many unnamed files the frame prints before it names a count instead. */
const UNNAMED_PRINT_LIMIT = 10

interface KeyChangesOptions {
  readonly link?: boolean
  readonly body?: string
  readonly base?: string
  readonly root?: string
  readonly json?: boolean
}

/** Why the read produced no comparison, ahead of the ones the compare owns. */
type SourceRefusal =
  | 'gh-missing'
  | 'gh-failed'
  | 'ambiguous-pull'
  | 'unreadable-body'
  | 'unreadable-tree'
  | 'no-base'
  | 'bad-base'
  | 'unreadable-changes'

type Refusal = SourceRefusal | BijectionRefusal

/** What a reader does about each way this produced no reading. */
const REFUSALS: Record<Refusal, string> = {
  'gh-missing':
    'gh is not on the path, so no pull request body could be read. Pass --body <path> to read one off disk instead.',
  'gh-failed':
    'gh could not answer for this branch. Name the pull request number, or pass --body <path>.',
  'ambiguous-pull': AMBIGUOUS_PULL,
  'unreadable-body': 'The file named by --body could not be read.',
  'unreadable-tree':
    'git could not list this repository, so no path could be judged whole rather than partial.',
  'no-base': 'No base resolves against the trunk. Fetch origin or pass --base.',
  'bad-base':
    'The ref passed to --base shares no history with HEAD here, either because it resolves to no commit or because it sits on an unrelated root. Pass a ref this branch was taken from.',
  'unreadable-changes':
    'git could not list what this branch changed, so the set is unknown.',
  'no-section': `This body carries no ## ${KEY_CHANGES} section, so it claims nothing to compare.`,
  'no-claims': `The ## ${KEY_CHANGES} section carried no path this reader could resolve. That is the extractor failing over prose rather than the body being wrong, so nothing is raised.`,
  'no-changes':
    'The pull request changed no files, so there is nothing for a claim to answer.',
}

export function registerKeyChanges(pr: Command): void {
  pr.command('key-changes')
    .description(
      `Compare the files a body's ## ${KEY_CHANGES} names against its own diff`,
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--body <path>',
      'Read the body from a file rather than the API, ignoring any number except the one --link needs',
    )
    .option(
      '--base <ref>',
      'Far side of the range when --body supplies the body',
    )
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option(
      '--link',
      `Print the body with each ## ${KEY_CHANGES} path linked to its diff, needing a number`,
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'This repository squash-merges, so a pull request body becomes the commit',
        'message and the record on the trunk once the branch is gone. A bullet',
        'claiming a change nobody made corrupts that record, and a changed file no',
        'bullet names leaves it incomplete.',
        '',
        'The two directions carry different weight:',
        "  unmet      a whole path the body claims ahead of its bullet's first",
        '             comma and the diff does not carry, the graded direction',
        '  unnamed    a changed file no bullet reached that a reader might have',
        '             wanted one for, reported without a grade',
        '  incidental a changed file no bullet reached that owes none: a test, a',
        '             fixture, or a lockfile, held apart so the count above reads',
        '  unresolved a path written partially, or one past its first comma,',
        '             which can credit a changed file and never accuse one',
        '',
        `Only ## ${KEY_CHANGES} is read. ## Technical context legitimately names`,
        'files a branch never touched, so widening the read manufactures findings.',
        '',
        'One class survives the reader: a bullet citing where something is defined',
        'while claiming an edit elsewhere puts a real path in the claim region and',
        'points the change at a locative the path does not name. Read the bullet on',
        "the record's preview before filing an unmet path as a stale claim.",
        '',
        '--link prints the body and nothing else, with every path the section',
        'names that the diff changes written as a link to its row in the Files',
        'tab. The anchor is `diff-` and the SHA-256 of the path. Pass the pull',
        'request number, since the link needs it. It also rewrites the anchor',
        'of a link opening another file, and a plain run reports that link as',
        "mislinked when its label is a changed path and its anchor hashes another's.",
        '',
        'Refusals, read off `reason`:',
        '  no-section          the body carries no `## Key changes` heading, so it',
        '                      claims nothing',
        '  no-claims           the heading is there and no span resolved, which is',
        '                      the extractor failing over prose and raises nothing',
        '  no-changes          the pull request changed no files, so no claim has',
        '                      anything to answer',
        '  unreadable-body     the pull request body could not be read',
        '  unreadable-tree     the file tree of the head could not be read',
        '  no-base             GitHub reported no merge base for the pull request',
        '  bad-base            `--base` names a ref sharing no history with HEAD',
        '  unreadable-changes  the changed files could not be listed',
        '  ambiguous-pull      two open pull requests share the branch against',
        '                      different bases, so name a number',
        '  gh-missing          `gh` is not on the path, so no pull request could be',
        '                      resolved',
        '  gh-failed           `gh` could not answer for this repository or branch',
        '  no-number           --link was given with no pull request number',
        '  no-repo-url         --link could not read the repository address',
        '  link-json           --link was given with --json, though it prints the body',
        '',
        'Exit codes:',
        '  0  every claimed path is in the diff, and every link opens its own file',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  a claimed path is absent from the diff, or a link opens another file',
        '',
        'Examples:',
        '  canon pr key-changes',
        '  canon pr key-changes 1265 --link --body .canon/tmp/body.md',
        '  canon pr key-changes 1265 --json',
        '  canon pr key-changes --body .canon/tmp/body.md --base origin/main',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: KeyChangesOptions) => {
      process.exitCode = await runKeyChanges(number, opts)
    })
}

interface PullRequestRead {
  readonly body: string
  readonly changed: readonly string[]
  readonly head: string | undefined
  readonly number: number | undefined
  readonly renames: readonly RenamePair[]
  readonly ignoreAdditions: readonly string[]
  readonly evidenceUnread: boolean
}

type SourceRead =
  | { readonly kind: 'read'; readonly source: PullRequestRead }
  | { readonly kind: 'refused'; readonly reason: SourceRefusal }

/**
 * Reads the body and the changed set from the pull request the caller named,
 * or from the one open on this branch.
 *
 * The body comes off the pull read and the files off the paginated files
 * endpoint, since GraphQL is the only route that returns both in one call and
 * a cloud session's proxy refuses it. A push between the two reads can compare
 * a body against the next commit's files, which the paginated read already
 * risked for any pull request past the old view's cap of 100 files.
 */
async function readFromApi(
  cwd: string,
  number: string | undefined,
): Promise<SourceRead> {
  if (Bun.which('gh') === null) {
    return { kind: 'refused', reason: 'gh-missing' }
  }

  const pull = await readPull(cwd, number)
  if (pull.kind === 'refused') return pull

  const { row } = pull
  if (row.number === undefined) return { kind: 'refused', reason: 'gh-failed' }

  const changed = await listFilesByPage(cwd, row.number)
  if (changed === undefined) return { kind: 'refused', reason: 'gh-failed' }

  const body = row.body ?? ''
  const head = row.head?.sha
  const sorted = [...changed].sort()
  const evidence = await resolveApiEvidence(cwd, body, sorted, head, row.number)

  return {
    kind: 'read',
    source: {
      body,
      changed: sorted,
      head,
      number: row.number,
      renames: evidence.renames,
      ignoreAdditions: evidence.ignoreAdditions,
      evidenceUnread: evidence.unread,
    },
  }
}

/**
 * A rename's source path and a `.gitignore` addition, fetched only when a
 * first pass with neither already reports an unmet claim.
 *
 * The probe pays for a repository listing this read takes again a moment
 * later in `runKeyChanges`, and the full-row `gh api …/files` call besides it
 * only on the pass that already has something to double-check.
 *
 * `unread` separates a read that failed from one that succeeded and found
 * neither, which an empty `renames`/`ignoreAdditions` cannot do on its own.
 * `listFilesByPage` above refuses the whole comparison on exactly this
 * ground: a set known to be short would let a correct bullet accuse a file
 * nobody changed. This carries the same refusal as a flag rather than a
 * refused `Bijection`, since the base comparison can still run and most
 * claims never touch a rename or a `.gitignore` line at all.
 */
async function resolveApiEvidence(
  cwd: string,
  body: string,
  changed: readonly string[],
  head: string | undefined,
  number: number | undefined,
): Promise<{
  readonly renames: readonly RenamePair[]
  readonly ignoreAdditions: readonly string[]
  readonly unread: boolean
}> {
  const clean = { renames: [], ignoreAdditions: [], unread: false }
  const unread = { renames: [], ignoreAdditions: [], unread: true }

  const tracked = await listRepositoryFiles(cwd)
  if (tracked === undefined) return unread

  const probe = compareKeyChanges({
    body,
    changed,
    roots: treeRoots(tracked, changed),
    ...(head !== undefined && { head }),
  })
  // A refusal here means there is no claim to credit at all, and a clean
  // pass means every claim already resolved without the extra evidence, so
  // neither case leaves anything for unread evidence to have mattered to.
  if (probe.kind !== 'measured' || probe.unmet.length === 0) return clean

  // Only past this point does a missing pull request number become a real
  // gap: there is a claim the probe could not credit, and no number to fetch
  // the evidence that might explain it.
  if (number === undefined) return unread

  // No `--jq` filter here, unlike `listFilesByPage` above. Shaping each row to
  // {filename, previous_filename, status, patch} would make `--paginate`
  // concatenate one filtered value per page rather than one combined array,
  // and gh's own pretty-printing of an object result (unlike the scalar
  // strings `--jq '.[].filename'` yields) is not guaranteed to stay
  // line-parseable. Parsing the raw paginated array is safe under both.
  const stdout = await gh(cwd, [
    'api',
    '--paginate',
    `repos/{owner}/{repo}/pulls/${number}/files`,
  ])
  if (stdout === null) return unread

  let rows: readonly {
    readonly filename: string
    readonly previous_filename?: string
    readonly status: string
    readonly patch?: string
  }[]
  try {
    rows = JSON.parse(stdout)
  } catch {
    return unread
  }

  const renames = rows
    .filter(
      (row): row is typeof row & { previous_filename: string } =>
        row.status === 'renamed' && row.previous_filename !== undefined,
    )
    .map((row) => ({ from: row.previous_filename, to: row.filename }))

  const ignoreRow = rows.find((row) => row.filename === '.gitignore')
  const ignoreAdditions =
    ignoreRow?.patch !== undefined ? parseIgnoreAdditions(ignoreRow.patch) : []

  return { renames, ignoreAdditions, unread: false }
}

/**
 * Every file a pull request changed, read through the paginated endpoint.
 *
 * Returns undefined when any page fails, which refuses rather than comparing
 * the pages that arrived: a comparison run against a set known to be short
 * would accuse a correct bullet of naming a file nobody changed.
 */
async function listFilesByPage(
  cwd: string,
  number: number,
): Promise<string[] | undefined> {
  try {
    // See src/worktrees/reclaim.ts for why gh needs the stripped environment.
    const result = await execa(
      'gh',
      [
        'api',
        '--paginate',
        `repos/{owner}/{repo}/pulls/${number}/files`,
        '--jq',
        '.[].filename',
      ],
      { cwd, timeout: GH_TIMEOUT_MS, env: gitEnv(), extendEnv: false },
    )
    return result.stdout.split('\n').filter(Boolean)
  } catch {
    return undefined
  }
}

/**
 * Reads the body off disk and the changed set from git, which is the shape a
 * fixture and a body still being drafted both need.
 *
 * `cwd` and `root` diverge when a caller passes `--root` to read a pull
 * request against a worktree other than the one they are standing in. The
 * body path is resolved against `cwd`, since it is correct from where the
 * caller stands regardless of which tree `--root` names.
 */
async function readFromFile(
  root: string,
  cwd: string,
  path: string,
  base: string | undefined,
): Promise<SourceRead> {
  let body: string
  try {
    body = await readFile(resolve(cwd, path), 'utf8')
  } catch {
    return { kind: 'refused', reason: 'unreadable-body' }
  }

  const resolved = await resolveBaseRef(root, base)
  if (resolved === undefined) {
    return {
      kind: 'refused',
      reason: base === undefined ? 'no-base' : 'bad-base',
    }
  }

  const changed = await listChangedFiles(root, resolved)
  if (changed === undefined) {
    return { kind: 'refused', reason: 'unreadable-changes' }
  }

  const [head, renames, ignoreAdditions] = await Promise.all([
    $`git -C ${root} rev-parse HEAD`.env(gitEnv()).quiet().nothrow(),
    listRenames(root, resolved),
    listIgnoreAdditions(root, resolved),
  ])

  return {
    kind: 'read',
    source: {
      body,
      changed,
      head: head.exitCode === 0 ? head.text().trim() : undefined,
      number: undefined,
      renames: renames ?? [],
      ignoreAdditions: ignoreAdditions ?? [],
      evidenceUnread: renames === undefined || ignoreAdditions === undefined,
    },
  }
}

async function runKeyChanges(
  number: string | undefined,
  opts: KeyChangesOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  if (opts.link === true) return runKeyChangesLink(number, opts, root)

  intro('canon pr key-changes')

  const source =
    opts.body === undefined
      ? await readFromApi(root, number)
      : await readFromFile(root, process.cwd(), opts.body, opts.base)

  if (source.kind === 'refused') return refuse(source.reason, emitJson, root)

  const tracked = await listRepositoryFiles(root)
  if (tracked === undefined) return refuse('unreadable-tree', emitJson, root)

  const report: Bijection = compareKeyChanges({
    body: source.source.body,
    changed: source.source.changed,
    roots: treeRoots(tracked, source.source.changed),
    renames: source.source.renames,
    ignoreAdditions: source.source.ignoreAdditions,
    evidenceUnread: source.source.evidenceUnread,
    ...(source.source.head !== undefined && { head: source.source.head }),
  })

  if (report.kind === 'refused') return refuse(report.reason, emitJson, root)

  logStep('Scope')
  logInfo(
    `${plural(report.claims.length, 'claim')} against ${plural(report.changed.length, 'changed file')}${
      report.head === undefined ? '' : ` at ${report.head.slice(0, 8)}`
    }`,
  )
  if (report.evidenceUnread) {
    logWarn(
      'Rename or .gitignore-addition evidence could not be read, so a claim it might have credited or accused landed in unresolved rather than unmet.',
    )
  }

  logStep(report.unmet.length === 0 ? 'Claimed' : 'Unmet')
  if (report.unmet.length === 0) {
    logInfo('every claimed path is in the diff')
  } else {
    logWarn(
      `${plural(report.unmet.length, 'claimed path')} the diff does not carry. Correct the bullet, or make the change it describes.`,
    )
    for (const claim of report.unmet) {
      logWarn(`${claim.path} — ${claim.preview}`)
    }
  }

  // Named rather than counted into the verdict. A generated asset, a lockfile,
  // and a regenerated index all change without earning a bullet, so grading
  // this direction would fire on nearly every branch.
  logStep('Unnamed')
  if (report.unnamed.length === 0) {
    logInfo('every changed file is reached by a bullet')
  } else {
    logInfo(
      `${plural(report.unnamed.length, 'changed file')} no bullet reached. Add one where the change is worth a reader knowing about.`,
    )
    // Capped in the frame and whole in the record. A rename branch measured
    // here left 71 of its 100 files unnamed, correctly, and printing all of
    // them buries the graded direction above under a list nobody reads.
    for (const path of report.unnamed.slice(0, UNNAMED_PRINT_LIMIT)) {
      logInfo(path)
    }
    if (report.unnamed.length > UNNAMED_PRINT_LIMIT) {
      logInfo(
        `…and ${report.unnamed.length - UNNAMED_PRINT_LIMIT} more, whole in the --json record.`,
      )
    }
  }
  if (report.incidental.length > 0) {
    logInfo(
      `${plural(report.incidental.length, 'further changed file')} set aside as owing no bullet, whole in the --json record.`,
    )
  }

  if (report.unresolved.length > 0) {
    logStep('Unresolved')
    logInfo(
      `${plural(report.unresolved.length, 'path')} written partially or trailing its bullet's first comma, so neither direction judged it.`,
    )
    for (const claim of report.unresolved) logInfo(claim.path)
  }

  if (report.mislinked.length > 0) {
    logStep('Mislinked')
    logWarn(
      `${plural(report.mislinked.length, 'link')} open another file's diff than the path they name. Re-run with --link to print the body with them corrected.`,
    )
    for (const link of report.mislinked) logWarn(link.path)
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(source.source.number !== undefined && {
          number: source.source.number,
        }),
        ...(report.head !== undefined && { head: report.head }),
        changed: report.changed,
        claims: report.claims,
        unmet: report.unmet,
        unnamed: report.unnamed,
        incidental: report.incidental,
        unresolved: report.unresolved,
        evidenceUnread: report.evidenceUnread,
        mislinked: report.mislinked,
      })}\n`,
    )
  }

  return report.unmet.length === 0 && report.mislinked.length === 0 ? 0 : 2
}

/**
 * Prints the body with each changed path in `## Key changes` linked to its
 * diff, and nothing else, so stdout pipes straight into a body file.
 *
 * Skips the frame `intro` opens, which would land in the piped body. Refusals
 * keep the framed shape on stdout like every other mode.
 */
async function runKeyChangesLink(
  number: string | undefined,
  opts: KeyChangesOptions,
  root: string,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (emitJson) {
    return refuseWith(
      'link-json',
      '--link prints the body itself, so it takes no --json record.',
      emitJson,
      root,
    )
  }

  const source =
    opts.body === undefined
      ? await readFromApi(root, number)
      : await readFromFile(root, process.cwd(), opts.body, opts.base)
  if (source.kind === 'refused') return refuse(source.reason, emitJson, root)

  const pull = number ?? source.source.number?.toString()
  if (pull === undefined) {
    return refuseWith(
      'no-number',
      'The link needs the pull request number, so pass it as the argument.',
      emitJson,
      root,
    )
  }

  const url = await readRepoUrl(root)
  if (url === undefined) {
    return refuseWith(
      'no-repo-url',
      'gh could not read the repository address, so no link was built.',
      emitJson,
      root,
    )
  }

  process.stdout.write(
    linkKeyChanges(
      source.source.body,
      source.source.changed,
      `${url}/pull/${pull}/files`,
    ),
  )
  return 0
}

/** The repository's web address off the REST repository read, for the same reason as `readRepoName`. */
async function readRepoUrl(root: string): Promise<string | undefined> {
  const row = await gh(root, ['api', 'repos/{owner}/{repo}'])
  if (row === null) return undefined
  try {
    const url = (JSON.parse(row) as { html_url?: unknown }).html_url
    return typeof url === 'string' && url !== '' ? url : undefined
  } catch {
    return undefined
  }
}

/**
 * Frames a refusal on stderr in both modes and puts the record on stdout alone,
 * so an operator reading the terminal sees the reason rather than a command
 * that appeared to do nothing.
 */
function refuse(reason: Refusal, emitJson: boolean, root: string): number {
  return refuseWith(reason, REFUSALS[reason], emitJson, root)
}
