import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import type { Measure, MeasureReport } from '@/gate/measures'
import { seedRoots } from '@/tooling/seeds'

/**
 * The checks guarding what crosses from this repository into a target: the
 * ignore set a manifest ships, the capabilities a seed carries, the plugin's
 * reach, the prose a seed installs, and the paths a shipped skill cites.
 *
 * Each reads the tree in-process and reports `unmeasured` wherever its walk
 * covered nothing, since a verdict over an empty walk reports the pass the
 * check exists to withhold.
 */

const GITIGNORE = '.gitignore'
const CLAUDE_MANIFEST = 'tooling/claude/manifest.toml'
const IGNORE_SECTION = '# Claude'
const NO_SEED_MARKER = 'canon-no-seed:'
const TOOLKIT_TOKEN = 'canon'
const BANNED_SKILL_PATH = /(^|[^A-Za-z0-9._/-])wiki\//

const posixRel = (root: string, path: string): string =>
  relative(root, path).split(sep).join('/')

const pass = (): MeasureReport => ({ emissions: [] })

const unmeasured = (text: string): MeasureReport => ({
  emissions: [],
  unmeasured: text,
})

const failureOf = (
  header: string,
  lines: readonly string[],
  remediation: string,
): MeasureReport => ({
  emissions: [],
  failure: [header, ...lines, remediation].join('\n'),
})

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/**
 * Plain files directly inside a folder, the way a shell `*` lists them: no
 * dotfile and no directory, so `.husky/_` is never read as a capability.
 */
function listFiles(dir: string): string[] {
  if (!isDirectory(dir)) return []
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => join(dir, name))
    .filter(isFile)
}

function stackDirs(root: string): string[] {
  const tooling = join(root, 'tooling')
  if (!isDirectory(tooling)) return []
  return readdirSync(tooling)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => join(tooling, name))
    .filter(isDirectory)
}

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

const hasReason = (path: string): boolean =>
  readFileSync(path, 'utf8').includes(NO_SEED_MARKER)

const dropTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value

function gitignorePatterns(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line !== '' && !/^\s*#/.test(line))
    .map(dropTrailingSlash)
}

function manifestEntries(text: string): string[] | undefined {
  let parsed: unknown
  try {
    parsed = Bun.TOML.parse(text)
  } catch {
    return undefined
  }
  const table = (parsed as { gitignore?: Record<string, unknown> }).gitignore
  const entries = table?.[IGNORE_SECTION]
  if (!Array.isArray(entries)) return []
  return entries
    .filter((entry): entry is string => typeof entry === 'string')
    .map(dropTrailingSlash)
}

/**
 * The claude manifest is the only route a target's ignore set travels, and it
 * is hand-maintained beside this repository's own `.gitignore` with nothing
 * comparing the two. Parity is exact, with no exception list behind it: an
 * empty one cannot be exercised, and a check nobody can test is a check nobody
 * should trust.
 *
 * Both lists are compared with the trailing slash dropped. The `.gitignore` side
 * reads the whole file rather than one header, since a claude-scoped entry filed
 * under a header of its own would otherwise read as missing from a list that
 * carries it. It is scoped to `.claude/*` and `.canon` as a bare root as well as
 * a prefix, because the manifest says nothing about `node_modules/` or `.env`
 * and `.canon` is one line covering a whole tree.
 */
export const ignoreParity: Measure = async (ctx) => {
  const gitignorePath = join(ctx.root, GITIGNORE)
  if (!isFile(gitignorePath)) {
    return unmeasured(
      `No .gitignore at ${GITIGNORE}, ignore parity unverifiable.`,
    )
  }

  const manifestPath = join(ctx.root, CLAUDE_MANIFEST)
  if (!isFile(manifestPath)) {
    return unmeasured(
      `No claude manifest at ${CLAUDE_MANIFEST}, ignore parity unverifiable.`,
    )
  }

  const ignored = gitignorePatterns(readFileSync(gitignorePath, 'utf8'))
  const shipped = manifestEntries(readFileSync(manifestPath, 'utf8'))

  // An empty read on either side is a parse that failed rather than a
  // repository ignoring nothing, and reporting parity off it would say the two
  // lists agree having compared none of their entries.
  if (ignored.length === 0) {
    return unmeasured(
      'No patterns read from .gitignore, ignore parity unverifiable.',
    )
  }
  if (shipped === undefined || shipped.length === 0) {
    return unmeasured(
      `No entries read from the "${IGNORE_SECTION}" array in ${CLAUDE_MANIFEST}, ignore parity unverifiable.`,
    )
  }

  const failures = [
    ...shipped
      .filter((entry) => !ignored.includes(entry))
      .map(
        (entry) =>
          `  ${entry} is shipped by the manifest and absent from .gitignore`,
      ),
    ...ignored
      .filter(
        (pattern) =>
          pattern === '.canon' ||
          pattern.startsWith('.canon/') ||
          pattern.startsWith('.claude/'),
      )
      .filter((pattern) => !shipped.includes(pattern))
      .map(
        (pattern) =>
          `  ${pattern} is ignored here and absent from the manifest`,
      ),
  ]

  if (failures.length === 0) return pass()

  return failureOf(
    "The ignore set a target receives disagrees with this repository's own:",
    failures,
    `Add the entry to the "${IGNORE_SECTION}" array in ${CLAUDE_MANIFEST} and to .gitignore. The two lists are compared exactly, and nothing here records an exception.`,
  )
}

/** Every `command` string at any depth, which is what `jq '.. | .command?'` read. */
function collectCommands(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectCommands(item, into)
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'command' && typeof child === 'string') into.push(child)
      collectCommands(child, into)
    }
  }
  return into
}

/**
 * A hook, a workflow, or a husky script reaching one side of the seed or config
 * boundary and not the other is a capability withheld with no recorded reason,
 * per the criterion in `canon/context/tooling/seeds.md`.
 *
 * Presence on either side clears a name, and a `canon-no-seed:` comment in the
 * file is the recorded reason. The same marker on a destination clears a
 * target-only capability with no root counterpart by design. A seeded hook with
 * no wiring in the seeded `settings.json` is installed dead, which fails the
 * same way. Wiring compares whole path segments, so `log.sh` cannot pass on the
 * wiring of `pr-create-log.sh`.
 */
export const capabilitySeeding: Measure = async (ctx) => {
  const { root } = ctx
  if (!isDirectory(join(root, 'tooling'))) {
    return unmeasured(
      'No tooling root at tooling, capability seeding unverifiable.',
    )
  }

  const stacks = stackDirs(root)
  const failures: string[] = []

  const checkCapability = (
    label: string,
    srcDir: string,
    destFiles: readonly string[],
  ): void => {
    const destNames = new Set(destFiles.map(basename))
    for (const file of listFiles(join(root, srcDir))) {
      if (destNames.has(basename(file)) || hasReason(file)) continue
      failures.push(
        `  ${label}: ${posixRel(root, file)} reaches no seed or config and carries no ${NO_SEED_MARKER} reason`,
      )
    }
  }

  const checkOrphans = (
    label: string,
    srcDir: string,
    destDir: string,
  ): void => {
    for (const file of listFiles(join(root, destDir))) {
      if (isFile(join(root, srcDir, basename(file))) || hasReason(file)) {
        continue
      }
      failures.push(
        `  ${label}: ${posixRel(root, file)} is seeded or configured with no source at ${srcDir}/${basename(file)}`,
      )
    }
  }

  const workflowDirs = [
    ...stacks.map((stack) => join(stack, 'configs/.github/workflows')),
    ...stacks.map((stack) => join(stack, 'seeds/.github/workflows')),
  ]
  const seedHooksDir = 'tooling/claude/seeds/.claude/hooks'

  checkCapability('Hooks', '.claude/hooks', listFiles(join(root, seedHooksDir)))
  checkCapability(
    'Workflows',
    '.github/workflows',
    workflowDirs.flatMap(listFiles),
  )
  checkCapability(
    'Husky',
    '.husky',
    listFiles(join(root, 'tooling/base/configs/.husky')),
  )

  // The reverse direction: a destination whose source here is gone reaches
  // neither pass reading forward from the source, and it ships a target a
  // capability this repository has already deleted.
  checkOrphans('Hooks', '.claude/hooks', seedHooksDir)
  for (const dir of workflowDirs) {
    checkOrphans('Workflows', '.github/workflows', posixRel(root, dir))
  }
  checkOrphans('Husky', '.husky', 'tooling/base/configs/.husky')

  const seedSettings = join(root, 'tooling/claude/seeds/.claude/settings.json')
  const seedHooks = listFiles(join(root, seedHooksDir)).filter((file) =>
    file.endsWith('.sh'),
  )

  if (isDirectory(join(root, seedHooksDir))) {
    if (!isFile(seedSettings)) {
      failures.push(
        `  Seed settings: no settings.json at ${posixRel(root, seedSettings)} to confirm a seeded hook is wired`,
      )
    } else {
      let settings: unknown
      try {
        settings = JSON.parse(readFileSync(seedSettings, 'utf8'))
      } catch {
        return unmeasured(
          `${posixRel(root, seedSettings)} is not valid JSON, seeded-hook wiring unverifiable.`,
        )
      }
      const wired = new Set(
        collectCommands(settings).flatMap((command) =>
          command.split(/[/\s]+/).filter((segment) => segment !== ''),
        ),
      )
      for (const file of seedHooks) {
        if (wired.has(basename(file))) continue
        failures.push(
          `  Seed settings: ${basename(file)} is seeded and wired into no command in ${posixRel(root, seedSettings)}`,
        )
      }
    }
  }

  if (failures.length === 0) return pass()

  return failureOf(
    'A capability reaches one side of the seed or config boundary and not the other:',
    failures,
    `Seed or configure the capability, or mark the source line with # ${NO_SEED_MARKER} <reason>.`,
  )
}

/**
 * Every file under `claude/` resolved through its symlinks and rejected when it
 * lands under `internal/`.
 *
 * The plugin reaches `standards/` through a symlink, which an installer
 * dereferences with no code in the path to filter. Walking with symlinks
 * followed is what an install copies, so this is the only place the boundary
 * can be measured. The walk tracks the real directories on its current descent
 * and does not enter one a second time, the way `find -L` stops on a loop.
 */
export const pluginBoundary: Measure = async (ctx) => {
  const pluginRoot = join(ctx.root, 'claude')
  if (!isDirectory(pluginRoot)) {
    return unmeasured('No plugin root at claude, boundary unverifiable.')
  }

  const internalRoot = join(realpathSync(ctx.root), 'internal')
  const leaked: string[] = []
  let walked = 0

  const walk = (dir: string, ancestors: readonly string[]): void => {
    const real = realpathSync(dir)
    if (ancestors.includes(real)) return
    const chain = [...ancestors, real]

    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name)
      let stat
      try {
        stat = statSync(path)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(path, chain)
        continue
      }
      if (!stat.isFile()) continue

      walked += 1
      const resolved = realpathSync(path)
      if (resolved.startsWith(`${internalRoot}${sep}`)) {
        leaked.push(
          `  ${posixRel(ctx.root, path)} -> ${posixRel(realpathSync(ctx.root), resolved)}`,
        )
      }
    }
  }

  walk(pluginRoot, [])

  if (walked === 0) {
    return unmeasured('No file under claude, boundary unverifiable.')
  }
  if (leaked.length === 0) return pass()

  return failureOf(
    'Plugin ships toolkit-internal content:',
    leaked,
    'Author internal content under internal/, which nothing under claude/ reaches.',
  )
}

/** Regular files under a folder, symlinks left unfollowed the way `find -type f` leaves them. */
function walkFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walkFiles(path))
    else if (entry.isFile()) found.push(path)
  }
  return found.sort()
}

function grepLines(
  root: string,
  file: string,
  pattern: RegExp,
): string[] | undefined {
  const text = readFileSync(file, 'utf8')
  if (text.includes('\0')) return undefined
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.flatMap((line, index) =>
    pattern.test(line) ? [`${posixRel(root, file)}:${index + 1}:${line}`] : [],
  )
}

/**
 * Seed prose is installed into every scaffolded project and read there as
 * instruction about that project, so a line naming this repository's CLI hands a
 * target a verb it may not be able to run. This gates for the reason the seed
 * standards stage gates: a defect authored once propagates into every project
 * scaffolded after it.
 *
 * Markdown alone, since the seed tree also ships hooks that call the CLI on
 * purpose. A token followed by `/` is the tracked surface root, a folder the
 * seed itself installs, so every other spelling reports. No seed root, or roots
 * carrying no markdown, is unmeasured rather than a pass, which agrees with
 * `seedStandards` on the no-root case.
 */
export const seedIndependence: Measure = async (ctx) => {
  if (!isDirectory(join(ctx.root, 'tooling'))) {
    return unmeasured(
      'No tooling root at tooling, seed independence unverifiable.',
    )
  }

  const roots = seedRoots(ctx.root)
  if (roots.length === 0) {
    return unmeasured(
      'No seed root carries .claude/ or canon/, nothing to check.',
    )
  }

  const pattern = new RegExp(`${TOOLKIT_TOKEN}([^/]|$)`)
  const cited: string[] = []
  let measured = 0

  for (const seedRoot of roots) {
    for (const file of walkFiles(join(ctx.root, seedRoot))) {
      if (!file.endsWith('.md')) continue
      measured += 1
      for (const hit of grepLines(ctx.root, file, pattern) ?? []) {
        cited.push(`  ${hit}`)
      }
    }
  }

  if (measured === 0) {
    return unmeasured(
      'Seed roots resolved but carry no markdown, seed independence unverifiable.',
    )
  }
  if (cited.length === 0) return pass()

  return failureOf(
    'Seed prose cites the toolkit CLI:',
    cited,
    `A scaffolded project may not have ${TOOLKIT_TOKEN} installed. State the capability the line needs rather than the binary that supplies it.`,
  )
}

/**
 * A shipped skill runs from a target project, where the toolkit's own `wiki/`
 * does not exist. Anchoring on a non-path character keeps a target's
 * `.claude/wiki/` legal. A tree with no `claude/skills/`, or one holding no
 * file, is unmeasured rather than clean.
 */
export const skillPaths: Measure = async (ctx) => {
  const skills = join(ctx.root, 'claude/skills')
  if (!isDirectory(skills)) {
    return unmeasured('No skills folder at claude/skills, no skill was read.')
  }

  const files = walkFiles(skills)
  if (files.length === 0) {
    return unmeasured('No file under claude/skills, no skill was read.')
  }

  const matches = files.flatMap(
    (file) => grepLines(ctx.root, file, BANNED_SKILL_PATH) ?? [],
  )
  if (matches.length === 0) return pass()

  return {
    emissions: [],
    failure: [
      'Shipped skills reference a repo-local path that does not exist in a target project:',
      ...matches,
      '',
      'Reach supporting prose through a canon docs command, a standard cited at the flat root, or inlined text.',
    ].join('\n'),
  }
}
