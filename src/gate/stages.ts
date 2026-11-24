import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  capabilitySeeding,
  ignoreParity,
  pluginBoundary,
  seedIndependence,
  skillPaths,
} from '@/gate/boundaries'
import { embeddedPrograms } from '@/code/embedded'
import {
  commentBodyBlocks,
  commentFileShare,
  commentHeadBlocks,
  commentHistory,
  shippedCommentCaps,
} from '@/gate/comment-caps'
import { EXAMPLES_DIR, recordExamples } from '@/gate/examples'
import { fileLength } from '@/gate/file-length'
import {
  canonicalRecords,
  auditSet,
  clientCommandCitations,
  configFiles,
  designProse,
  deviceClasses,
  documentCeiling,
  folderEchoedNames,
  markdownBans,
  type Measure,
  pluginManifests,
  readmeCitations,
  recordIdempotence,
  sandboxCoverage,
  seedStandards,
  rawFieldFileReference,
  shippedReferences,
  skillDescriptionTotal,
  skillFamily,
  skillPracticeShape,
  skillProvenance,
  unreferencedRules,
  visualPathGlobs,
} from '@/gate/measures'
import { readersOf, readTestSources } from '@/gate/corpus-readers'
import {
  CONTEXT_FOLDERS,
  declaresContextGate,
  hasContextFolder,
} from '@/context/gate'
import { isOwnCheckout, PROJECT_ROOT } from '@/roots/project'
import { SHIPPED_CORPORA } from '@/shipped/references'

/**
 * One thing a stage does, as an argument vector rather than a shell line, since
 * a string handed to `eval` makes every stage a quoting question and nothing in
 * the set depends on expansion.
 */
export type Check =
  /** Any binary on PATH, or a script named by path under the project root. */
  | {
      readonly kind: 'command'
      readonly argv: readonly string[]
      /**
       * Builds the argv from the changed set when scoping is on. `argv` runs
       * where it is off, so `--all` and every widening fallback keep the full
       * command.
       */
      readonly changedArgv?: (changed: readonly string[]) => readonly string[]
      /**
       * What a run through `changedArgv` left out, printed whenever that argv
       * differed from `argv`, so a scoped pass never reads as the full one.
       */
      readonly scopedNote?: string
      readonly failure: string
    }
  /** This checkout's own CLI, so a worktree gate never reads the main tree. */
  | {
      readonly kind: 'cli'
      /** A function where the arguments depend on the project being checked. */
      readonly argv: readonly string[] | ((root: string) => readonly string[])
      readonly failure: string
    }
  /**
   * Both the index and the tree are read, since a regen emitting a file nobody
   * committed satisfies a diff. `*` matches a slash in a pathspec, so
   * `*index.md` reaches a nested index.
   */
  | {
      readonly kind: 'drift'
      readonly pathspec: string
      readonly failure: string
    }
  /** A reading whose verdict is a comparison rather than an exit code. */
  | { readonly kind: 'measure'; readonly measure: Measure }

/**
 * What a scoped stage asks of each changed file. A `RegExp` satisfies it, and
 * a stage whose answer needs more than the path, such as which tests read the
 * file, supplies its own.
 */
export interface StageScope {
  test(file: string): boolean
}

export interface Stage {
  readonly id: string
  /** The heading this stage prints, matching the frame it replaces. */
  readonly label: string
  /**
   * The changed-file pattern this stage needs before it runs. Absent means the
   * stage always runs, which is correct wherever the input is diffuse enough
   * that no path predicts it.
   */
  readonly scope?: StageScope
  /** What a scoped-out stage says, so a skip never reads as a pass. */
  readonly skipped?: string
  /**
   * Why the project carries nothing this stage reads, which skips it, or
   * `undefined` where it carries the input. Absent means the input is always
   * there to read.
   */
  readonly absent?: (root: string) => string | undefined
  readonly checks: readonly Check[]
  /**
   * The machine lock this stage holds while its checks run, so one box runs it
   * for one worktree at a time. Absent means the stage never queues.
   */
  readonly lock?: string
  /** The line a clean stage prints, where the checks emit none of their own. */
  readonly success?: string
  /**
   * Whether the stage fits any project, so it also runs outside canon's own
   * checkout. A stage left unshared reads or writes canon's own layout, or
   * runs a script a target's verify runner already runs.
   */
  readonly shared?: boolean
}

/**
 * Files a scoped run hands to `vitest related`, which follows imports from
 * them to the tests that reach them. A corpus a test reads from disk is not
 * among them, so its readers are selected by `readersOf` and passed by name.
 */
export const RELATED_SOURCES = /\.tsx?$|^commitlint\.config\.js$/

/** Files every test depends on without importing, so no related run sees them. */
export const FULL_SUITE_TRIGGERS =
  /^vitest\.(e2e\.)?(config|setup|global-setup)\.ts$|^tsconfig\.json$|^package\.json$/

const testSources = new Map<string, ReadonlyMap<string, string>>()

/**
 * Read once per root per gate run, and only when a corpus file is in the
 * changed set. The root is the checked project rather than `PROJECT_ROOT`,
 * which an installed binary resolves to its own package folder.
 */
function corpusReaders(file: string, root: string): readonly string[] {
  if (RELATED_SOURCES.test(file) || FULL_SUITE_TRIGGERS.test(file)) return []
  let sources = testSources.get(root)
  if (sources === undefined) {
    sources = readTestSources(root)
    testSources.set(root, sources)
  }
  return readersOf(file, sources)
}

/**
 * A corpus file with no reader leaves the stage scoped out, so the related run
 * is never handed an empty file list.
 */
function testsScope(root: string): StageScope {
  return {
    test: (file) =>
      RELATED_SOURCES.test(file) ||
      FULL_SUITE_TRIGGERS.test(file) ||
      corpusReaders(file, root).length > 0,
  }
}

const FULL_SUITE = ['bun', 'run', 'test']

/**
 * The end-to-end suites launch a browser and FFmpeg and held the tests lock for
 * minutes, so they run only through `bun run test:e2e` and CI's E2E Suites job.
 */
const END_TO_END = '**/*.e2e.test.ts'

function relatedTests(
  changed: readonly string[],
  root: string,
): readonly string[] {
  if (changed.some((file) => FULL_SUITE_TRIGGERS.test(file))) return FULL_SUITE
  return [
    'bun',
    '--bun',
    'vitest',
    'related',
    '--run',
    '--passWithNoTests',
    // The glob follows its flag, or vitest reads the first file as the pattern.
    '--exclude',
    END_TO_END,
    ...new Set([
      ...changed.filter((file) => RELATED_SOURCES.test(file)),
      ...changed.flatMap((file) => corpusReaders(file, root)),
    ]),
  ]
}

export function contextAuditArgv(root: string): readonly string[] {
  return isOwnCheckout(root) || declaresContextGate(root)
    ? ['context', 'audit', '--gate']
    : ['context', 'audit']
}

/**
 * Bound to the project `stagesFor` checks. It holds a lock, since concurrent
 * suites starve each other's spawn tests and a related run can reach one. The
 * sequencer holds it behind any failed stage, matched on this id.
 */
function testsStage(root: string): Stage {
  return {
    id: 'tests',
    label: 'Tests',
    scope: testsScope(root),
    skipped:
      'Skipped, no TypeScript, test config, or corpus a test reads changed',
    lock: 'tests',
    checks: [
      {
        kind: 'command',
        argv: FULL_SUITE,
        changedArgv: (changed) => relatedTests(changed, root),
        scopedNote:
          'Scoped run left out every *.e2e.test.ts suite. Run bun run test:e2e when this change reaches a browser or FFmpeg path.',
        failure: 'Tests failed',
      },
    ],
    success: 'Tests passed',
  }
}

/**
 * Every stage in run order, which is the product: the regenerating stages run
 * before anything reads what they wrote, and `tests` sits last so a failure
 * anywhere in the run holds it.
 */
export const STAGES: readonly Stage[] = [
  {
    id: 'format-check',
    label: 'Format check',
    checks: [
      {
        kind: 'command',
        argv: ['bun', 'run', 'check:format'],
        failure:
          'Format check failed. Run bun run format and commit the result.',
      },
    ],
    success: 'Format check passed',
  },
  {
    id: 'indexes',
    label: 'Indexes',
    checks: [
      {
        kind: 'cli',
        argv: ['indexes', 'regen'],
        failure: 'Index regen failed',
      },
      {
        kind: 'drift',
        pathspec: '*index.md',
        failure:
          'Indexes drifted. Run bun run check and commit the updated index files.',
      },
    ],
    success: 'Indexes clean',
  },
  {
    id: 'consumed-copies',
    label: 'Consumed copies',
    checks: [
      {
        kind: 'cli',
        argv: ['gov', 'regen'],
        failure: 'Consumed-copy regen failed',
      },
      {
        kind: 'drift',
        pathspec: '.claude/rules',
        failure:
          'Consumed copies drifted. Run bun run check and commit .claude/rules.',
      },
    ],
    success: 'Consumed copies clean',
  },
  {
    // Four artifacts are written from `src/design/`, and a render step is safe
    // only while something fails when it did not run, which is this drift.
    id: 'design',
    label: 'Design',
    checks: [
      {
        kind: 'cli',
        argv: ['design', 'regen'],
        failure: 'Design regen failed',
      },
      {
        kind: 'drift',
        pathspec: 'canon/DESIGN.md',
        failure:
          'The design record drifted from the token source. Run bun run check and commit canon/DESIGN.md.',
      },
      {
        kind: 'command',
        argv: ['bun', 'run', 'web:tokens'],
        failure: 'Web token regen failed',
      },
      {
        kind: 'drift',
        pathspec: 'web/src/styles/tokens.css',
        failure:
          'The web stylesheet drifted from the token source. Run bun run check and commit web/src/styles/tokens.css.',
      },
      {
        kind: 'command',
        argv: ['bun', 'run', 'web:favicon'],
        failure: 'Web favicon regen failed',
      },
      {
        kind: 'drift',
        pathspec: 'web/public/favicon.svg',
        failure:
          'The tab icon drifted from the token source. Run bun run check and commit web/public/favicon.svg.',
      },
      {
        kind: 'command',
        argv: ['bun', 'run', 'web:previews'],
        failure: 'Web preview regen failed',
      },
      {
        kind: 'drift',
        pathspec: 'web/public/previews/design-tokens',
        failure:
          'The token preview drifted from the design source. Run bun run check and commit web/public/previews/design-tokens.',
      },
      {
        kind: 'drift',
        pathspec: 'assets/brand/mark-color*.svg',
        failure:
          'The README mark pair drifted from the mark source. Run bun run check and commit assets/brand/mark-color.svg and assets/brand/mark-color-light.svg.',
      },
    ],
    success: 'Design source clean',
  },
  {
    // The prose budget, which a drift assert cannot see since a regenerated
    // paragraph agrees with its source. It follows the regen, so canon counts
    // the record it just wrote.
    id: 'design-prose',
    shared: true,
    label: 'Design prose',
    checks: [{ kind: 'measure', measure: designProse }],
  },
  {
    // A worked record under `examples/` drifts from its standard silently, so
    // an edit to either reruns the validator and the stamp check. A standard is
    // a skill body or reference, and `examples/` stays in this checkout alone.
    id: 'record-examples',
    label: 'Record examples',
    scope: /^examples\/|^claude\/skills\/[^/]+\/(?:SKILL\.md$|references\/)/,
    skipped: 'No example or skill standard changed, so no example was reread',
    absent: (root) =>
      existsSync(join(root, EXAMPLES_DIR, 'index.md'))
        ? undefined
        : `Skipped, no ${EXAMPLES_DIR}/index.md here, so there is no example to check`,
    checks: [{ kind: 'measure', measure: recordExamples }],
  },
  {
    // Every config file's key names and value types, since a reader takes a
    // misspelled key as absent and the setting silently stops applying. Each
    // reader keeps its own deeper validation, as Device classes does below.
    id: 'config',
    shared: true,
    label: 'Config',
    checks: [{ kind: 'measure', measure: configFiles }],
  },
  {
    // The one config every width reader shares, read here so a typo fails the
    // gate rather than a capture, a reel, or a board round.
    id: 'device-classes',
    shared: true,
    label: 'Device classes',
    checks: [{ kind: 'measure', measure: deviceClasses }],
  },
  {
    // The claude manifest carries a target's ignore set and is kept by hand
    // beside `.gitignore`, so a drift reaches every target on the next sync and
    // surfaces to nobody. No generator writes either list.
    id: 'ignore-parity',
    label: 'Ignore parity',
    checks: [{ kind: 'measure', measure: ignoreParity }],
    success: 'Ignore parity clean',
  },
  {
    id: 'skill-paths',
    label: 'Skill paths',
    checks: [{ kind: 'measure', measure: skillPaths }],
    success: 'Skill paths clean',
  },
  {
    id: 'plugin-boundary',
    label: 'Plugin boundary',
    checks: [{ kind: 'measure', measure: pluginBoundary }],
    success: 'Plugin boundary clean',
  },
  {
    // Seed prose is read in a target as instruction, so a line naming this
    // repository's CLI hands it a verb it may not run, in every project
    // scaffolded after it.
    id: 'seed-independence',
    label: 'Seed independence',
    checks: [{ kind: 'measure', measure: seedIndependence }],
    success: 'Seed prose cites no toolkit CLI',
  },
  {
    // A hook, a workflow, or a husky script reaching one side of the seed or
    // config boundary and not the other is a capability withheld with no
    // recorded reason, per the criterion in canon/context/surfaces/tooling.md.
    id: 'capability-seeding',
    label: 'Capability seeding',
    checks: [{ kind: 'measure', measure: capabilitySeeding }],
    success: 'Capability seeding clean',
  },
  {
    // A rule no stack names reaches a target only when `canon gov detect`
    // proposes it, so every such rule needs a governance/detect.toml entry,
    // and every key there has to name a live rule.
    id: 'unreferenced-rules',
    label: 'Unreferenced rules',
    checks: [{ kind: 'measure', measure: unreferencedRules }],
  },
  {
    // A defect showing only after a sync passes every stage reading this
    // repository, so frozen consumer snapshots replay through this sync. The
    // scope is what a sync ships or reads, governance whole but the ledger.
    id: 'consumer-replay',
    label: 'Consumer replay',
    scope:
      /^src\/|^governance\/(?!ledger\/)|^tooling\/|^sandbox\/fixtures\/replay\//,
    skipped:
      'No synced surface or snapshot changed, so no consumer was replayed',
    checks: [
      {
        kind: 'cli',
        argv: ['sandbox', 'replay'],
        failure:
          'A consumer replay crashed, printed unparsable JSON, left an unformatted write, or drifted from its recorded answer. Run bun src/cli.ts sandbox replay, and when a drift is one the change meant, such as a governance rename moving a sync count, run it with --record and commit the expectations.',
      },
    ],
    success: 'Consumer replays clean',
  },
  {
    // The audit's facts gate and its judgment thresholds do not. Canon's own
    // checkout always widens the audit, and another project widens it only
    // where its context config opts in.
    id: 'context-citations',
    shared: true,
    label: 'Context citations',
    absent: (root) =>
      hasContextFolder(root)
        ? undefined
        : `Skipped, no ${CONTEXT_FOLDERS.join(' or ')} folder here, so there is no entry to audit`,
    checks: [
      {
        kind: 'cli',
        argv: contextAuditArgv,
        failure:
          'A cited context path does not resolve, an entry lacks a required section or carries an H2 outside Overview, Layout, and Gotchas, an entry under a shape-gated folder breaks the section shape, an index disagrees with its folder, or a code folder is named in no Layout or claimed by two entries. Run bun src/cli.ts context audit --gate.',
      },
    ],
    success: 'Context citations resolve',
  },
  {
    // Each record's caps are facts it states about itself, unlike the
    // judgment thresholds the stage above leaves out, so they gate here.
    id: 'canonical-records',
    shared: true,
    label: 'Canonical records',
    checks: [{ kind: 'measure', measure: canonicalRecords }],
  },
  {
    // Unscoped, since any branch can grow any document. A document past the
    // ceiling fails the push.
    id: 'document-ceiling',
    shared: true,
    label: 'Document ceiling',
    checks: [{ kind: 'measure', measure: documentCeiling }],
  },
  {
    // Unscoped, since any branch can add a file anywhere and one git ls-files
    // costs nothing. Reads paths rather than markdown, so it sits here rather
    // than in the markdown audit that also runs inside every target.
    id: 'folder-echoed-names',
    label: 'Folder-echoed filenames',
    checks: [{ kind: 'measure', measure: folderEchoedNames }],
  },
  {
    // Unscoped, since a block one branch embeds stays embedded on every later
    // branch, and reading every tracked source costs well under a second.
    id: 'embedded-programs',
    shared: true,
    label: 'Embedded programs',
    checks: [{ kind: 'measure', measure: embeddedPrograms }],
  },
  {
    // Unscoped, since any branch can grow any file past the cap, and counting
    // the tracked sources costs well under a second.
    id: 'file-length',
    shared: true,
    label: 'File length',
    checks: [{ kind: 'measure', measure: fileLength }],
  },
  {
    // Unscoped as a stage, since each measure reads the changed set itself and
    // fails only a run the branch changed.
    id: 'comment-head-blocks',
    shared: true,
    label: 'Head comment runs',
    checks: [{ kind: 'measure', measure: commentHeadBlocks }],
  },
  {
    id: 'comment-body-blocks',
    shared: true,
    label: 'In-body comment runs',
    checks: [{ kind: 'measure', measure: commentBodyBlocks }],
  },
  {
    id: 'comment-history',
    shared: true,
    label: 'History in comments',
    checks: [{ kind: 'measure', measure: commentHistory }],
  },
  {
    id: 'comment-file-share',
    shared: true,
    label: 'Comment share per file',
    checks: [{ kind: 'measure', measure: commentFileShare }],
  },
  {
    // Unshared, since a target holds no `tooling/`, and unscoped, since a
    // target fails on every file sync writes, touched here or not.
    id: 'shipped-comment-caps',
    label: 'Shipped comment caps',
    checks: [{ kind: 'measure', measure: shippedCommentCaps }],
  },
  {
    // A rule citing a moved file, or globbing a moved directory, fails silently,
    // and the drift stage passes a rule and its copy wrong together. The verb
    // separates the classes where absence is correct.
    id: 'rule-citations',
    label: 'Rule citations',
    checks: [
      {
        kind: 'cli',
        argv: ['gov', 'citations'],
        failure:
          'A path a rule cites, or an internal frontmatter glob, does not resolve. Run bun src/cli.ts gov citations.',
      },
    ],
    success: 'Rule citations resolve',
  },
  {
    // Reads the whole rule corpus and fails only on a folder the verb lists as
    // gated, so the finding count prints on every push while the rewrite moves
    // folder by folder toward zero.
    id: 'rule-shape',
    label: 'Rule shape',
    checks: [
      {
        kind: 'cli',
        argv: ['gov', 'audit', '--gate', '--touched'],
        failure:
          'A rule in a gated folder is past a shape limit or short of its ledger. Run bun src/cli.ts gov audit --touched.',
      },
    ],
  },
  {
    // A citation of the old record root resolves to nothing, and the sweep
    // repointing it runs only by hand, so its plan is read back here beside
    // the citation stages it answers for a root.
    id: 'record-idempotence',
    label: 'Record idempotence',
    checks: [{ kind: 'measure', measure: recordIdempotence }],
  },
  {
    // Bans and dead links in every file, and a density finding on a path the
    // audit gates, all read off one exit code.
    id: 'markdown',
    shared: true,
    label: 'Markdown',
    checks: [{ kind: 'measure', measure: markdownBans }],
  },
  {
    // Unscoped, since a wrong quotation of a client command can land in any
    // tracked file rather than in one corpus.
    id: 'client-command-citations',
    label: 'Client command citations',
    checks: [{ kind: 'measure', measure: clientCommandCitations }],
  },
  {
    // Scoped to the corpora it reads, then walks the whole corpus, which is
    // what reaches a reference moved between two files rather than written.
    id: 'shipped-references',
    label: 'Shipped references',
    scope: new RegExp(SHIPPED_CORPORA.map((corpus) => `^${corpus}/`).join('|')),
    skipped: 'No shipped corpus changed, so no reference was read',
    checks: [{ kind: 'measure', measure: shippedReferences }],
  },
  {
    // Same corpora as shipped-references and a separate stage, since the
    // verdict is a flag spelling rather than an unresolvable reference.
    id: 'raw-field-file-reference',
    label: 'Raw-field file references',
    scope: new RegExp(SHIPPED_CORPORA.map((corpus) => `^${corpus}/`).join('|')),
    skipped: 'No shipped corpus changed, so no flag was read',
    checks: [{ kind: 'measure', measure: rawFieldFileReference }],
  },
  {
    // Scoped to the two files a citation can drift between, so an edit to
    // either one runs the check. web/src/content/copy.ts carries the anchors
    // and README.md is the text they quote from.
    id: 'readme-citations',
    label: 'README citations',
    scope: /^(web\/src\/content\/copy\.ts|README\.md)$/,
    skipped: 'Neither copy.ts nor README.md changed, so no citation was read',
    checks: [{ kind: 'measure', measure: readmeCitations }],
  },
  {
    // Scoped to the two files carrying the literal path-glob copy, so an edit
    // to either one runs the check.
    id: 'visual-path-globs',
    label: 'Visual check path globs',
    scope: /^\.github\/workflows\/(deploy-site|pr-visual-checks)\.yml$/,
    skipped:
      'Neither deploy-site.yml nor pr-visual-checks.yml changed, so no path list was compared',
    checks: [{ kind: 'measure', measure: visualPathGlobs }],
  },
  {
    id: 'seed-standards',
    label: 'Seed standards',
    checks: [{ kind: 'measure', measure: seedStandards }],
  },
  {
    // Presence of a required file is a fact, so it gates. The name,
    // description, folder, and requirement-section measures beside it report
    // and are read from a bare run.
    id: 'skill-requirements',
    label: 'Skill requirements',
    checks: [
      {
        kind: 'cli',
        argv: ['claude', 'skills', 'audit', '--requirements-only'],
        failure:
          'A skill folder carries no REQUIREMENT.md. Run bun src/cli.ts claude skills audit.',
      },
    ],
    success: 'Skill requirements present',
  },
  {
    // The audit verb only reports a dated line, so a target is told without
    // failing. This stage makes the same finding fail here, where the corpus is
    // held at zero. Unscoped, since any branch can add a line to any body.
    id: 'skill-provenance',
    label: 'Skill provenance',
    checks: [{ kind: 'measure', measure: skillProvenance }],
  },
  {
    // The audit verb only reports a listed practice skill missing a closing
    // section or its ledger, so a target is told without failing. The list
    // names this repository's shipped skills, so the stage fails here alone.
    id: 'skill-practice-shape',
    label: 'Skill practice shape',
    checks: [{ kind: 'measure', measure: skillPracticeShape }],
  },
  {
    // The audit verb only reports a shipped skill with a missing or unknown
    // family, so a target is told without failing. The landing page groups the
    // skill map by the field, so the stage holds this corpus at zero.
    id: 'skill-family',
    label: 'Skill family',
    checks: [{ kind: 'measure', measure: skillFamily }],
  },
  {
    id: 'skill-description-total',
    label: 'Skill description total',
    checks: [{ kind: 'measure', measure: skillDescriptionTotal }],
  },
  {
    id: 'sandbox-coverage',
    label: 'Sandbox coverage',
    checks: [{ kind: 'measure', measure: sandboxCoverage }],
  },
  {
    id: 'audit-set',
    label: 'Audit set',
    checks: [{ kind: 'measure', measure: auditSet }],
  },
  {
    id: 'plugin-manifests',
    label: 'Plugin manifests',
    checks: [{ kind: 'measure', measure: pluginManifests }],
  },
  {
    id: 'shell',
    label: 'Shell',
    // `.husky/` is matched by prefix, since its hooks carry no extension, and
    // without it fifty lines of shell landed in a hook with no stage firing.
    scope: /\.sh$|^\.husky\/|^package\.json$/,
    skipped: 'Skipped, no shell changes',
    checks: [
      {
        kind: 'command',
        argv: ['bun', 'run', 'check:shell'],
        failure: 'Shell check failed',
      },
    ],
    success: 'Shell check passed',
  },
  {
    id: 'lint',
    label: 'Lint',
    // Unscoped, since a full run costs less than spawning the process and a
    // scope is one more pattern to fall behind the extensions oxlint reads.
    checks: [
      {
        kind: 'command',
        argv: ['bun', 'run', 'check:lint'],
        failure: 'Lint failed',
      },
    ],
    success: 'Lint passed',
  },
  {
    id: 'types',
    label: 'Types',
    scope: /^src\/|^tsconfig\.json$|^package\.json$/,
    skipped: 'Skipped, no TypeScript changes',
    checks: [
      {
        kind: 'command',
        argv: ['bun', 'run', 'check:types'],
        failure: 'Typecheck failed',
      },
    ],
    success: 'Typecheck passed',
  },
  testsStage(PROJECT_ROOT),
]

/**
 * The stages the gate runs against `root`: every stage in canon's own
 * checkout, and the shared ones elsewhere, in table order either way.
 */
export function stagesFor(root: string): readonly Stage[] {
  if (!isOwnCheckout(root)) return STAGES.filter((stage) => stage.shared)
  return STAGES.map((stage) =>
    stage.id === 'tests' ? testsStage(root) : stage,
  )
}
