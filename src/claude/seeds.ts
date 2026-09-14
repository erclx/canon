import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { copyPreservingMode } from '@/copy'
import { creationRel, isRecordEntry } from '@/record-root'
import { rewritesOnInstall, stripSeedMarker } from '@/seed-marker'
import { SURFACE_ENTRIES, surfaceDir } from '@/surface-root'

const SEEDS_DIR = join('tooling', 'claude', 'seeds')
const CLAUDE_DIR = '.claude'
const SURFACE_DIR = 'canon'
const CLAUDE_MD = 'CLAUDE.md'
const HOOKS = 'hooks'
/**
 * Seed subdirectories, authored under `.claude/` or, for a tracked surface,
 * under `canon/`. Exported because each one replaced a single file of the same
 * stem in an older layout, which is what `@/sync/layout` pairs a target against
 * to find a superseded artifact.
 */
export const SUBDIRS: readonly string[] = [
  HOOKS,
  'context',
  'decisions',
  'diagrams',
  'memory',
  'tasks',
  'wireframes',
]

export type SeedScope = 'claude' | 'root'

export interface Seed {
  readonly src: string
  readonly dest: string
  readonly scanLabel: string
  readonly applyLabel: string
  readonly scope: SeedScope
  readonly executable: boolean
}

export interface SeedEntry {
  readonly seed: Seed
  readonly present: boolean
}

export interface SeedCounts {
  readonly claude: number
  readonly root: number
}

function seedsRoot(root: string): string {
  return join(root, SEEDS_DIR)
}

function isSurfaceEntry(name: string): boolean {
  return SURFACE_ENTRIES.includes(name)
}

/**
 * Where a surface seed installs, relative to the target.
 *
 * Resolved the way a read resolves rather than fixed at `canon/`. A target that
 * still holds the surface under `.claude/` receives the seed beside the copy it
 * has, since a fresh `canon/` folder there would win read precedence and hide
 * every entry that target already wrote.
 */
function surfaceRel(target: string, entry: string): string {
  return relative(target, surfaceDir(target, entry))
}

/**
 * Lists a single directory level, sorted the way `find -maxdepth 1 -type f |
 * sort` was. Bun.Glob skips dotfiles without `dot`, and the `.claude` source
 * sits under a dotted name, so omitting it would match nothing there.
 */
function listLevel(dir: string): string[] {
  if (!existsSync(dir)) return []
  return [
    ...new Bun.Glob('*').scanSync({ cwd: dir, onlyFiles: true, dot: true }),
  ].sort()
}

/**
 * Builds the seed list in the order the timeline prints it: the `.claude` root
 * level, the `canon` root level, then each subdirectory from whichever source
 * authors it, then the project-level `CLAUDE.md`.
 */
export function planSeeds(root: string, target: string): SeedEntry[] {
  const claudeSource = join(seedsRoot(root), CLAUDE_DIR)
  const surfaceSource = join(seedsRoot(root), SURFACE_DIR)
  const seeds: Seed[] = []

  for (const name of listLevel(claudeSource)) {
    seeds.push({
      src: join(claudeSource, name),
      dest: join(target, CLAUDE_DIR, name),
      scanLabel: name,
      applyLabel: join(CLAUDE_DIR, name),
      scope: 'claude',
      executable: false,
    })
  }

  for (const name of listLevel(surfaceSource)) {
    const rel = surfaceRel(target, name)
    seeds.push({
      src: join(surfaceSource, name),
      dest: join(target, rel),
      scanLabel: name,
      applyLabel: rel,
      scope: 'claude',
      executable: false,
    })
  }

  for (const subdir of SUBDIRS) {
    const surface = isSurfaceEntry(subdir)
    const source = join(surface ? surfaceSource : claudeSource, subdir)

    // Three of the `.claude/` subdirectories are record folders that install
    // under the record root instead. A target that has not migrated resolves
    // back to `.claude/`, so the same seed lands beside the records already
    // there rather than opening a second root, and never outside the single
    // `.canon/` ignore entry a target receives.
    const installRel = surface
      ? surfaceRel(target, subdir)
      : isRecordEntry(subdir)
        ? creationRel(target, subdir)
        : join(CLAUDE_DIR, subdir)

    for (const name of listLevel(source)) {
      seeds.push({
        src: join(source, name),
        dest: join(target, installRel, name),
        scanLabel: `${subdir}/${name}`,
        applyLabel: join(installRel, name),
        scope: 'claude',
        executable: subdir === HOOKS,
      })
    }
  }

  const claudeMd = join(seedsRoot(root), CLAUDE_MD)
  if (existsSync(claudeMd)) {
    seeds.push({
      src: claudeMd,
      dest: join(target, CLAUDE_MD),
      scanLabel: CLAUDE_MD,
      applyLabel: CLAUDE_MD,
      scope: 'root',
      executable: false,
    })
  }

  return seeds.map((seed) => ({ seed, present: existsSync(seed.dest) }))
}

export function pendingSeeds(entries: readonly SeedEntry[]): Seed[] {
  return entries.filter((entry) => !entry.present).map((entry) => entry.seed)
}

export function countByScope(seeds: readonly Seed[]): SeedCounts {
  return {
    claude: seeds.filter((seed) => seed.scope === 'claude').length,
    root: seeds.filter((seed) => seed.scope === 'root').length,
  }
}

/**
 * Copies each pending seed. Hooks get the executable bit the way `chmod +x`
 * granted it, added on top of whatever mode the destination already carried.
 *
 * A markdown seed is rewritten rather than copied, so the stub marker the seed
 * gate reads does not reach the target. Every other seed copies byte for byte,
 * which is what keeps the hook scripts and `settings.json` untouched.
 */
export async function applySeeds(seeds: readonly Seed[]): Promise<string[]> {
  const applied: string[] = []

  for (const seed of seeds) {
    if (rewritesOnInstall(seed.src)) {
      await mkdir(dirname(seed.dest), { recursive: true })
      await writeFile(
        seed.dest,
        stripSeedMarker(await readFile(seed.src, 'utf8')),
      )
    } else {
      await copyPreservingMode(seed.src, seed.dest)
    }

    if (seed.executable) await chmod(seed.dest, 0o755)
    applied.push(seed.applyLabel)
  }

  return applied
}
