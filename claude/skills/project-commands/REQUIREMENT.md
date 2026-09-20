---
name: project-commands
description: Why running a documented command stops at the report, and what a single-file read buys over framework inference
---

# Project commands requirement

## Gap

Without this skill, a session asked to start the app infers a command from a framework it recognizes or a script name it likes the look of, and a project whose dev loop differs from the convention gets the convention anyway. The user cannot see it was a guess, because a guess and a read produce the same first line.

The larger failure is the one past the launch. A session that starts a server keeps going into log reading, browser checks, and defects it noticed on the way, so a request that was one command becomes an open-ended investigation nobody asked for and the answer arrives buried. A request covering a frontend and a backend gets one of the two, which reports success on half an app.

Two more failures are mechanical. A command that stays up run in the foreground blocks until the tool timeout, which reports as a service that never came up while nothing is left running. And a command whose effect outlives the process, such as a deploy or a migration, is not undone by stopping it, so running it to see what happens is not available.

## Must

- Read the documented dev loop and treat it as the only source, since a second file is a discovery chain and this skill has none
- Match the request against the stated purpose rather than the command name, since a project documenting two similar commands means the distinction
- Resolve every documented command the request covers, not the first one that matches
- Background a command that stays up, and read its output back before checking anything against it
- Report the port, URL, or exit status per command, then end the turn

## Must not

- Infer a command from a filename, a framework, or a second file
- Stop, restart, or reconfigure a process the skill did not start, or tear down one it did
- Continue past the report into a second check, a screenshot, or a defect report. Say in one line that one looks warranted and let the user decide.
- Abandon the remaining commands when one fails

## Guards

- No documented dev loop stops by naming the missing file, since a reconstruction the user cannot see through is worse than a stop
- A request matching nothing documented lists what is documented instead of inferring
- A command whose effect outlives the process prints for the user to run rather than running, judged on the effect rather than the name

## Out of scope

- Confirming a change works in the running app, which is a verification request and needs the steps this skill refuses
- Deploying, publishing, releasing, migrating, and resetting
- Running the scaffold verification chain against `package.json` scripts: the `target-setup` skill's `verify` phase
- Writing the entry it reads, which belongs to the project's own development docs
