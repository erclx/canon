---
title: Target migrations
description: One-time moves a project scaffolded under an older toolkit runs before its next sync
category: Agent surface
---

# Target migrations

Each section below is a move a project runs once, when it was scaffolded before the change the section names. Run `canon upgrade` first, so the verb doing the move is the current one. For the recurring sync that follows, see [target sync](target-sync.md).

## Move the records first, once

Session records moved out of `.claude/` and into a root of their own. What is committed stays where it is, and everything gitignored, being the task board, the plans, the memory pen, the review reports, and the scratch folder, now lives under `.canon/`, which a single ignore entry covers.

`4.7.0` carries `canon migrate records`, so run these three lines from inside the project. Run `canon upgrade` first regardless of what you hold, since the sweep learned to pass over the records themselves after that release and a `4.7.0` binary rewrites them.

```bash
canon tooling sync claude . --write
canon migrate records --json
canon migrate records --write --json
```

The first line takes the `.canon/` ignore entry, and the verb refuses until the project has it, since every folder it relocates is ignored where it stands and landing one under a tracked root commits the memory pen. The second reports the plan and the third applies it, moving the folders and repointing every tracked file that cites one.

Order matters between the first line and the two under it. The sync prunes the twelve old `.claude/` ignore entries down to the one `.canon/` line, which leaves every record still at the old root visible to git and therefore to the verb. The sweep passes over them on purpose, reporting a count of what it left alone rather than reading the memory pen and the groundwork trails as source.

## Back records up off this machine, once

Moving records under `.canon/` relocates them, and relocating them is not the same as backing them up. Run `canon records push` once a private repository exists for them, and it prints the one-time setup command when it finds none, since the task board, the memory pen, and the groundwork trails otherwise live on one disk with nothing pushing them off it. `canon init` prints the same reminder as a notice-only step rather than trying to run this non-interactively, since the private repository does not exist yet at scaffold time.

Read the `ok` field out of the `--json` record rather than the exit code. A shell profile that wraps `canon` in a function takes its status from whatever the function runs last, so an absent subcommand and a clean run can both exit 0, and a reader watching the exit alone concludes the move happened.

A tracked file that names an old record path on purpose, such as prose dating a decision, keeps it by carrying `canon-keep-record-root` on that line or the nearest non-blank line above. The report pass prints every file it would rewrite, which is where to catch one before `--write` runs.

Until the move runs, the project is exposed. The shipped ignore set no longer names the old record paths, so a project holding records at `.claude/` stops ignoring them on its next `canon tooling sync`, and the first sign is a memory file or a task board appearing in a commit. Every command reads either root, so nothing else breaks in the meantime, and running the move is what closes it.

Then sweep the records themselves, which the three lines above never reach. They enumerate through git, and the records are gitignored by construction, so a task still naming its plan at the old root resolves nothing once the folders move.

```bash
canon migrate record-tree --json
canon migrate record-tree --write --json
```

This is a separate step rather than a fourth line in the block above because the move has to land before there is a new root to walk. The scope is the folders a session still follows a path into, being `diagrams`, `memory`, `plans`, `proposals`, `review`, `tasks`, and `teach`, each minus its own `archive/` subtree. A closed groundwork or intake trail, the scratch folder, and the backup history are counted and left alone, since a path inside one of those sits in a sentence about work that already ended.

Read the report before `--write` here more carefully than above. The record tree is untracked, so a wrong rewrite has no git undo, and the report names every citation with its line number and the line text for exactly that reason. The same `canon-keep-record-root` marker protects a line that has to keep the old spelling.

## Move rules off the flat layout, once

Installed rules moved from a flat `.claude/rules/<subdir>/` layout to `.claude/rules/canon/<subdir>/`. A project that installed governance before that release still holds the flat layout, and neither of the two governance verbs below notices: `canon gov sync` reports `No governance surfaces found in target` and exits 0, and `canon gov install` lands a second, wrapped copy beside the stale one rather than replacing it.

Run `canon upgrade` first if you have not, then run this from inside the project:

```bash
canon migrate rule-layout --json
canon migrate rule-layout --write --json
```

The first line reports the plan and the second applies it, relocating each rule and carrying an edited one's recorded hash forward so it still reports as edited on the next sync rather than reading clean. Run it once, ahead of `canon gov sync` or `canon gov install`, on any project scaffolded before this move landed.

## Rename the skill citations, once

Twenty-five plugin skills dropped their `claude-` prefix for two-word names, so `canon:claude-docs` answers as `canon:context-fold` and `canon:claude-tasks` as `canon:task-board`. A project that installed governance or tooling before that release holds files naming the old ones, and the plugin answers to none of them. A later release renamed `docs-fold` to `context-fold`, since the skill folds a session into the context entries and the task board rather than into `docs/`, and the same sweep carries a project across that rename too. <!-- canon-keep-retired -->

Two of those files run rather than sit there. `.husky/post-merge` prints a command for a person to type, and `.claude/hooks/pr-create-log.sh` hands a session a message naming a skill, so a stale copy tells someone to invoke something that no longer exists. A rule under `.claude/rules/canon/core/` names skills too, though a rule is read rather than run.

Resync what the toolkit owns, then sweep what the project wrote:

```bash
canon gov sync
canon tooling sync <stack> . --write
canon migrate skill-names --json
canon migrate skill-names --write --json
```

Run the second line once per stack the project holds, since the two hooks above arrive from different ones. The third reports the plan and the fourth applies it.

The order carries the reason. A sync replaces each toolkit-owned copy with one already carrying the new names, and the sweep afterwards reaches the prose the project wrote itself. Sweeping first rewrites those installed files in place, which moves them off the hash the install recorded, so the next sync reads them as edited by the project and leaves them alone.

## Move the surfaces off `.claude/`, once

Tracked surfaces moved out of `.claude/` and into a root of their own. `context/`, `decisions/`, `wireframes/`, the three loose documents (`ARCHITECTURE.md`, `REQUIREMENTS.md`, `DESIGN.md`), and the install stamp folder, respelled `canon/config/`, now live under `canon/`, and `rules/`, `skills/`, `hooks/`, and `settings.json` stay put since Claude Code reads those by path.

Run `canon upgrade` first if you have not, then run this from inside the project:

```bash
canon migrate surface-roots --json
canon migrate surface-roots --write --json
```

The first line reports the plan and the second applies it, moving each surface with `git mv` so its history follows and repointing every tracked citation of one in the same run. See `canon docs agents` for the full file list rather than reading it here.

Neither `canon sync --check` nor any other command notices a surface still sitting at `.claude/`, so running this is on you rather than on a prompt from the toolkit.
