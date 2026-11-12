import type { Command } from 'commander'
import { resolve } from 'node:path'
import { machineListenerReader } from '@/listeners/machine'
import { findEvidenceCommentId } from '@/pr/evidence'
import { LOCAL_CONFIG_REL, readHealthPaths } from '@/pr/health'
import {
  dropAddressLine,
  maskLocalAddress,
  findLocalServer,
  type LocalRefusal,
  type LocalRunner,
} from '@/pr/local'
import { type RestReview } from '@/pr/rest'
import { intro, logInfo, logStep, outro } from '@/cli/ui'
import {
  PULL_REFUSALS,
  ReadOptions,
  gh,
  listComments,
  listReviews,
  refuseWith,
  resolvePullNumber,
  resolveWorktreeRoot,
} from '@/commands/pr/pull'

interface LocalOptions extends ReadOptions {
  readonly remove?: boolean
}

/** How long the probe waits on a listener before reading it as not a server. */
const LOCAL_PROBE_TIMEOUT_MS = 2_000

const LOCAL_REFUSALS: Record<
  LocalRefusal | 'invalid-config' | 'gh-failed',
  string
> = {
  'no-server':
    'Nothing listening inside this worktree served an HTML page. Start the dev server here and re-run to get a link.',
  unhealthy:
    'A page answered inside this worktree, but a health path it declares failed. Start what the page reaches and re-run to get a link.',
  'invalid-config': `${LOCAL_CONFIG_REL} cannot be read, so no health path was checked and no link is given. Fix or delete it and re-run. health takes paths starting with /, and page-only takes folders relative to the repository.`,
  'no-listener-reader':
    'This machine offers neither lsof nor /proc, so no listening socket could be read. Nothing is posted.',
  'gh-failed':
    'gh could not read or edit the marked comment on this pull request.',
}

export function registerLocal(pr: Command): void {
  pr.command('local')
    .description(
      "Find the server this worktree is running and report its localhost address, or remove it from the pull request's evidence comment",
    )
    .argument('[number]', 'Pull request to edit on --remove')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Worktree to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--remove',
      "Drop the evidence comment's preview address line and mask local addresses in UI reviews",
    )
    .addHelpText(
      'after',
      [
        '',
        'Reads every TCP socket in LISTEN, keeps those whose owning process runs',
        "inside this worktree's toplevel, and requests / on each. The lowest",
        'port serving an HTML page is reported, which skips a test runner or a',
        'reload socket answering in the same tree.',
        '',
        'A project can declare paths the page must also serve, in',
        'canon/config/local.toml as health = ["/api/health"]. Each is requested',
        "on the page's own port, redirects followed, and only a final 2xx",
        'passes. A page failing one is skipped for the next page port, and the',
        "refusal names the lowest page port's first failing path. An absent",
        'file or an empty list checks the page alone.',
        '',
        'A page served by a static server answers none of those paths, so',
        'page-only = ["web"] lists repository-relative folders whose',
        'listeners skip them and are found on the page probe alone. The match',
        "reads the listener's working directory on whole path segments, so web",
        'does not cover webapp, and a server started from the root with a',
        'working-directory flag still takes the health check. Keep health',
        'beside page-only until the binary a project runs carries this key,',
        'since an older one refuses a file holding page-only alone.',
        '',
        'A process in a sibling worktree, in the main checkout seen from a',
        'linked worktree, or in a linked worktree seen from the main checkout',
        'is never reported, since its server shows another branch. Sockets are',
        'read through /proc where it exists, or through lsof on a machine',
        'without it.',
        '',
        '--remove reads the pull request comment carrying the pr-evidence',
        'marker and drops its address line, the **Preview:** and **Local',
        'preview:** segments together, leaving no note in its place. It edits',
        'the comment itself so a close workflow with no session can call it,',
        'and drops the hosted link too because the same close deletes the',
        "branch's preview deployments.",
        '',
        'It also rewrites the loopback address on the Driven at line of every',
        'review carrying the review-ui marker to "a local preview", keeping',
        'the head and the renderer. A hosted address and a code review are',
        'left alone, and `reviews` on the JSON record counts the rewrites.',
        '',
        'Read `reason` on the JSON record:',
        '  ok                  a page answered, with its address in `url`',
        '  no-server           nothing inside this worktree served a page',
        '  no-listener-reader  neither lsof nor /proc is available',
        '  unhealthy           a page answered but a declared health path did',
        '                      not, with `port`, `path`, and `status`, which',
        '                      is null on a timeout',
        '  invalid-config      canon/config/local.toml is not valid TOML,',
        '                      health is not a list of paths starting with /,',
        '                      or page-only is not a list of relative folders',
        '  removed             --remove dropped the line',
        '  no-comment          --remove found no marked comment, a no-op',
        '  no-line             --remove found no address line, a no-op',
        '',
        'Refusals, read off `reason`:',
        '  gh-missing  `--remove` needs `gh` and it is not on the path',
        '  gh-failed   `--remove` could not read the thread, or edit the',
        '              comment or a review, after trying every edit',
        '',
        'Exit codes:',
        '  0  a server was found, or --remove finished, including a no-op',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr local --json',
        '  canon pr local 1341 --remove --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: LocalOptions) => {
      process.exitCode =
        opts.remove === true
          ? await runLocalRemove(number, opts)
          : await runLocal(opts)
    })
}

/** The listener reads come from the machine, and the HTML probe from here. */
function machineLocalRunner(): LocalRunner {
  return {
    ...machineListenerReader(),
    // An HTML page rather than any answer, since a test runner's server or a
    // reload socket in the same tree answers too, and a reviewer opening one
    // gets a bare 404 instead of the branch.
    async probe(port) {
      try {
        const response = await fetch(`http://localhost:${port}/`, {
          signal: AbortSignal.timeout(LOCAL_PROBE_TIMEOUT_MS),
        })
        await response.body?.cancel()
        return (response.headers.get('content-type') ?? '').includes(
          'text/html',
        )
      } catch {
        return false
      }
    },
    // The final status after redirects, so a login bounce ending on a 3xx or
    // a 4xx fails rather than reading as the backend answering.
    async check(port, path) {
      try {
        const response = await fetch(`http://localhost:${port}${path}`, {
          signal: AbortSignal.timeout(LOCAL_PROBE_TIMEOUT_MS),
        })
        await response.body?.cancel()
        return response.status
      } catch {
        return null
      }
    },
  }
}

async function runLocal(opts: LocalOptions): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr local')

  const worktree = await resolveWorktreeRoot(root)
  const declaration = readHealthPaths(worktree)
  if (declaration.kind === 'invalid') {
    return refuseWith(
      'invalid-config',
      `${declaration.reason}. ${LOCAL_REFUSALS['invalid-config']}`,
      emitJson,
      root,
    )
  }

  const result = await findLocalServer(
    worktree,
    machineLocalRunner(),
    declaration.kind === 'paths' ? declaration.paths : [],
    declaration.pageOnly,
  )
  if (result.kind === 'refused' && result.reason === 'unhealthy') {
    const { port, path, status } = result
    const answer =
      status === null
        ? `gave no answer within ${LOCAL_PROBE_TIMEOUT_MS / 1000} seconds`
        : `answered ${status}`
    return refuseWith(
      'unhealthy',
      `${LOCAL_REFUSALS.unhealthy} ${path} on http://localhost:${port} ${answer}.`,
      emitJson,
      root,
      { port, path, status },
    )
  }
  if (result.kind === 'refused') {
    return refuseWith(
      result.reason,
      LOCAL_REFUSALS[result.reason],
      emitJson,
      root,
    )
  }

  logStep('Local preview')
  logInfo(result.url)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, reason: 'ok', url: result.url, port: result.port })}\n`,
    )
  }
  return 0
}

/**
 * Drops the address line on the marked comment and masks the loopback address
 * on every UI review. The verb writes here rather than handing a body back,
 * because its caller is a close workflow with no session to post one.
 */
async function runLocalRemove(
  number: string | undefined,
  opts: LocalOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr local --remove')

  if (Bun.which('gh') === null) {
    return refuseWith('gh-missing', PULL_REFUSALS['gh-missing'], emitJson, root)
  }

  const resolved = await resolvePullNumber(root, number)
  if (resolved.kind === 'refused') {
    const reason = resolved.reason
    return refuseWith(
      reason,
      reason === 'ambiguous-pull'
        ? PULL_REFUSALS[reason]
        : LOCAL_REFUSALS[reason],
      emitJson,
      root,
    )
  }
  const [comments, reviews] = await Promise.all([
    listComments(root, resolved.number),
    listReviews(root, resolved.number),
  ])
  if (comments === undefined && reviews.kind === 'refused') {
    return refuseWith('gh-failed', LOCAL_REFUSALS['gh-failed'], emitJson, root)
  }

  // A refused read on one side still lets the other side's edits land, and
  // counts as a failure beside them, so one unread listing never strands both.
  const [evidence, masked] = await Promise.all([
    comments === undefined
      ? Promise.resolve<EvidenceRemoval>({ kind: 'failed' })
      : removeEvidenceAddress(root, comments),
    reviews.kind === 'refused'
      ? Promise.resolve({ rewritten: 0, failed: true })
      : maskUiReviews(root, resolved.number, reviews.rows),
  ])
  if (evidence.kind === 'failed' || masked.failed) {
    return refuseWith(
      'gh-failed',
      LOCAL_REFUSALS['gh-failed'],
      emitJson,
      root,
      {
        reviews: masked.rewritten,
      },
    )
  }

  logStep(evidence.reason === 'removed' ? 'Removed' : 'Skipped')
  logInfo(evidence.message)
  logInfo(`${masked.rewritten} UI review addresses masked`)
  outro()
  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, reason: evidence.reason, reviews: masked.rewritten })}\n`,
    )
  }
  return 0
}

type EvidenceRemoval =
  | {
      readonly kind: 'done'
      readonly reason: 'removed' | 'no-comment' | 'no-line'
      readonly message: string
    }
  | { readonly kind: 'failed' }

async function removeEvidenceAddress(
  root: string,
  comments: readonly { url?: string; body: string }[],
): Promise<EvidenceRemoval> {
  const commentId = findEvidenceCommentId(comments)
  const marked = comments.find((comment) =>
    comment.url?.endsWith(`#issuecomment-${commentId}`),
  )
  if (commentId === undefined || marked === undefined) {
    return {
      kind: 'done',
      reason: 'no-comment',
      message: 'No comment carries the evidence marker.',
    }
  }

  const dropped = dropAddressLine(marked.body)
  if (dropped === undefined) {
    return {
      kind: 'done',
      reason: 'no-line',
      message: 'The evidence comment carries no address line.',
    }
  }

  const patched = await gh(root, [
    'api',
    '-X',
    'PATCH',
    `repos/{owner}/{repo}/issues/comments/${commentId}`,
    '-f',
    `body=${dropped}`,
  ])
  return patched === null
    ? { kind: 'failed' }
    : { kind: 'done', reason: 'removed', message: `comment ${commentId}` }
}

const UI_REVIEW_MARKER = '<!-- review-ui: head='

/**
 * Masks the loopback address on each review `review-ui` posted, selected by
 * its marker so a code review quoting a local URL is never edited. Every
 * update is tried before a refusal is reported, so one refused review leaves
 * the rest masked.
 */
async function maskUiReviews(
  root: string,
  number: string,
  reviews: readonly RestReview[],
): Promise<{ readonly rewritten: number; readonly failed: boolean }> {
  const updates = reviews.flatMap((review) => {
    const body = review.body ?? ''
    if (review.id === undefined || !body.includes(UI_REVIEW_MARKER)) return []
    const masked = maskLocalAddress(body)
    if (masked === undefined) return []
    return [
      gh(root, [
        'api',
        '-X',
        'PUT',
        `repos/{owner}/{repo}/pulls/${number}/reviews/${review.id}`,
        '-f',
        `body=${masked}`,
      ]),
    ]
  })
  const results = await Promise.all(updates)
  const rewritten = results.filter((stdout) => stdout !== null).length
  return { rewritten, failed: rewritten < results.length }
}
