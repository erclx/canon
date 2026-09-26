import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execa } from 'execa'

/**
 * Why no unknown-word list was produced, which is never the same as a clean
 * one.
 *
 * `no-binary` is the binary being absent anywhere from the root upward.
 * `cspell` is a devDependency of this repository alone, per
 * `775-dependencies.md`'s ban on importing a transitive-only package, so a
 * target project that never adopted it gets no coverage from this check
 * rather than a network fetch or a forced new dependency.
 *
 * `check-failed` is the binary running and returning neither of the two
 * codes it defines, clean or issues found. `reject: false` is right, because
 * a findings exit is the ordinary outcome for half of this check's runs, but
 * discarding the code outright folded a crash, a bad config, or an
 * unreadable dictionary into the same empty-stdout shape a clean title
 * produces. Reading it the way `spawnAudit` in `src/audits/run.ts` reads its
 * own child processes is what tells the two apart.
 */
export type SpellingRefusal = 'no-binary' | 'check-failed'

export type SpellingScan =
  | { readonly kind: 'checked'; readonly unknownWords: readonly string[] }
  | {
      readonly kind: 'unavailable'
      readonly reason: 'no-binary'
      readonly probedFrom: string
    }
  | {
      readonly kind: 'unavailable'
      readonly reason: 'check-failed'
      readonly message: string
    }

const CSPELL_EXIT_CLEAN = 0
const CSPELL_EXIT_ISSUES_FOUND = 1

/**
 * Reads `cspell stdin --words-only --unique`'s stdout into a clean list.
 *
 * `--unique` already dedupes on cspell's side, so this exists for the same
 * reason `parseAdvisories` exists beside `auditDependencies`: a pure function
 * over a fixture string is a unit test that needs no binary on the machine
 * running it, where the trailing blank line an empty scan's stdout carries
 * is what actually needs the trim-and-filter below.
 */
export function parseUnknownWords(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0)
}

/**
 * Walks from `root` up to the filesystem root looking for a resolved
 * `cspell` binary, stopping at the first `node_modules/.bin/cspell` found.
 *
 * A caller running `canon labels scan` from a subdirectory of the checkout,
 * rather than from its own root, is what a single `join(root, …)` check
 * missed: `node_modules` sits at the checkout root, so the check found
 * nothing, the title went unchecked, and the command exited 0 with no path
 * naming what was probed or where it stopped looking.
 */
function resolveCspellBinary(root: string): string | undefined {
  let dir = resolve(root)

  while (true) {
    const candidate = join(dir, 'node_modules', '.bin', 'cspell')
    if (existsSync(candidate)) return candidate

    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * Shells this repository's own resolved `cspell` binary against a title over
 * stdin, rather than a bare `execa('cspell', …)`.
 *
 * `bun src/cli.ts labels scan` is the exact invocation `phase-label-gate.yml`
 * uses, and it runs outside `bun run`, so `node_modules/.bin` is not on
 * `PATH` and a bare spawn throws `ENOENT`. Resolving the binary path directly
 * under `root`, or an ancestor of it, is what a caller running from this
 * checkout needs, and it is also what keeps the check from reaching a
 * `bunx` fallback that could fetch `cspell` from the network on a machine
 * that never asked for it.
 */
export async function scanTitleSpelling(
  title: string,
  root: string,
): Promise<SpellingScan> {
  const binary = resolveCspellBinary(root)

  if (binary === undefined) {
    return { kind: 'unavailable', reason: 'no-binary', probedFrom: root }
  }

  const result = await execa(
    binary,
    ['stdin', '--words-only', '--unique', '--no-progress', '--no-summary'],
    { cwd: root, input: title, reject: false },
  )

  if (
    result.exitCode !== CSPELL_EXIT_CLEAN &&
    result.exitCode !== CSPELL_EXIT_ISSUES_FOUND
  ) {
    return {
      kind: 'unavailable',
      reason: 'check-failed',
      message: result.stderr.trim().split('\n').pop() || 'no output on stderr',
    }
  }

  return { kind: 'checked', unknownWords: parseUnknownWords(result.stdout) }
}
