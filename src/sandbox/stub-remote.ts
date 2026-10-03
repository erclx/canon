import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const STUB_ORG = 'stub-org'
const ANCHOR_REPO = 'canon-sandbox'

/** The URL `sandbox_anchor_url` builds once `GITHUB_ORG` names the stub organization. */
export const STUB_ANCHOR_URL = `https://github.com/${STUB_ORG}/${ANCHOR_REPO}.git`

/** Port 9 is the discard service, which nothing listens on, so a real HTTPS attempt fails. */
const DEAD_PROXY = 'http://127.0.0.1:9'

/** Pinned so a commit id depends on its tree alone and two provisions of one tree agree. */
const PINNED_DATE = '2026-01-01T00:00:00Z'

/**
 * Answers the `gh` calls the git scenarios make and fails on any other, so a new
 * call reaches a reader as a red arm rather than a silent pass. Every call is
 * logged as one line, quoted so an argument holding a space stays one argument.
 */
const STUB_GH = `#!/usr/bin/env bash
# stub gh
dir="$STUB_GH_DIR"
line="$(printf '%q ' "$@")"
line="\${line% }"
printf '%s\\n' "$line" >>"$dir/gh.log"

case "$1" in
api) exit 0 ;;
pr)
  case "$2" in
  create)
    count="$(cat "$dir/pr-count" 2>/dev/null || echo 0)"
    count=$((count + 1))
    echo "$count" >"$dir/pr-count"
    echo "https://github.com/${STUB_ORG}/${ANCHOR_REPO}/pull/$count"
    exit 0
    ;;
  close | list) exit 0 ;;
  esac
  ;;
esac

printf '%s\\n' "$line" >>"$dir/gh-unknown.log"
echo "stub gh: unknown call: $line" >&2
exit 1
`

/**
 * Builds a local bare repository and a stub `gh` under `stubDir` and returns the
 * environment that sends a provision's pushes and `gh` calls there. Nothing in
 * it reaches the shared anchor: the URL rewrite turns every push into a file
 * path, and the stub heads `PATH` ahead of any real `gh`.
 */
export function createStubRemote(stubDir: string): Record<string, string> {
  rmSync(stubDir, { recursive: true, force: true })
  const bin = join(stubDir, 'bin')
  const remotes = join(stubDir, 'remotes')
  mkdirSync(bin, { recursive: true })
  mkdirSync(remotes, { recursive: true })

  execFileSync(
    'git',
    ['init', '-q', '--bare', '-b', 'main', join(remotes, `${ANCHOR_REPO}.git`)],
    { stdio: 'ignore' },
  )

  const gh = join(bin, 'gh')
  writeFileSync(gh, STUB_GH)
  chmodSync(gh, 0o755)

  return {
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    STUB_GH_DIR: stubDir,
    GITHUB_ORG: STUB_ORG,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.${remotes}/.insteadOf`,
    GIT_CONFIG_VALUE_0: `https://github.com/${STUB_ORG}/`,
    GIT_AUTHOR_DATE: PINNED_DATE,
    GIT_COMMITTER_DATE: PINNED_DATE,
    HTTPS_PROXY: DEAD_PROXY,
    https_proxy: DEAD_PROXY,
    ALL_PROXY: DEAD_PROXY,
  }
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd()
}

function readLog(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8').trimEnd() : ''
}

/**
 * Reads what a provision left in the stub: the `gh` calls, the calls it did not
 * recognize, and for each bare repository every ref with its tip tree and the
 * commit subjects beneath it. A tree id carries no timestamp, so it compares
 * across two runs where a commit id would not.
 */
export function readStubManifest(stubDir: string): Map<string, string> {
  const manifest = new Map<string, string>()
  manifest.set('stub:gh', readLog(join(stubDir, 'gh.log')))
  manifest.set('stub:gh-unknown', readLog(join(stubDir, 'gh-unknown.log')))

  const remotes = join(stubDir, 'remotes')
  if (!existsSync(remotes)) return manifest

  for (const entry of readdirSync(remotes).sort()) {
    if (!entry.endsWith('.git')) continue
    const repo = join(remotes, entry)
    const name = entry.slice(0, -'.git'.length)

    const refs = git(repo, ['for-each-ref', '--format=%(refname) %(tree)'])
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => {
        const ref = line.split(' ')[0] ?? ''
        const subjects = git(repo, ['log', '--format=  %s', '--reverse', ref])

        return `${line}\n${subjects}`
      })
    manifest.set(`stub:${name}:refs`, refs.join('\n'))
  }

  return manifest
}
