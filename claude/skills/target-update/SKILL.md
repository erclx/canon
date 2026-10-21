---
name: target-update
description: Catches a target project up to the toolkit after a release. Upgrades the binary and plugin, previews the changelog summary, the pending migrations, and the drift, then on the operator's go-ahead migrates, syncs, regenerates the indexes, and ends on a clean `target-check` or named remainders. Use when asked to "update this project to the latest canon", "catch this target up", "apply the new release here", "run the pending migrations", or "bring this project current with the toolkit". Do NOT use on a project without the toolkit, which is `target-setup`, or to report drift without repairing it, which is `target-check`.
metadata:
  family: upkeep
---

# Target update

Takes a target from behind the toolkit to current. Every fact comes from a `canon` verb, and this body holds the order and the judgment calls the verbs leave open. It names no migration, rule, or stack, so a later release reaches it with no edit here.

Read `canon docs migrate` for what each migrate verb moves and refuses, and `canon docs sync` for the drift causes. This body cites them rather than restating them.

## Guards

Stop with the line beside each state.

| State                                       | Stop                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `canon` absent from the path                | `❌ canon is not on PATH, so nothing can be read.`                                                |
| No `.claude/` directory at the working root | `❌ No .claude/ here, so the toolkit is not installed. Run /canon:target-setup instead.`          |
| A `claude/skills/` folder, no leading dot   | `❌ This is the toolkit itself rather than a target. Run this from the target's own session.`     |
| A dirty working tree                        | `❌ Uncommitted changes here. Commit or stash them first, since canon sync refuses a dirty tree.` |

Then hold two rules for every verb this body runs.

- Run it from the target root with no prefix, since a call with no terminal on stdin already runs headless
- Branch on its record's fields rather than its exit, which a shell function wrapping `canon` can flatten

## Step 1: bring the binary and plugin forward

Read `skew` off `canon sync --check . --json`. When `installed` trails `latest`, run `canon upgrade --json`, then `canon claude plugin-update --json` whatever the skew reads.

Both write to the machine rather than the target, and the preview needs the verbs and the changelog a newer binary carries, so they run before it. The permission dialog gates each. Report a refusal from either and continue on the installed binary, saying the preview reads against it.

## Step 2: read the pending work

Run these in parallel from the target root:

```bash
canon changelog --json
canon migrate status --json
canon sync --check . --json
```

Then take `<stack>` from the first name in the report's `tooling.chain` and run `canon tooling diff <stack> . --json`. Never run it bare, since a headless call resolves the stack prompt to the catalog's first entry. Report tooling unmeasured when `tooling.measured` is false or `chain` names nothing.

### When a read refuses

A refusal is a fact for the preview, never a gap to fill by reading files.

- `changelog` refusing `no-stamp` or `unknown-version`: say the summary is unread and why. Offer `--since <version>` when the operator names one, and never guess a start.
- `migrate status` carrying no such subcommand: the binary predates it. Stop, since pending migrations cannot be listed without detecting them here, which this skill never does.
- A missing report key is an older binary rather than an empty answer. Name the installed version beside it.

## Step 3: preview and wait

Write the preview from those records alone, then stop and wait for the operator. Nothing in the target is written before the go-ahead.

```markdown
Target update: `<path>`, canon `<installed>` to `<running>`.

**What changed since `<since>`:** <three to six bullets from the changelog entries, each naming what this project will notice, never the version>

**Migrations, in run order:** <each pending or refused entry from migrate status, with its verb>

**Drift:** <each non-empty cause from sync --check, with its count and paths>

**Calls for you:** <each judgment call below this run meets, with the default this skill takes>

**Commands, in order:** <the exact commands Steps 4 to 6 will run>
```

Summarize the changelog for this project, not for the toolkit. Drop an entry that touches nothing the target holds, and lead with anything a migration or a sync will change.

### Nothing pending

When the changelog range is empty, `migrate status` lists nothing pending or refused, and the drift lines hold nothing a step here would take, write nothing. Invoke `canon:target-check` and report the target current with its table.

## Step 4: migrate

Run each pending migration in the order `migrate status` gave, one at a time, as the entry's `verb` with `--write --json` appended. The verb carries the flags its dry run used, so a bare `canon migrate <name>` would apply a plan the preview never showed.

- Run `canon migrate status --json` again after each write, since an applied move can turn a clean entry pending
- Stop and ask on a `refused` entry, quoting its reason and the remedy it names. Run the remedy only on the operator's word, since a refusal guards a destination the project may own.
- Stage each write with `git add -A`, since no migrate verb stages and the tree was clean before it, then commit through `canon:git-commit`, one commit per migration
- Skip the commit when the write changed no tracked file, as `record-tree` does by touching only gitignored records

### Markers

A planned rewrite can reach a line that names an old spelling on purpose, such as a dated note or a quoted history. Propose a marker for each such line in the preview, and add it before the write. `canon docs migrate` names the marker for each spelling.

### The record-tree backup

The record tree is untracked, so a `record-tree` rewrite has no undo. Run `canon records push --json` before its write. When that reports no backup repository, copy `.canon/` to a dated folder outside the project and name the path in the report.

## Step 5: sync

Run `canon sync .`, then `canon tooling sync <stack> . --write` when the tooling diff named files to change. Treat each drift cause the way the preview stated:

| Cause                       | This skill                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `stale`, `retired`, renamed | Takes the sync's write                                                                           |
| `customized`                | Keeps the project's file. Shows `git diff -- <rel>` as the toolkit's change, then `git restore`s |
| `stranded`                  | Names where the file sits and where the toolkit now installs, and moves it only on the word      |
| `seeds` drifted             | Merges by hand against `canon claude seeds list --json`, keeping the project's edits             |
| `seeds` stale or missing    | Takes the toolkit's copy whole                                                                   |
| `newRules`                  | Lists them, and installs only the ones the operator picks, with `canon gov install --add`        |

A `customized` rule is the file `canon sync` replaces, so read it back after the sync rather than trusting the report from Step 2. Report each kept file with the toolkit's change summarized in a line, so the operator can take it later.

### What the toolkit dropped

Read `reverse.unclaimed` by attribution. Delete a `dropped` folder, read an `unattributed` one and ask before deleting it, and leave a `project` one alone.

Read the report's top-level `superseded` and `unmigrated` lists apart from it. Each names a move only the operator can make, being a file a newer seed replaced or a domain still at the root layout, so name each and move nothing.

## Step 6: regenerate and verify

Run `canon indexes regen`, then the project's own check script when it carries one. Invoke `canon:target-check` last.

Stage the sync, the merges, and the regenerated indexes with `git add -A`, since `canon sync` leaves its writes unstaged, then commit through `canon:git-stage`. Name what changed in the project in each subject, such as the rules refreshed or the seeds merged, and never the toolkit version.

## Output

```markdown
Target update: `<path>`, now on canon `<version>`.

<the target-check table>

**Kept for you:** <each customized or drifted file left as the project wrote it, with the toolkit change it skipped>

**Remaining:** <each refusal, stranded file, or unread domain, with the command or decision it waits on>
```

Omit a section that holds nothing. End on the commits and the check, and leave the pull request to `canon:git-ship`.
