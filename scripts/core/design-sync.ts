/**
 * Lands the board's accepted designs in canon/design/: each frame
 * canon/design/frames.json maps, as its HTML beside a PNG per theme, captured
 * through Frameboard's own `capture` verb from the design board at the main
 * worktree's .canon/board, plus a copy of every project asset those frames
 * load under kit/<project>/. `--check` writes nothing and exits 1 when the
 * folder differs from what a sync would write.
 *
 * Ported from Frameboard's own scripts/design-sync.ts. Its frames load a
 * shared kit and it formats each HTML through oxfmt, while this board's frames
 * load their project's ../assets/ and the formatter ignores canon/design/, so
 * the asset handling is the one part that differs. The pure half sits in
 * `src/design/reference.ts`, where tsc and vitest reach it.
 *
 * Frameboard runs through bunx at a pinned version rather than as a
 * devDependency, since only a session holding the board runs this script.
 *
 * Clone-only. This script reads the gitignored board, which neither a
 * registry install nor CI carries.
 */
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'

import {
  boardAssets,
  classifyDrift,
  MappingError,
  missingFrames,
  parseFrameMap,
  toReference,
} from '../../src/design/reference'

type Output = Map<string, string | Buffer>

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

interface Listing {
  projects: { pages: { frames: { ref: string; path: string }[] }[] }[]
}

interface Capture {
  images: { theme: string; path: string }[]
}

class SyncRefused extends Error {}

const FRAMEBOARD = 'frameboard@0.14.0'
const ROOT = join(import.meta.dirname, '..', '..')
const DESIGN = join(ROOT, 'canon', 'design')
const MAPPING = join(DESIGN, 'frames.json')
const OWN_FILES = new Set(['index.md', 'frames.json'])

/** The main worktree, which holds the gitignored board every worktree reads. */
function mainRoot(): string {
  const run = Bun.spawnSync(['git', 'worktree', 'list', '--porcelain'], {
    cwd: ROOT,
  })
  const line = run.stdout
    .toString()
    .split('\n')
    .find((l) => l.startsWith('worktree '))
  return line ? line.slice('worktree '.length) : ROOT
}

function frameboard<T>(args: string[]): T {
  const run = Bun.spawnSync(['bunx', '-y', FRAMEBOARD, ...args, '--json'])
  let record: Envelope<T>
  try {
    record = JSON.parse(run.stdout.toString()) as Envelope<T>
  } catch {
    throw new SyncRefused(`frameboard ${args[0]} printed no record.`)
  }
  if (!record.ok || !record.data) {
    throw new SyncRefused(
      `frameboard ${args[0]} refused: ${record.error?.message ?? run.stderr.toString()}`,
    )
  }
  return record.data
}

function trackedFiles(): string[] {
  return readdirSync(DESIGN, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(DESIGN, join(entry.parentPath, entry.name)))
    .filter((path) => !OWN_FILES.has(path))
}

function pruneEmptyDirs(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(join(dir, entry.name))
  }
  if (dir !== DESIGN && readdirSync(dir).length === 0) rmdirSync(dir)
}

function readAsset(board: string, project: string, asset: string): Buffer {
  try {
    return readFileSync(join(board, project, 'assets', asset))
  } catch {
    throw new SyncRefused(
      `No board asset ${project}/assets/${asset}. Nothing written.`,
    )
  }
}

function run(check: boolean): number {
  const map = parseFrameMap(readFileSync(MAPPING, 'utf8'))
  const board = join(mainRoot(), '.canon', 'board')

  const listing = frameboard<Listing>(['list', '--root', board])
  const paths = new Map(
    listing.projects
      .flatMap((project) => project.pages)
      .flatMap((page) => page.frames)
      .map((frame) => [frame.ref, frame.path]),
  )
  const missing = missingFrames(map, new Set(paths.keys()))
  if (missing.length > 0) {
    throw new SyncRefused(
      `No board frame for: ${missing.join(', ')}. Nothing written.`,
    )
  }

  const output: Output = new Map()
  const captures = mkdtempSync(join(tmpdir(), 'design-sync-'))
  try {
    for (const [reference, ref] of map) {
      const [project = ''] = ref.split('/')
      const html = readFileSync(paths.get(ref) ?? '', 'utf8')
      output.set(`${reference}.html`, toReference(html, project))
      for (const asset of boardAssets(html)) {
        output.set(
          join('kit', project, asset),
          readAsset(board, project, asset),
        )
      }
      const { images } = frameboard<Capture>([
        'capture',
        ref,
        '--root',
        board,
        '--out',
        captures,
      ])
      for (const image of images) {
        output.set(`${reference}-${image.theme}.png`, readFileSync(image.path))
      }
    }
  } finally {
    rmSync(captures, { recursive: true, force: true })
  }

  if (check) {
    const tracked = new Map<string, string | Buffer>()
    for (const path of trackedFiles()) {
      tracked.set(path, readFileSync(join(DESIGN, path)))
    }
    const drift = classifyDrift(output, tracked)
    for (const path of drift.changed) console.error(`Changed: ${path}`)
    for (const path of drift.missing) console.error(`Missing: ${path}`)
    for (const path of drift.stray) console.error(`Stray: ${path}`)
    for (const path of drift.pngDiffers) {
      console.error(`Warning: PNG bytes differ: ${path}`)
    }
    const owed =
      drift.changed.length + drift.missing.length + drift.stray.length
    if (owed === 0) console.log('canon/design/ matches the board.')
    return owed === 0 ? 0 : 1
  }

  for (const [path, data] of output) {
    mkdirSync(dirname(join(DESIGN, path)), { recursive: true })
    writeFileSync(join(DESIGN, path), data)
  }
  for (const path of trackedFiles()) {
    if (!output.has(path)) rmSync(join(DESIGN, path))
  }
  pruneEmptyDirs(DESIGN)
  console.log(`Wrote ${output.size} files to canon/design/.`)
  return 0
}

try {
  process.exitCode = run(process.argv.includes('--check'))
} catch (error) {
  console.error(
    error instanceof SyncRefused || error instanceof MappingError
      ? error.message
      : error,
  )
  process.exitCode = 1
}
