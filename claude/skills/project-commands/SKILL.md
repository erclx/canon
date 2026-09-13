---
name: project-commands
description: Runs a command the project documents in its development context entry and stops there. Use when asked to "start the app", "start the dev server", "run the checks", "run the build", "spin it up", or "what commands does this project have". Do NOT use to confirm a change works in a running app, which needs verification past the launch. Do NOT use to deploy, publish, or release.
---

# Project commands

Read the project's development context entry, run the command the user named, report where it landed, and stop.

The value is the stop. A launch that continues into log inspection, browser checks, or unrelated defects is the failure this skill exists to avoid.

## Guards

- Resolve the entry before anything else. Take the flat `development.md` under `canon/context/` when it exists, and `canon/context/development/overview.md` when the domain outgrew one file and split into a folder, which is where the `## Scripts` table lands in a split. Test both paths, then read one. If neither resolves, stop with the line below and let the user decide.
- If the entry documents no command matching the request, stop and list what it does document. Do not infer a command from a filename or a framework.
- If the resolved command has an effect that outlives the process and stopping it does not undo, print it for the user to run and stop. Deploying, publishing, releasing, migrating, and resetting are the common shapes, and the test is the effect rather than the name. A script called `infra:apply` or `promote` qualifies.

Do not read another file to reconstruct an entry that did not resolve, because a guess is worse than a stop when the user cannot see it was a guess.

The stop names the flat path in both cases, since a project carrying neither has no entry to point at and the flat one is where a project without a split keeps it:

```plaintext
❌ No canon/context/development.md. This project has no documented dev loop.
```

## Step 1: read the entry

Read the path the guard resolved, from the project root, the whole entry rather than a named section. That file and no others. A second file is a discovery chain, and this skill has none. Testing two candidate paths is not one, since the test happens before any read and exactly one file is opened.

A split domain keeps its other sub-area files out of reach on purpose. `overview.md` carries the run commands, and the siblings beside it cover verification stages, hooks, and scratch, none of which this skill runs.

## Step 2: resolve the command

Match the request against what the entry documents, reading the stated purpose and not only the command name. A project that documents two similar commands separately means the distinction, and the purpose column is where it says which is which.

When the request maps to more than one documented command, resolve all of them. A project that starts as a frontend and a backend has two rows in the table and one request covering both, and running one of the two reports success on half an app.

State the resolved command before running it. One line, no rationale.

## Step 3: run it

Run each resolved command as the entry writes it, from the project root. When a command only works from a subdirectory, the entry has to say so, since the table gives the skill nothing else to go on.

A command that terminates runs in the foreground. A command that stays up runs in the background, by setting the Bash tool's `run_in_background` parameter on the call. Nothing backgrounds a process on its own, and a foreground dev server blocks until the tool timeout kills it, which reports as a command that never came up and leaves nothing running.

Decide from what the entry says the command does, not from its name. When the entry does not say, treat a server, watcher, or preview as staying up.

- Read a backgrounded command's output back before checking anything against it. The call that starts it returns immediately and carries no port.
- Report the port or URL each command prints, and the log location when one exists
- Confirm a service came up with one check against what it reports listening on
- Leave a process the skill did not start alone. Never stop, restart, or reconfigure one.
- Do not tear down what the skill started. A session that starts a server and stops it has not done what was asked.

If a command fails or never comes up, report the failure and the last output. Do not retry with a different command, and do not abandon the others.

An exit status here is part of the report rather than the basis for one. Step 3 confirms a service came up against what it printed, so the number is passed through to the reader and decides nothing. A documented command reaching `canon` is the case worth naming, since an operator's shell profile may wrap the binary in a function that takes its status from a later command, and judging that run by its exit would call a refusal a success.

## Step 4: stop

Report and end the turn. Specifically do not:

- Run a second check after the first one passed
- Read the startup log for anything beyond a failure
- Open a browser, take a screenshot, or drive the running app
- Report a defect noticed while starting up, however real

Those belong to a verification request, which is a different ask. When one of them looks warranted, say so in one line and let the user decide.

## Output

```plaintext
▶️ <resolved command>

<what it reported: port, URL, or exit status>
```

One block per command when the request resolved to more than one.

For a request with no command to run, list what the entry documents instead:

```plaintext
📋 Documented in <the entry path the guard resolved>

- `<command>`: <purpose as the entry states it>
```
