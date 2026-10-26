#!/usr/bin/env bun

import { Command } from 'commander'
import { register as init } from '@/commands/init'
import { register as sandbox } from '@/commands/sandbox'
import { register as sync } from '@/commands/sync'
import { register as gov } from '@/commands/gov'
import { register as tooling } from '@/commands/tooling'
import { register as claude } from '@/commands/claude'
import { register as indexes } from '@/commands/indexes'
import { register as docs } from '@/commands/docs'
import { register as design } from '@/commands/design'
import { register as capture } from '@/commands/capture'
import { register as serve } from '@/commands/serve'
import { register as inventory } from '@/commands/inventory'
import { register as driver } from '@/commands/driver'
import { register as browser } from '@/commands/browser'
import { register as feedback } from '@/commands/feedback'
import { register as transcripts } from '@/commands/transcripts'
import { register as tasks } from '@/commands/tasks'
import { register as intake } from '@/commands/intake'
import { register as comments } from '@/commands/comments'
import { register as context } from '@/commands/context'
import { register as markdown } from '@/commands/markdown'
import { register as migrate } from '@/commands/migrate'
import { register as records } from '@/commands/records'
import { register as sessions } from '@/commands/sessions'
import { register as worktrees } from '@/commands/worktrees'
import { register as hooks } from '@/commands/hooks'
import { register as audits } from '@/commands/audits'
import { register as gate } from '@/commands/gate'
import { register as secrets } from '@/commands/secrets'
import { register as deps } from '@/commands/deps'
import { register as labels } from '@/commands/labels'
import { register as pr } from '@/commands/pr'
import { register as census } from '@/commands/census'
import { register as upstream } from '@/commands/upstream'
import { register as targets } from '@/commands/targets'
import { register as upgrade } from '@/commands/upgrade'
import { register as changelog } from '@/commands/changelog'
import { readInstalled, UNKNOWN_LABEL } from '@/version/installed'
import { renderHelp } from '@/cli/help'
import { renderAll, routeHelp } from '@/cli/help-all'
import { findRetired, retiredMessage } from '@/cli/retired'
import { setQuiet } from '@/cli/ui'

function showHelp(): void {
  console.log(renderHelp(process.stdout))
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
// A caller asking for a record reads it from stdout, so the frame on stderr is
// noise it pays for. Warnings and errors still write.
program.hook('preAction', (_program, action) => {
  if (action.opts().json === true) setQuiet(true)
})

init(program)
sandbox(program)
sync(program)
gov(program)
tooling(program)
claude(program)
indexes(program)
docs(program)
design(program)
capture(program)
serve(program)
inventory(program)
driver(program)
browser(program)
feedback(program)
transcripts(program)
tasks(program)
intake(program)
comments(program)
context(program)
markdown(program)
records(program)
migrate(program)
sessions(program)
targets(program)
worktrees(program)
hooks(program)
secrets(program)
deps(program)
labels(program)
pr(program)
census(program)
upstream(program)
audits(program)
gate(program)
upgrade(program)
changelog(program)

const args = process.argv.slice(2)
const retired = findRetired(args)
const route = routeHelp(program, args)
if (retired !== undefined) {
  console.error(retiredMessage(retired))
  process.exitCode = 1
} else if (route.kind === 'top') showHelp()
else if (route.kind === 'all') process.stdout.write(renderAll(route.command))
else if (route.kind === 'unknown') {
  console.error(`error: unknown command '${route.name}'`)
  process.exitCode = 1
} else program.parse()
