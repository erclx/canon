import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execaSync } from 'execa'

export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..')
export const CLI = join(REPO_ROOT, 'src', 'cli.ts')
export const RUN_TIMEOUT_MS = 30_000

export const FAKE_GH = join(import.meta.dirname, '..', 'fixtures', 'gh.sh')

/**
 * A `gh` stand-in that answers the reads `pr evidence` and `pr local` make and
 * records the body of any `gh api` write, so the command surface runs end to
 * end without a network. The program is `fixtures/gh.sh`, and the `gh` written
 * here is a wrapper exporting the three paths it reads.
 *
 * The pull request's files, head, and merge base come from the repository's
 * own `main...HEAD` unless a fixture beside `apiLog` names them: `files.tsv`
 * holds `status<TAB>path` rows, `head` a sha, `merge-base` a sha, and
 * `files-fail` makes the files read fail. `base-tree.json` answers the base
 * branch's recursive tree read, which fails without it. The rows become the files API's JSON
 * array and pass through the `--jq` filter the caller sent, so a filter that
 * mangles its own output fails here as it would against GitHub. Every files
 * read appends its arguments to `files-calls.log`.
 */
export function writeFakeGh(
  bin: string,
  comments: string,
  apiLog: string,
): void {
  mkdirSync(bin, { recursive: true })
  const quote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`
  const wrapper = [
    '#!/usr/bin/env bash',
    `export FAKE_GH_FX=${quote(dirname(apiLog))}`,
    `export FAKE_GH_COMMENTS=${quote(comments)}`,
    `export FAKE_GH_API_LOG=${quote(apiLog)}`,
    `exec bash ${quote(FAKE_GH)} "$@"`,
    '',
  ].join('\n')
  writeFileSync(join(bin, 'gh'), wrapper, { mode: 0o755 })
}

export function initBranchRepo(
  root: string,
  files: Record<string, string>,
): void {
  const git = (...args: string[]) =>
    execaSync('git', ['-C', root, ...args], {
      env: {
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    })
  git('init', '-q', '-b', 'main')
  writeFileSync(join(root, 'README.md'), '# r\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  git('checkout', '-q', '-b', 'feat/x')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  git('add', '.')
  git('commit', '-q', '--allow-empty', '-m', 'change')
}

export const REEL_LINK =
  'https://github.com/o/r/blob/canon/frames/pr-7/abc1234/20261026T120000Z/reel.webp?raw=true'

/** A marked comment body carrying every field the record reports, in the shape `renderEvidenceBody` writes. */
export function markedCommentBody(): string {
  return [
    '## Evidence',
    '',
    '**Preview:** https://feat-x.site.pages.dev · **Local preview:** http://localhost:5173',
    '',
    '## What to look at',
    '',
    '<!-- pr-checklist:start -->',
    '- [x] the hero settles',
    '- [ ] the footer wraps',
    '<!-- pr-checklist:end -->',
    '',
    '<!-- pr-evidence: head=abc123 -->',
  ].join('\n')
}

/** A fenced deploy whose push trigger builds only from `web/`, in YAML the filter reader can parse. */
export const WEB_ONLY_DEPLOY = [
  'on:',
  '  push:',
  '    branches: [main]',
  '    paths:',
  "      - 'web/**'",
  '  workflow_dispatch:',
  'jobs:',
  '  deploy:',
  '    steps:',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
  '      - run: wrangler pages deploy dist --branch=${{ github.ref_name }}',
  '      - run: |',
  '          echo "canon-preview-alias: $ALIAS_URL"',
  '',
].join('\n')

/**
 * A `gh` standing in for the GitHub proxy a cloud session runs behind, which
 * serves REST and refuses GraphQL with a 403. Every `pr` subcommand, every
 * `repo view`, and every `graphql` call runs on GraphQL, so each one fails
 * here and a verb that reintroduces one fails the test that drives it.
 *
 * Fixtures live in `FAKE_DIR`: `pull.json` answers the single pull read,
 * `listing.json` the branch lookup, `reviews.json` the reviews read (a stream
 * of arrays stands for several pages), and `reviews-fail` makes that read 403.
 * `merge-409` makes the REST merge answer a moved head, as gh reports it.
 * `runs.json` answers the tip's workflow runs and `jobs.json` every run's
 * jobs, and either read fails when its file is absent.
 * The caller's `--jq` filter runs over each answer, as gh runs it.
 */
export const PROXY_GH = readFileSync(
  new URL('../fixtures/gh-proxy.sh', import.meta.url),
  'utf8',
)
