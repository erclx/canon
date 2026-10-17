---
title: Prompts and unattended callers
description: Declined prompts, headless refusals, decision seams, record-driven branching behind a shell wrapper, and driving a prompt through a PTY
---

# Prompts and unattended callers

## Decisions

### Declining exits 0

A cancel is a deliberate choice rather than a failure. `runDomains` in `src/init/run.ts` reports any non-zero domain as `Failed, run manually`, so exiting 1 made `canon init` announce a broken install for work the operator chose to skip.

Apply it to any prompt a port carries over.

### A headless run refuses a git remote

A headless run applies the same judgment to an action that reaches further outward than a local overwrite. The domain syncs still apply, so headless keeps everything but the push.

### The refusal covers a remote the caller did not name

`canon records push` writes to a remote from `.husky/post-merge` with no prompt, because a person configured that remote by hand and the verb refuses until they have.

The sync refusal protects against a push nobody asked for. A verb whose entire product is the push is outside it and gates on the configuration instead.

### Pickers refuse, confirmations default

A picker standing in for a required argument refuses headlessly rather than defaulting to its first option. Confirm-then-apply prompts keep `nonInteractiveDefault`, since the caller already named what to apply.

The distinction is whether the prompt chooses what to do or confirms what was asked for.

### A decision seam reaches a gated branch

A branch gated behind a prompt takes an optional seam so a test can reach it. `select` exits without a TTY, so the branch is otherwise reachable only through a PTY.

`WorkflowDeps.choose` defaults to the real prompt, leaving production unchanged while tests assert the exact staged set. Prefer this over asserting on the logic that feeds the prompt.

### Driving a prompt needs a PTY

`select` in `src/cli/ui.ts` exits when `process.stdin.isTTY` is false, so every branch behind a prompt is unreachable from vitest and a plain shell run.

`script -qec "<command>" /dev/null` allocates a PTY, and piping timed keystrokes into it exercises the real apply path, with `j` and `\r` moving and confirming. Order the sleeps against the domain work that runs before the prompt.

### Only the PTY proved the commit path

For `canon sync`, a fake `GitRunner` proved the decision logic. Only the PTY run proved the narrowed staging stages the changed paths and that `git` output pipes into the open frame.

### A check sits where the write runs

`.github/ISSUE_TEMPLATE/toolkit-feedback.yml` marks fields required inside the web composer alone. Every feedback issue here is filed by `canon feedback` through `gh issue create --body`, which never renders a form, so `REQUIRED_FIELDS` in `src/feedback/body.ts` refuses ahead of the issue call.

Widening the form's own required list changes nothing about a report the form never sees.

### The cost of the second list

Nothing compares the form's list with `REQUIRED_FIELDS`. `blank_issues_enabled: false` closes the route around both at the price of every other issue losing its web form. Measured at `d60b3117` on 2026-09-01.

### Feedback domain labels

`canon feedback` adds a domain label for each domain word in the `### Surface` text before its first comma, through the `DOMAIN_LABELS` table in `src/feedback/body.ts`. It leaves the type label (`bug`, `enhancement`) to triage.

A missing label fails the whole filing, since `gh issue create` refuses an unknown label rather than dropping it, so every table value has to exist on the toolkit repository.

### Why not retry with `feedback` alone

Telling a label refusal from every other `gh` failure means parsing stderr. The web form keeps its static `feedback` label, since it cannot read a field the submitter has not typed yet.

### Optional report sections

The report carries `### Suggested shape`, `### Why`, and `### Links` after `### Proposed fix`, all optional and absent from `REQUIRED_FIELDS`. A report written to the older template stays a prefix of the new one and still files.

The skill states that the issue body is the request, since a comment is easy to miss, and promises no edit of a filed issue because no verb performs one.

### Fences close by length

A Suggested shape routinely holds a template with its own fence, so `parseSections` closes a fence only on the same marker at least as long, per CommonMark. Toggling on any fence line truncated that section at the inner close and read the template's `###` lines as fields.

### Unattended callers get refusals

A command an unattended caller drives makes every gate a refusal with a non-zero exit. `canon tasks archive` is called by `.husky/post-merge` and by `task-complete`, and a gate that only reports is useful to the second and worthless to the first.

The command owning the gates also keeps the two callers from drifting into archiving differently.

### A shell wrapper masks exits

A non-zero exit reaches the hook reliably and a session only sometimes. An operator's shell profile may wrap `canon` in a function that runs the binary and then a second command and takes the second status, masking an ordinary refusal and an unknown command alike.

### The remedy is a `--json` record

Nothing inside the process can see that function, so no probe detects it and the remedy sits in what a caller reads. A verb a skill drives owes a `--json` record carrying whatever the caller routes on, being `ok` and `reason` on a refusal and the per-item actions on a report.

The skill body branches on the record.

### Nothing gates a reintroduced exit branch

A pattern matching one fires on every legitimate use, the false-positive class that teaches contributors to route around a stage. The rule stays stated and gets revisited if a second instance appears.

The seeded `CLAUDE.md` names no `canon` verb, and the one seeded hook that calls one already decides on the record, so a scaffolded project inherits no exit branch to correct.

### Refusal reasons split on actionability

Once any caller is told to swallow a subset, a reason splits on whether the caller can act on it. `git-pr` skips silently on `no-board`, `no-match`, and `ambiguous`, because each describes a board where a guessed write lands on the wrong task.

A malformed argument describes the command line instead, so it refuses as `bad-input` and falls to that skill's report branch. Sharing a reason across the two classes puts a caller defect inside a swallowed set, the silent loss the verbs exist to prevent.

### The split covers all three task verbs

`archive` answered both selectors with `ambiguous`, which routes `task-complete` to repair a task citation that is fine, so one mistake read as three board defects depending on which verb saw it.

A taxonomy holding for one verb in a domain and not its siblings is read as a distinction rather than the omission it is.
