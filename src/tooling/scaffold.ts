import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { isStackExcluded, loadManifest } from '@/tooling/manifest'

export interface ScaffoldOptions {
  /** Root holding `tooling/<stack>/manifest.toml`. */
  readonly root: string
  readonly stack: string
  readonly target: string
  /** Parent of the scratch folder the command runs in. Defaults to the OS temp dir. */
  readonly scratchBase?: string
}

export type ScaffoldRefusal =
  | 'excluded'
  | 'no-manifest'
  | 'no-scaffold'
  | 'not-empty'
  | 'bad-name'
  | 'scaffold-failed'
  | 'no-output'
  | 'prepare-failed'

/**
 * `initialized` is a fresh `git init -b main`, `existing` a target already inside a work tree, which a scaffold
 * into a monorepo subfolder must not nest a second repository in, and `failed` an init that exited non-zero.
 */
export type ScaffoldGit = 'initialized' | 'existing' | 'failed'

export type ScaffoldResult =
  | {
      readonly ok: true
      readonly stack: string
      readonly target: string
      readonly name: string
      readonly files: readonly string[]
      readonly git: ScaffoldGit
    }
  | {
      readonly ok: false
      readonly reason: ScaffoldRefusal
      readonly message: string
      readonly suggested?: string
      readonly scratch?: string
      readonly output?: string
    }

/**
 * npm, create-next-app, and composer all refuse a package name with capitals,
 * spaces, or a leading dot, and the target's basename becomes that name.
 */
const PACKAGE_NAME = /^[a-z0-9][a-z0-9._-]*$/
const MAX_NAME = 214

/** A target holding only `.git` counts as empty, since `git init` first is common. */
const IGNORED_ENTRIES = new Set(['.git'])

/**
 * Runs the starter in a scratch folder with `{{name}}` set to the target's basename, applies the post-scaffold step
 * and then the `scaffold/` overlay, and moves the result into the target. Nothing reaches the target unless the
 * starter and the step both exit 0, and a failed run names the scratch folder it leaves.
 */
export async function scaffoldStack(
  opts: ScaffoldOptions,
): Promise<ScaffoldResult> {
  const { root, stack } = opts
  const target = resolve(opts.target)

  if (isStackExcluded(stack)) {
    return refuse('excluded', `Stack '${stack}' is excluded from tooling.`)
  }
  const manifest = loadManifest(root, stack)
  if (manifest === undefined) {
    return refuse(
      'no-manifest',
      `No manifest at tooling/${stack}/manifest.toml`,
    )
  }
  if (manifest.scaffold === undefined) {
    return refuse(
      'no-scaffold',
      `Stack '${stack}' has no scaffold command in its manifest.`,
    )
  }

  const held = existsSync(target) ? occupiedEntries(target) : []
  if (held.length > 0) {
    return refuse(
      'not-empty',
      `${target} is not empty (${held.slice(0, 3).join(', ')}${held.length > 3 ? ', ...' : ''}). Scaffold into an empty folder.`,
    )
  }

  const name = basename(target)
  if (!PACKAGE_NAME.test(name) || name.length > MAX_NAME) {
    const suggested = suggestName(name)
    return {
      ok: false,
      reason: 'bad-name',
      message: `Folder name '${name}' is not a valid package name. Use lowercase letters, digits, '.', '_', and '-', such as '${suggested}'.`,
      suggested,
    }
  }

  const scratch = mkdtempSync(
    join(opts.scratchBase ?? tmpdir(), 'canon-scaffold-'),
  )
  const command = manifest.scaffold.replaceAll('{{name}}', name)
  const run = await shell(command, scratch)
  const output = typeof run.all === 'string' ? run.all : ''

  if (run.failed) {
    return {
      ok: false,
      reason: 'scaffold-failed',
      message: `Scaffold command failed: ${command}`,
      scratch,
      output,
    }
  }
  const produced = join(scratch, name)
  if (!existsSync(produced)) {
    return {
      ok: false,
      reason: 'no-output',
      message: `Scaffold command exited 0 but produced no ${name}/ folder.`,
      scratch,
      output,
    }
  }

  if (manifest.prepare !== undefined) {
    const step = await shell(manifest.prepare, produced)
    if (step.failed) {
      return {
        ok: false,
        reason: 'prepare-failed',
        message: `Post-scaffold step failed: ${manifest.prepare}`,
        scratch,
        output: typeof step.all === 'string' ? step.all : '',
      }
    }
  }
  // The overlay lands after the step, since on a case-insensitive filesystem a step removing `App.tsx` would
  // otherwise delete an overlay's `app.tsx`.
  const overlay = join(manifest.dir, 'scaffold')
  if (existsSync(overlay)) {
    cpSync(overlay, produced, { recursive: true, force: true })
  }

  mkdirSync(target, { recursive: true })
  const keepTargetGit = existsSync(join(target, '.git'))
  const files: string[] = []
  for (const entry of readdirSync(produced).sort()) {
    if (entry === '.git' && keepTargetGit) continue
    move(join(produced, entry), join(target, entry))
    files.push(entry)
  }
  rmSync(scratch, { recursive: true, force: true })

  return { ok: true, stack, target, name, files, git: await initGit(target) }
}

/** A failed init never fails the scaffold, since the files already reached the target. */
async function initGit(target: string): Promise<ScaffoldGit> {
  if (existsSync(join(target, '.git'))) return 'existing'
  const git = (args: readonly string[]) =>
    execa('git', args, {
      cwd: target,
      reject: false,
      stdin: 'ignore',
      env: gitEnv(),
      extendEnv: false,
    })
  const probe = await git(['rev-parse', '--is-inside-work-tree'])
  if (!probe.failed && probe.stdout.trim() === 'true') return 'existing'
  const init = await git(['init', '-q', '-b', 'main'])
  return init.failed ? 'failed' : 'initialized'
}

// Manifests carry shell syntax (`&&`, `cd`, quoted globs), so each command runs under a shell.
function shell(command: string, cwd: string) {
  return execa(command, {
    cwd,
    shell: 'bash',
    all: true,
    reject: false,
    stdin: 'ignore',
    env: { CI: '1' },
  })
}

function refuse(reason: ScaffoldRefusal, message: string): ScaffoldResult {
  return { ok: false, reason, message }
}

function occupiedEntries(dir: string): string[] {
  return readdirSync(dir)
    .filter((entry) => !IGNORED_ENTRIES.has(entry))
    .sort()
}

/**
 * Lowercases the name and turns every run of other characters into one dash,
 * falling back to `app` when nothing usable is left.
 */
export function suggestName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+$/, '')
    .slice(0, MAX_NAME)
  return cleaned === '' ? 'app' : cleaned
}

/** The OS temp dir often sits on another filesystem, where a rename fails. */
function move(from: string, to: string): void {
  try {
    renameSync(from, to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
    cpSync(from, to, { recursive: true, preserveTimestamps: true })
    rmSync(from, { recursive: true, force: true })
  }
}
