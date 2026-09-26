---
title: Install and sync
description: What each install and sync verb writes, refuses, or leaves alone, and how drift is attributed in a target project
---

# Install and sync

The behavior notes behind the verbs listed in `commands.md`. Each one records what the verb writes, what it refuses, and what it deliberately leaves alone.

## Domain sync

`canon gov sync` updates only rules already present under
`.claude/rules/canon/` and never adds new ones. That wrapper marks the
toolkit-owned half of the tree, and it is the whole of what the walk reaches:
`.claude/rules/project/` sits outside it by location and is never read,
matched, or reported on, which is how project-authored rules survive. It also
removes a stale `.claude/GOV.md` from the retired build. Use
`canon gov install` to add rules.

Everything under `.claude/rules/canon/` belongs to the toolkit, so a rule
there that the toolkit no longer ships is deleted on sync, edited or not. That
is how a retired rule stops loading in a target. A renamed or renumbered rule
the toolkit declares in `governance/renames.toml` moves instead: the sync
installs the rule under its new name and deletes the old file, whether or not
the target's stamp records a stack. Local edits to the old file are not
carried, and the sync says so. The sync lists each change by path before it
applies, and the target's git diff is the record afterwards. `canon sync
--check` lists the same file as `retired` or `renamed` before any sync runs. A project's own rules belong under `.claude/rules/project/`, where
`canon standards rule` reserves `900-999` for them, and a rule placed under
`canon/` instead is lost on the next sync.

A sync never deletes a rule that a newer canon release installed. The stamp
records the newest release that synced governance, and an older binary holds
every rule it finds no source for, naming both releases and asking for an
upgrade, rather than deleting what it cannot recognize.

A renamed rule loses its old file and gains nothing under the new name unless
the target's stamp records the stack it installed, in which case the new name
shows as `missing` and `canon gov install <stack>` adds it.

Design's own orphans are the target's overrides and are meant to stay where
they are, so `canon design sync` deletes nothing it finds no source for.

`canon design install` copies one toolkit-owned file to
`.claude/design/base.css` and creates no override. A project overrides a value
by writing `.claude/design/project/` itself, which `canon design sync` never
touches, because that subfolder is project-authored by location the way
`.claude/rules/project/` is. An override named exactly like the shipped file is
still the project's.

The override ships absent rather than empty. An empty file is one the project
did not ask for and did not write, the reconciliation already handles a missing
side, and an empty override invites a target to fill it before it has an
opinion.

Nothing arrives on a project that has not run `canon design install`. The
domain is detected by that folder existing, so `canon sync` skips it entirely on
a target that never installed it, and the unstamped line at the end of
`canon sync --check` stays quiet about it for the same reason. Governance is
named there when it is absent and design is not, because a managed project
without governance has yet to install what every project carries, while one
without design chose that.

When the target's install recorded a stack, `canon gov sync` also reports a
rule that stack lists and `.claude/rules/canon/` does not hold, as a `missing`
entry carrying no change. This is what makes a target whose recorded sync point
postdates a rule joining its stack still see that rule: the report reads the
target's current entitlement against its current tree rather than diffing
from an anchor a later sync could advance past the rule's own commit. A
target whose install predates the recorded chain falls back to the same
band-inference `newRules` uses in `canon sync --check`.

There is no `canon standards sync` and no `canon standards install`. The corpus
installs into no project, so the domain has nothing in a target to reconcile.
`canon standards <name>` prints one, resolving `standards/` at the working root
and then the corpus inside the package, and `canon standards list --json` carries
the catalog.

## Tooling diff and sync

`canon tooling diff <stack> [target]` is the read-only comparison, and a session asking what differs reaches for it by default. It writes nothing and exits 1 when anything differs and 0 when nothing does, so it gates CI. `--json` adds the scan record on stdout with `ok: true`, and the frame goes to stderr. A refusal such as an unknown stack, an excluded stack, or a toolkit-root target still exits 1 and answers `{ ok: false, reason, message }`, so a caller branches on the record and reads a typo'd stack name as a refusal rather than as drift.

The record carries a `withheld` array beside `configs`, each entry `{ rel, stack, present }`. It fills only when the target sits below its git root: every `.github/` config or seed moves there rather than into `configs` or `seeds`, and none of them counts toward the exit, since GitHub never reads a workflow outside the root. `present` marks a copy an earlier sync already left in the subfolder, which the sync reports and never deletes. At a root, and for a target outside any repository, `withheld` is empty.

`canon tooling sync <stack> [target] --check` reports the same list and always exits 0. It stays for scripts that already call it. `sync` itself writes only under `--write`, and a headless run with neither flag reports and exits 1.

## Install guards

`canon gov install` requires its first argument under
`CANON_NON_INTERACTIVE=1`. It used to fall back to an interactive picker that
resolved to its first option headlessly, so a call with no stack installed
whichever stack sorted first. It now reports the valid names on stderr and
exits 1.

Every documented agent path already passes the argument, including
`canon init`. The confirm-then-apply prompt after it still resolves to `Yes`
headlessly, so a call that names its stack is unchanged.

`canon gov install` also refuses the toolkit root as a target. It resolves the
target before anything else, so a path that does not exist fails rather than
being scaffolded.

A target still on the flat installed-rule layout from an older release reports
"No governance surfaces found in target" from `canon gov sync` and exits 0,
since sync reads only the current wrapped destination. `canon gov install`
against that same target writes a second, wrapped copy beside the flat one
rather than reading or clearing it, so the target ends up holding both, and
Claude Code loads both copies of an edited rule at session start. Run `canon
migrate rule-layout` first to move a target off the flat layout, which reports
what it would move and applies it under `--write`.

## Standards resolution

`canon standards <name>` writes the document to stdout and the root it answered
from to stderr, so a caller capturing with `$(...)` receives the document alone.
A name resolves with or without its `.md` extension, and one that matches no
standard exits 1 after listing the catalog on stderr.

Two roots answer, in order: `standards/` at the working directory, then the
corpus inside the package. A project that authors standards of its own uses the
first, and this repository's own authoring root is the same path. `.claude/standards/`
is not among them, and no repository writes one any more. A copy an older
toolkit installed into a target resolves nothing.

There is no citation closure to compute, since nothing is copied. A standard
that hands a concern to a sibling names it in `Does not govern:` and a reader
runs the verb again for that name.

## Governance regen

`canon gov regen` is the one governance verb that runs against the toolkit root,
because the `.claude/rules/` it writes there is produced output rather than an
operator's working copy. It reads the stack recorded in `internal/governance.toml`
into `.claude/rules/canon/`, installs anything under `internal/rules/` into a
separate `.claude/rules/internal/`, and clears both destinations first so a
rule the record stopped naming disappears. `internal/` is what this repository
alone carries: no `canon gov install` or `canon gov sync` target ever writes it,
since a target has no rule source of its own that ships nowhere.

It takes `--root <path>` and defaults to the toolkit root, prints nothing on success, and
reports the reason on stderr with exit 1 when the record names a stack or rule
that does not resolve. `scripts/core/regen-claude-copies.sh` calls it, and the
Consumed copies stage of `bun run check` asserts the result is committed.

## Whole-project sync

`canon sync` runs every installed domain sync, then offers to commit the result
and open a pull request. Under `CANON_NON_INTERACTIVE=1` it applies the domain
syncs and then refuses the git workflow, reporting the branch and commit it
would have created and exiting 0. Nothing is staged, committed, or pushed
headlessly.

Run it interactively to reach the commit and pull request options.
It also refuses a target whose working tree is dirty, so commit or stash first.

## Drift reporting

`canon sync --check` reports drift and writes nothing, so it needs no clean tree
and is safe to run at any time. Each file is classified as `stale` when it still
matches what the toolkit installed, `customized` when the project edited it,
`stranded` when it sits at a path the toolkit no longer installs to, `orphaned`
when the project authored it, or `drifted` when no stamp covers it. Governance
also reports `missing`, for a rule the target's recorded stack lists that its
tree does not hold at all, `retired`, for a rule under
`.claude/rules/canon/` the toolkit no longer ships, which the next sync
deletes, and `renamed`, for one the toolkit ships under a new name, which the
next sync moves. A `retired` or `renamed` file counts toward `--exit-code`,
since one sync clears it.

Use `--json` for the machine-readable report and `--exit-code` to fail a CI job. Orphaned
and missing files are both excluded from that exit code: a project-authored
rule never converges, and a sync that added a missing one silently changes
what the project is governed by, which stays a separate command an operator
chooses to run. Attribution reads `canon/config/config.json` first, which every
install and sync now writes, and falls back to `.claude/canon/config.json` for
a target that has not moved.

A target installed before stamping shipped has no such file, and neither does
that fallback do anything to migrate it. A target stamped before the file
moved into `.claude/canon/` still carries it at the retired
`.claude/canon.json`, and `canon sync --check` reads that path when the current
one is absent, reporting it rather than moving it. Only a target carrying
neither path falls back to the toolkit's own git history.
Installed content matching any
version that history ever published proves the file is untouched, so it reports
`stale` naming the commit it came from, and content matching no published
version stays `drifted`. A toolkit reached outside a git clone, which is what a
registry install is, cannot run that fallback and reports
`historyUnavailable` alongside the unattributed files.

Each domain carries its own toolkit anchor in that file, so syncing one domain
never advances the revision another measures from, and each reports the upstream
commits touching its own source path. The `covers` field names the domains a
target has actually stamped, so a domain that was never stamped is legible
rather than reading as a clean one.

### Tooling

Tooling records the stack chain an install resolved rather than per-file hashes,
since `src/tooling/` runs its own inject machinery and has no walk to attribute.
The chain is ordered nearest stack first, which is what a `--skip` run needs:
recording the leaf alone would send the next report measuring against a layer the
target deliberately does not carry. The report loads exactly those stacks, scans
them the way `canon tooling diff` would, and counts what differs per category
under `tooling.counts`.

`measured` is the field the section exists for. A target carrying no chain
reports `measured: false`, which separates tooling nobody has ever looked at from
tooling that is current. Both produce zero changes otherwise. Every target
installed before the record shipped starts unmeasured and leaves on its next
`canon tooling sync`, since backfilling would mean inferring the chain from
installed files, which is the guess the record replaces.

A workspace root records nothing, because each package resolves its own chain and
one written at the root would be that same guess. Run the check against a package
to measure it. Tooling never counts toward `--exit-code`, on the grounds seeds
are already excluded on, since it reports golden configs a project is expected to
edit and a job counting those stays red with no remedy.

### Surfaces reported beside the domains

Six sections sit outside the per-domain scan, because each names something
that walk cannot see: `seeds`, `superseded`, `unmigrated`, `newSkills`,
`newRules`, and `reverse`. None of them produces a change, and no sync command
applies any of them. What each reports, the managed-target gate they share, and
which count toward `--exit-code` are in `drift-surfaces.md`.

## Bootstrap

`canon init` installs up to five core domains and reports each one independently. A
domain that fails does not abort the run, so the command finishes the rest and
exits 1 naming the failures. Passing any flag skips the confirmation prompt,
which is what makes it scriptable.

`--stack` defaults to `base`, and the default
does not read as a passed flag, so a bare `canon init` installs governance and
still prompts. `--skip` takes `wiki`, `governance`, and `records`, and warns
without aborting on any other value. Records has nothing to run non-interactively,
since the private backup repository does not exist yet at scaffold time, so its
step only prints the one-time setup reminder and `--skip records` silences it.
There is no `--standards`, since no run writes that corpus into the target.

## Unguarded tooling primitives

`canon tooling inject` and `canon tooling prune-gitignore` are the unguarded
primitives beneath `sync`. They apply one stack with no scan and no prompt, and
they deliberately skip the check that rejects `claude`, which is how `canon
claude` drives its own stack through them. Use `sync` unless you are scripting
provisioning. Both frame their own output, so pass `--nested` when calling from
inside an already-open frame.
