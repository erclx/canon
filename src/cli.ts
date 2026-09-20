#!/usr/bin/env bun

import { Command } from 'commander'
import { register as init } from '@/commands/init'
import { register as sandbox } from '@/commands/sandbox'
import { register as sync } from '@/commands/sync'
import { register as gov } from '@/commands/gov'
import { register as standards } from '@/commands/standards'
import { register as snippets } from '@/commands/snippets'
import { register as tooling } from '@/commands/tooling'
import { register as claude } from '@/commands/claude'
import { register as wiki } from '@/commands/wiki'
import { register as indexes } from '@/commands/indexes'
import { register as docs } from '@/commands/docs'
import { register as design } from '@/commands/design'
import { register as slides } from '@/commands/slides'
import { register as capture } from '@/commands/capture'
import { register as serve } from '@/commands/serve'
import { register as demo } from '@/commands/demo'
import { register as inventory } from '@/commands/inventory'
import { register as driver } from '@/commands/driver'
import { register as feedback } from '@/commands/feedback'
import { register as transcripts } from '@/commands/transcripts'
import { register as tasks } from '@/commands/tasks'
import { register as intake } from '@/commands/intake'
import { register as teach } from '@/commands/teach'
import { register as comments } from '@/commands/comments'
import { register as context } from '@/commands/context'
import { register as markdown } from '@/commands/markdown'
import { register as migrate } from '@/commands/migrate'
import { register as records } from '@/commands/records'
import { register as sessions } from '@/commands/sessions'
import { register as worktrees } from '@/commands/worktrees'
import { register as audits } from '@/commands/audits'
import { register as gate } from '@/commands/gate'
import { register as secrets } from '@/commands/secrets'
import { register as deps } from '@/commands/deps'
import { register as labels } from '@/commands/labels'
import { register as autoship } from '@/commands/autoship'
import { register as pr } from '@/commands/pr'
import { register as repo } from '@/commands/repo'
import { register as census } from '@/commands/census'
import { register as targets } from '@/commands/targets'
import { register as upgrade } from '@/commands/upgrade'
import { readInstalled, UNKNOWN_LABEL } from '@/version/installed'
import { palette } from '@/ui'

const HELP_WIDTH = 80
const SIGNATURE_WIDTH = 19
const ROW_INDENT = '│    '.length

type CommandRow = [signature: string, description: string]

// The grouping mirrors the README's domain table and has no other source, so a
// command added to the program needs a row here or help-option.test.ts fails.
const COMMAND_GROUPS: { title: string; rows: CommandRow[] }[] = [
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

// A row past the width is cut rather than wrapped, since a wrapped row breaks
// the alignment the grouping exists to buy.
function commandRow(signature: string, description: string): string {
  const { GREY, NC } = palette(process.stdout)
  const room = HELP_WIDTH - ROW_INDENT - SIGNATURE_WIDTH - '# '.length
  const text =
    description.length > room
      ? `${description.slice(0, room - 1)}…`
      : description
  return `${GREY}│${NC}    ${signature.padEnd(SIGNATURE_WIDTH)}${GREY}# ${text}${NC}`
}

function showHelp(): void {
  // The help text is the one framed surface written to stdout, so it asks
  // about that stream rather than the stderr every other writer here uses.
  const { GREY, NC, WHITE } = palette(process.stdout)
  const lines = [
    `${GREY}┌${NC}`,
    `${GREY}├${NC} ${WHITE}Usage:${NC} canon [command]`,
    `${GREY}│${NC}`,
    `${GREY}│${NC}  ${WHITE}Commands:${NC}`,
    ...COMMAND_GROUPS.flatMap((group) => [
      `${GREY}│${NC}`,
      `${GREY}│${NC}  ${WHITE}${group.title}${NC}`,
      ...group.rows.map(([signature, description]) =>
        commandRow(signature, description),
      ),
    ]),
    `${GREY}│${NC}`,
    `${GREY}│${NC}  ${WHITE}Sandbox:${NC}`,
    `${GREY}│${NC}    canon sandbox             ${GREY}# Interactive scenario picker${NC}`,
    `${GREY}│${NC}    canon sandbox git:commit  ${GREY}# Run specific scenario${NC}`,
    `${GREY}│${NC}    canon sandbox reset       ${GREY}# Reset sandbox to baseline${NC}`,
    `${GREY}│${NC}    canon sandbox clean       ${GREY}# Wipe the sandbox${NC}`,
    `${GREY}│${NC}`,
    `${GREY}│${NC}  ${WHITE}Examples:${NC}`,
    `${GREY}│${NC}    canon sync ../my-app`,
    `${GREY}│${NC}    canon sandbox git:commit`,
    `${GREY}│${NC}    canon gov install react`,
    `${GREY}│${NC}    canon gov sync ../my-app`,
    `${GREY}│${NC}    canon gov restated --json`,
    `${GREY}│${NC}    canon standards markdown`,
    `${GREY}│${NC}    canon snippets list`,
    `${GREY}│${NC}    canon init ../my-app`,
    `${GREY}│${NC}    canon tooling sync base`,
    `${GREY}│${NC}    canon tooling create`,
    `${GREY}│${NC}    canon claude init`,
    `${GREY}│${NC}    canon indexes regen`,
    `${GREY}│${NC}    canon indexes regen --dry-run --json`,
    `${GREY}│${NC}    canon docs list --json`,
    `${GREY}│${NC}    canon docs agents`,
    `${GREY}│${NC}    canon design render`,
    `${GREY}│${NC}    canon design board`,
    `${GREY}│${NC}    canon slides render`,
    `${GREY}│${NC}    canon slides list --json`,
    `${GREY}│${NC}    canon capture assets/captures/install.html --selector .window --out assets/evidence`,
    `${GREY}│${NC}    canon serve .canon/teach`,
    `${GREY}│${NC}    canon inventory focus --json`,
    `${GREY}│${NC}    canon drive http://localhost:4173 run.json --json`,
    `${GREY}│${NC}    pbpaste | canon feedback`,
    `${GREY}│${NC}    canon transcripts https://youtu.be/VIDEO_ID`,
    `${GREY}│${NC}    canon tasks archive --pull-request 673 --json`,
    `${GREY}│${NC}    canon intake list toolkit-overview --unread --json`,
    `${GREY}│${NC}    canon teach list --json`,
    `${GREY}│${NC}    canon comments scan src --json`,
    `${GREY}│${NC}    canon context audit --json`,
    `${GREY}│${NC}    canon markdown audit .claude/rules --json`,
    `${GREY}│${NC}    canon records validate plans`,
    `${GREY}│${NC}    canon records size --json`,
    `${GREY}│${NC}    canon records push --json`,
    `${GREY}│${NC}    canon sessions list --json`,
    `${GREY}│${NC}    canon worktrees list --json`,
    `${GREY}│${NC}    canon worktrees reclaim --dry-run`,
    `${GREY}│${NC}    canon secrets scan --json`,
    `${GREY}│${NC}    canon deps audit --json`,
    `${GREY}│${NC}    canon labels audit --json`,
    `${GREY}│${NC}    canon repo metadata propose --json`,
    `${GREY}│${NC}    canon census --json`,
    `${GREY}│${NC}    canon audits run --json`,
    `${GREY}│${NC}    canon gate run --all --no-write`,
    `${GREY}│${NC}    canon upgrade --json`,
    `${GREY}└${NC}`,
  ]
  console.log(lines.join('\n'))
}

const program = new Command()
program
  .name('canon')
  .version(readInstalled().version ?? UNKNOWN_LABEL)
  .enablePositionalOptions()
  .helpOption(false)
program.action(() => showHelp())
program.on('option:help', () => {
  showHelp()
  process.exit(0)
})
program.option('-h, --help', 'Show help')

init(program)
sandbox(program)
sync(program)
gov(program)
standards(program)
snippets(program)
tooling(program)
claude(program)
wiki(program)
indexes(program)
docs(program)
design(program)
slides(program)
capture(program)
serve(program)
demo(program)
inventory(program)
driver(program)
feedback(program)
transcripts(program)
tasks(program)
intake(program)
teach(program)
comments(program)
context(program)
markdown(program)
records(program)
migrate(program)
sessions(program)
targets(program)
worktrees(program)
secrets(program)
deps(program)
labels(program)
autoship(program)
pr(program)
repo(program)
census(program)
audits(program)
gate(program)
upgrade(program)

program.parse()
