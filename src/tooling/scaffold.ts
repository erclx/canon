import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { writeAppRoot } from '@/sync/stamp'
import { DEFAULT_APP_ROOT, parseAppRoot } from '@/tooling/app-root'
import {
  configFiles,
  isStackExcluded,
  loadManifest,
  resolveChain,
  seedFiles,
} from '@/tooling/manifest'

export interface ScaffoldOptions {
  /** Root holding `tooling/<stack>/manifest.toml`. */
  readonly root: string
  readonly stack: string
  readonly target: string
  /** Parent of the scratch folder the command runs in. Defaults to the OS temp dir. */
  readonly scratchBase?: string
  /**
   * The folder the app lands in, for a stack whose manifest declares `[scaffold] app-root`. Unset, or `src`,
   * scaffolds as the starter writes it.
   */
  readonly appRoot?: string
  /** The time the recorded root is stamped with. Defaults to now. */
  readonly now?: Date
}

export type ScaffoldRefusal =
  | 'excluded'
  | 'no-manifest'
  | 'no-scaffold'
  | 'not-empty'
  | 'bad-name'
  | 'bad-app-root'
  | 'app-root-unsupported'
  | 'scaffold-failed'
  | 'no-output'
  | 'prepare-failed'
  | 'app-root-taken'

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
      /** Set only when the app folder moved, to the root the target's tooling record now names. */
      readonly appRoot?: string
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

  const appRoot =
    opts.appRoot === undefined ? undefined : parseAppRoot(opts.appRoot)
  if (opts.appRoot !== undefined && appRoot === undefined) {
    return refuse(
      'bad-app-root',
      `App root '${opts.appRoot}' is not a folder inside the project. Use lowercase segments such as 'web' or 'apps/web'.`,
    )
  }
  // Naming the default is the same as naming nothing, whichever stack it is.
  const moveTo = appRoot === DEFAULT_APP_ROOT ? undefined : appRoot
  if (moveTo !== undefined && manifest.appRoot === undefined) {
    return refuse(
      'app-root-unsupported',
      `Stack '${stack}' declares no [scaffold] app-root, so its app folder cannot move.`,
    )
  }
  const clash =
    moveTo === undefined || manifest.appRoot === undefined
      ? undefined
      : rootClash(root, stack, manifest.appRoot, moveTo)
  if (clash !== undefined) {
    return refuse(
      'bad-app-root',
      `App root '${moveTo}' sits inside ${clash}/, which the scaffold or sync writes. Pick a folder of its own, such as 'web'.`,
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
  // After the step, since on a case-insensitive filesystem removing `App.tsx` would delete the overlay's `app.tsx`.
  const overlay = join(manifest.dir, 'scaffold')
  if (existsSync(overlay)) {
    cpSync(overlay, produced, { recursive: true, force: true })
  }

  // After the overlay, so an overlay written for the starter's folder moves with it.
  if (moveTo !== undefined && manifest.appRoot !== undefined) {
    if (existsSync(join(produced, moveTo))) {
      return {
        ok: false,
        reason: 'app-root-taken',
        message: `The starter already holds ${moveTo}/, so the app cannot move there. Pick another root.`,
        scratch,
      }
    }
    moveAppFolder(produced, manifest.appRoot, moveTo)
  }

  mkdirSync(target, { recursive: true })
  const files: string[] = []
  for (const entry of readdirSync(produced).sort()) {
    // A starter's own repository would nest inside a parent one, so only `initGit` decides the target's git.
    if (entry === '.git') continue
    move(join(produced, entry), join(target, entry))
    files.push(entry)
  }
  rmSync(scratch, { recursive: true, force: true })

  if (moveTo === undefined) {
    return { ok: true, stack, target, name, files, git: await initGit(target) }
  }
  await writeAppRoot(
    target,
    { domain: 'tooling', toolkitRoot: root },
    moveTo,
    opts.now ?? new Date(),
  )
  const recorded = [...new Set([...files, 'canon'])].sort()
  return {
    ok: true,
    stack,
    target,
    name,
    files: recorded,
    git: await initGit(target),
    appRoot: moveTo,
  }
}

/**
 * The folder a root would sit inside and collide with: the starter's app folder, which cannot move into itself,
 * `canon/`, which holds the tooling record, or a top-level folder the chain ships golden files into.
 */
function rootClash(
  root: string,
  stack: string,
  from: string,
  to: string,
): string | undefined {
  if (to === from || to.startsWith(`${from}/`)) return from

  const top = to.split('/')[0]
  const written = new Set(['canon'])
  for (const manifest of resolveChain(root, stack)) {
    for (const rel of [...configFiles(manifest), ...seedFiles(manifest)]) {
      const segments = rel.split('/')
      if (segments.length > 1 && segments[0] !== from) written.add(segments[0])
    }
  }
  return top !== undefined && written.has(top) ? top : undefined
}

/**
 * Moves the starter's app folder to the root and retargets the absolute `/<folder>/` paths in `index.html`,
 * which is where a Vite starter loads its entry module from.
 */
function moveAppFolder(produced: string, from: string, to: string): void {
  mkdirSync(dirname(join(produced, to)), { recursive: true })
  renameSync(join(produced, from), join(produced, to))

  const html = join(produced, 'index.html')
  if (!existsSync(html)) return
  writeFileSync(
    html,
    readFileSync(html, 'utf8').replaceAll(`"/${from}/`, `"/${to}/`),
  )
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
