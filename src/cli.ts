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

function showHelp(): void {
  // The help text is the one framed surface written to stdout, so it asks
  // about that stream rather than the stderr every other writer here uses.
  const { GREY, NC, WHITE } = palette(process.stdout)
  const lines = [
    `${GREY}┌${NC}`,
    `${GREY}├${NC} ${WHITE}Usage:${NC} canon [command]`,
    `${GREY}│${NC}`,
    `${GREY}│${NC}  ${WHITE}Commands:${NC}`,
    `${GREY}│${NC}    init [path]        ${GREY}# Bootstrap a project with toolkit domains${NC}`,
    `${GREY}│${NC}    sync [path]        ${GREY}# Sync all installed domains in a project${NC}`,
    `${GREY}│${NC}    sandbox [cat:cmd]  ${GREY}# Provision and run sandbox scenarios${NC}`,
    `${GREY}│${NC}    gov [command]      ${GREY}# Governance commands (install, sync)${NC}`,
    `${GREY}│${NC}    standards [cmd]    ${GREY}# Standards commands (install, sync, list, <name>)${NC}`,
    `${GREY}│${NC}    snippets [cmd]     ${GREY}# Snippets commands (create, list)${NC}`,
    `${GREY}│${NC}    tooling [cmd]      ${GREY}# Manage tooling stacks (sync, ref, create)${NC}`,
    `${GREY}│${NC}    claude [cmd]       ${GREY}# Claude workflow (init, sync, setup)${NC}`,
    `${GREY}│${NC}    wiki [cmd]         ${GREY}# Wiki commands (init)${NC}`,
    `${GREY}│${NC}    indexes [cmd]      ${GREY}# Regenerate index.md files (regen)${NC}`,
    `${GREY}│${NC}    docs [cmd|topic]   ${GREY}# Emit toolkit reference docs (list, <topic>)${NC}`,
    `${GREY}│${NC}    design [cmd]       ${GREY}# Design system commands (render, board)${NC}`,
    `${GREY}│${NC}    slides [cmd]       ${GREY}# Slide deck commands (render, list)${NC}`,
    `${GREY}│${NC}    capture [source]   ${GREY}# Render HTML capture sources to PNG${NC}`,
    `${GREY}│${NC}    serve [dir]        ${GREY}# Serve a directory over localhost and print the preview link${NC}`,
    `${GREY}│${NC}    demo [cmd]         ${GREY}# Record a running app (compile, run)${NC}`,
    `${GREY}│${NC}    inventory [subj]   ${GREY}# Report one computed property across every route${NC}`,
    `${GREY}│${NC}    drive <url> <run>  ${GREY}# Walk a page through named interactions and measure each state${NC}`,
    `${GREY}│${NC}    feedback           ${GREY}# Write toolkit feedback from stdin to .canon/review/feedback/${NC}`,
    `${GREY}│${NC}    transcripts <url>  ${GREY}# Fetch a YouTube transcript with metadata frontmatter${NC}`,
    `${GREY}│${NC}    tasks [cmd]        ${GREY}# Task board commands (archive)${NC}`,
    `${GREY}│${NC}    intake [cmd]       ${GREY}# Intake folders under .canon/intake/ (list, answer)${NC}`,
    `${GREY}│${NC}    teach [cmd]        ${GREY}# Learning workspaces under .canon/teach/ (list, open, resource, glossary)${NC}`,
    `${GREY}│${NC}    comments [cmd]     ${GREY}# Measure comment density and trend (scan)${NC}`,
    `${GREY}│${NC}    context [cmd]      ${GREY}# Report context folder health (audit)${NC}`,
    `${GREY}│${NC}    markdown [cmd]     ${GREY}# Report markdown against the attribute standards (audit)${NC}`,
    `${GREY}│${NC}    records [cmd]      ${GREY}# Session records under .claude/ (validate, size, push, pull)${NC}`,
    `${GREY}│${NC}    sessions [cmd]     ${GREY}# Resolve live sessions to worktree and branch (list)${NC}`,
    `${GREY}│${NC}    targets [cmd]      ${GREY}# Report the projects this toolkit installed into (list, pulls)${NC}`,
    `${GREY}│${NC}    worktrees [cmd]    ${GREY}# Reclaim the worktrees whose branches merged (list, reclaim)${NC}`,
    `${GREY}│${NC}    secrets [cmd]      ${GREY}# Read the shipped tree for credential-shaped values (scan)${NC}`,
    `${GREY}│${NC}    deps [cmd]         ${GREY}# Read the resolved dependency set for advisories (audit)${NC}`,
    `${GREY}│${NC}    labels [cmd]       ${GREY}# Read a changed set against the pull request label map (audit)${NC}`,
    `${GREY}│${NC}    autoship [cmd]     ${GREY}# Decide whether a changed set needs the review pass (classify)${NC}`,
    `${GREY}│${NC}    pr [cmd]           ${GREY}# Read a pull request against its own diff and its branch tip (key-changes, head, checks)${NC}`,
    `${GREY}│${NC}    repo [cmd]         ${GREY}# This repository's own remote metadata (metadata propose, apply)${NC}`,
    `${GREY}│${NC}    census [path]      ${GREY}# Report tracked file count, extension breakdown, and line totals${NC}`,
    `${GREY}│${NC}    audits [cmd]       ${GREY}# Run every health check as one set (run, list)${NC}`,
    `${GREY}│${NC}    gate [cmd]         ${GREY}# Run the merge gate stage by stage (run)${NC}`,
    `${GREY}│${NC}    upgrade            ${GREY}# Reinstall the CLI globally with the manager that installed it${NC}`,
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
    `${GREY}│${NC}    canon capture assets/captures/install.html --selector .window --out assets`,
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
