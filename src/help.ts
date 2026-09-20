import { palette } from '@/ui'

const HELP_WIDTH = 80
const SIGNATURE_WIDTH = 19
const SANDBOX_SIGNATURE_WIDTH = 26
const ROW_INDENT = '│    '.length

type CommandRow = [signature: string, description: string]
type HelpStream = { isTTY?: boolean }

// The grouping mirrors the README's domain table and has no other source, so a
// command added to the program needs a row here or help-option.test.ts fails.
export const COMMAND_GROUPS: { title: string; rows: CommandRow[] }[] = [
  {
    title: 'Project',
    rows: [
      ['init [path]', 'Bootstrap a project with toolkit domains'],
      ['sync [path]', 'Sync all installed domains in a project'],
      ['upgrade', 'Reinstall the CLI with the manager that installed it'],
      ['migrate [cmd]', 'Move a project off a retired name or layout'],
      ['targets [cmd]', 'Projects this toolkit installed into (list, pulls)'],
    ],
  },
  {
    title: 'Domains',
    rows: [
      ['gov [cmd]', 'Governance rules (install, sync, list)'],
      ['standards [cmd]', 'Standards (install, sync, list, <name>)'],
      ['snippets [cmd]', 'Prompt snippets (create, list)'],
      ['tooling [cmd]', 'Tooling stacks (sync, ref, create)'],
      ['claude [cmd]', 'Claude workflow (init, sync, setup)'],
      ['wiki [cmd]', 'Wiki pages (init)'],
      ['indexes [cmd]', 'Regenerate index.md files (regen)'],
      ['docs [cmd|topic]', 'Emit toolkit reference docs (list, <topic>)'],
    ],
  },
  {
    title: 'Author and render',
    rows: [
      ['design [cmd]', 'Design system (render, board)'],
      ['slides [cmd]', 'Slide decks (render, list)'],
      ['capture [source]', 'Render HTML capture sources to PNG'],
      ['serve [dir]', 'Serve a directory on localhost, print the link'],
      ['demo [cmd]', 'Record a running app (compile, run)'],
      ['inventory [subj]', 'Report one computed property across every route'],
      ['drive <url> <run>', 'Walk a page through interactions, measure each'],
      ['transcripts <url>', 'Fetch a YouTube transcript with frontmatter'],
      ['teach [cmd]', 'Learning workspaces (list, open, resource, glossary)'],
    ],
  },
  {
    title: 'Session and ship',
    rows: [
      ['sandbox [cat:cmd]', 'Provision and run sandbox scenarios'],
      ['tasks [cmd]', 'Task board (validate, archive)'],
      ['intake [cmd]', 'Intake folders under .canon/intake/ (list, answer)'],
      ['records [cmd]', 'Session records (validate, size, push, pull)'],
      ['sessions [cmd]', 'Resolve live sessions to worktree and branch'],
      ['worktrees [cmd]', 'Reclaim worktrees whose branches merged'],
      ['autoship [cmd]', 'Decide whether a changed set needs review'],
      ['pr [cmd]', 'Read a pull request (key-changes, head, checks)'],
      ['feedback', 'Write toolkit feedback from stdin'],
    ],
  },
  {
    title: 'Repo reports',
    rows: [
      ['audits [cmd]', 'Run every health check as one set (run, list)'],
      ['gate [cmd]', 'Run the merge gate stage by stage (run)'],
      ['secrets [cmd]', 'Scan the shipped tree for credentials (scan)'],
      ['deps [cmd]', 'Read the dependency set for advisories (audit)'],
      ['labels [cmd]', 'Read a changed set against the label map (audit)'],
      ['comments [cmd]', 'Measure comment density and trend (scan)'],
      ['context [cmd]', 'Report context folder health (audit)'],
      ['markdown [cmd]', 'Report markdown against the standards (audit)'],
      ['repo [cmd]', 'Remote metadata (metadata propose, apply)'],
      ['census [path]', 'Report file count, extensions, and line totals'],
    ],
  },
]

const SANDBOX_ROWS: CommandRow[] = [
  ['canon sandbox', 'Interactive scenario picker'],
  ['canon sandbox git:commit', 'Run specific scenario'],
  ['canon sandbox reset', 'Reset sandbox to baseline'],
  ['canon sandbox clean', 'Wipe the sandbox'],
]

const EXAMPLES = [
  'canon sync ../my-app',
  'canon sandbox git:commit',
  'canon gov install react',
  'canon gov sync ../my-app',
  'canon gov restated --json',
  'canon standards markdown',
  'canon snippets list',
  'canon init ../my-app',
  'canon tooling sync base',
  'canon tooling create',
  'canon claude init',
  'canon indexes regen',
  'canon indexes regen --dry-run --json',
  'canon docs list --json',
  'canon docs agents',
  'canon design render',
  'canon design board',
  'canon slides render',
  'canon slides list --json',
  'canon capture assets/captures/install.html --selector .window --out assets/evidence',
  'canon serve .canon/teach',
  'canon inventory focus --json',
  'canon drive http://localhost:4173 run.json --json',
  'pbpaste | canon feedback',
  'canon transcripts https://youtu.be/VIDEO_ID',
  'canon tasks archive --pull-request 673 --json',
  'canon intake list toolkit-overview --unread --json',
  'canon teach list --json',
  'canon comments scan src --json',
  'canon context audit --json',
  'canon markdown audit .claude/rules --json',
  'canon records validate plans',
  'canon records size --json',
  'canon records push --json',
  'canon sessions list --json',
  'canon worktrees list --json',
  'canon worktrees reclaim --dry-run',
  'canon secrets scan --json',
  'canon deps audit --json',
  'canon labels audit --json',
  'canon repo metadata propose --json',
  'canon census --json',
  'canon audits run --json',
  'canon gate run --all --no-write',
  'canon upgrade --json',
]

// The frame follows stdout's TTY state rather than `palette`, whose blank
// palette keeps every glyph so the stderr frames a captured run quotes stay
// framed. A glyph is rendering rather than color, so NO_COLOR keeps it.
function isFramed(stream: HelpStream): boolean {
  return stream.isTTY === true
}

function gutter(stream: HelpStream): string {
  if (!isFramed(stream)) return ''
  const { GREY, NC } = palette(stream)
  return `${GREY}│${NC}`
}

// A row past the width is cut rather than wrapped, since a wrapped row breaks
// the alignment the grouping exists to buy. The cut is computed from the framed
// prefix in both forms, so a pipe carries the same text as a terminal.
export function commandRow(
  signature: string,
  description: string,
  stream: HelpStream,
): string {
  const { GREY, NC } = palette(stream)
  const room = HELP_WIDTH - ROW_INDENT - SIGNATURE_WIDTH - '# '.length
  const text =
    description.length > room
      ? `${description.slice(0, room - 1)}…`
      : description
  return `${gutter(stream)}    ${signature.padEnd(SIGNATURE_WIDTH)}${GREY}# ${text}${NC}`
}

export function renderHelp(stream: HelpStream): string {
  const { GREY, NC, WHITE } = palette(stream)
  const bar = gutter(stream)
  const usage = `${WHITE}Usage:${NC} canon [command]`
  const lines = [
    ...(isFramed(stream)
      ? [`${GREY}┌${NC}`, `${GREY}├${NC} ${usage}`]
      : [usage]),
    bar,
    `${bar}  ${WHITE}Commands:${NC}`,
    ...COMMAND_GROUPS.flatMap((group) => [
      bar,
      `${bar}  ${WHITE}${group.title}${NC}`,
      ...group.rows.map(([signature, description]) =>
        commandRow(signature, description, stream),
      ),
    ]),
    bar,
    `${bar}  ${WHITE}Sandbox:${NC}`,
    ...SANDBOX_ROWS.map(
      ([signature, description]) =>
        `${bar}    ${signature.padEnd(SANDBOX_SIGNATURE_WIDTH)}${GREY}# ${description}${NC}`,
    ),
    bar,
    `${bar}  ${WHITE}Examples:${NC}`,
    ...EXAMPLES.map((example) => `${bar}    ${example}`),
    ...(isFramed(stream) ? [`${GREY}└${NC}`] : []),
  ]
  return lines.join('\n')
}
