#!/usr/bin/env bun

import { Command } from 'commander'
import { register as init } from '@/commands/init'
import { register as sandbox } from '@/commands/sandbox'
import { register as sync } from '@/commands/sync'
import { register as gov } from '@/commands/gov'
import { register as standards } from '@/commands/standards'
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
import { renderHelp } from '@/help'

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

init(program)
sandbox(program)
sync(program)
gov(program)
standards(program)
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
