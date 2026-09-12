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

A rule under `.claude/rules/canon/` that the toolkit finds no source for is
reported orphaned with no destination offered. The toolkit cannot tell a rule
a project dropped there from one it shipped and later renamed, and a
destination nested inside `canon/` would be wrong for the first case
regardless, since that folder is replaced wholesale on sync.

Nothing is moved either way, because a rule's installed path is one the
project's own rules, skills, and docs may cite. `canon standards rule` carries
the reserved number bands behind the three-way split, where `900-999` under
`.claude/rules/project/` is what a project-authored rule takes and everything
under `.claude/rules/canon/` belongs to the toolkit.

`canon sync --check` does not report an orphaned entry. It skips every one, so
the destination reaches `canon gov sync` alone among the two per-file domain
syncs, since design's own orphans are the target's overrides and are meant to
stay where they are.

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

There is no `canon snippets sync` and no `canon snippets install` either, on the
same ground: `claude/snippets` in the plugin cache symlinks live to the
toolkit's own `snippets/`, so a session reaches one at its `@` reference with
no copy to reconcile. `canon snippets list --json` carries the catalog and
`canon snippets create` is the one verb left that still writes a file.

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
tree does not hold at all.

Use `--json` for the machine-readable report and `--exit-code` to fail a CI job. Orphaned
and missing files are both excluded from that exit code: a project-authored
rule never converges, and a sync that added a missing one silently changes
what the project is governed by, which stays a separate command an operator
chooses to run. Attribution reads `canon/config/config.json` first and falls
back to `.claude/canon/config.json`, which every install and sync still writes
in this release.

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
them the way `canon tooling sync` would, and counts what differs per category
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
applies any of them. The headings below group the first three together and give
`newSkills` its description under `newRules`, which answers the same question
about a different corpus.

All six report only against a toolkit-managed target, which is one carrying a
`.claude/` directory, a `CLAUDE.md`, or a domain still at the root layout. The
report says so through `managed` in the JSON and routes an unmanaged directory to
`canon init`. Seeds are why the gate exists, since they enumerate from the toolkit
source rather than from what a target installed, so an unmanaged directory would
otherwise report every seed as `missing`.

A root-layout domain counts as a marker on its own, because the detection fires
only on root files the toolkit ships and a project in the old layout is one the
toolkit installed. When `managed` is false every section comes back empty rather
than the render alone going quiet, so a consumer reading `--json` never acts on a
finding the rendered half withheld.

#### Seeds, superseded artifacts, and unmigrated domains

`seeds` classifies every seed the toolkit ships against the target's copy, as
`matching`, `stale`, `drifted`, or `missing`. `missing` has no per-domain
equivalent, since the domain walk lists what a target installed and cannot see a
file that never arrived. There is no `customized` verdict here, because that one
needs a stamp and seeds carry none, so a file history cannot attribute stays
`drifted`. Reconcile the section with `seed-sync`, which merges one
section at a time rather than replacing a file the project edits.

A markdown seed installs rewritten rather than copied, since the `stub: true`
marker the toolkit's own seed gate reads is stripped on the way in. The
comparison above runs against what the install would write, so a marked seed a
target never touched still reports `matching`. Every other seed copies byte for
byte.

`superseded` names a file a newer seed folder replaced, such as `.claude/TASKS.md`
against the `.canon/tasks/` that now ships. The entry carries `replacedBy` and
nothing else, and the file is never deleted, since the content belongs to the
project and only its author can decide where it moves. The list derives from the
seed tree rather than from a fixed set of filenames, so a folder added later is
covered without a code change. Only an exact stem matches, which leaves a
suffixed variant such as `TASKS-ARCHIVE.md` unreported.

Route it to `migration-superseded`. That skill resolves the standard governing
`replacedBy` from the `appliesTo` the standards catalog declares, reads the
destination shape with `canon standards <name>`, and proposes the split without
writing. Where a folder has no governing standard, the entry earns a named
refusal rather than a shape nobody stated.

`unmigrated` names a domain sitting at the root layout an older toolkit installed
to, with nothing at the path the current one reads. It carries `rootPath`,
`installPath`, and a file count. Without it a project holding `standards/` at its
root reports zero entries for that domain and reads as clean, which is the most
misleading state the report can produce.

The field currently names no domain. Standards and snippets are the two the
toolkit ever installed at a project root, and both closed their install channel,
so a project still holding a root `standards/` or `snippets/` folder is carrying
its own authoring surface rather than an unfinished install. Nothing proposes
moving either, and no command relocates the content. Move it yourself.

#### Rules the target never received

`newRules` names a rule the target could receive and its tree does not hold. A
sync refreshes the files a target already holds and adds none, so without this
section a project's rule set freezes at its install date while every file it
does hold reports as current. That is the report's most confident wrong
answer, since a clean result reads as a target holding everything the toolkit
publishes.

The list rides beside `newSkills`, which asks the same question about the plugin
catalog. Both are names rather than paths, and neither queues a change, because
the two remedies differ: a skill loads live from the plugin directory and needs
nothing run, while a rule reaches a target only when someone runs
`canon gov install`.

Read a clean section as reporting rather than as delivering. Nothing here
installs, nothing counts toward `--exit-code`, and a target can read the list and
act on none of it. The value stops at an operator reading it, which is the same
contract the skills list already sets.

Since `canon gov install` records the stack it resolved, a target carrying that
record answers this by comparing its current entitlement against its current
tree, with no anchor and no git diff involved. That is what lets the section
name a rule that shipped before the target's last sync: the anchor a sync
advances plays no part in the read, where an anchor-bound diff can never see a
rule on the far side of a window a later sync moved past it. The per-file
`missing` state `canon gov sync` reports comes from the same comparison, so a
rule the chain lists reaches both surfaces the same way.

A target stamped before governance recorded a chain falls back to the older
band-inference read below. The measurement there anchors on governance's own
stamp rather than on the oldest anchor across domains, since rules are
domain-scoped and a shared anchor would let another domain's sync move the
revision rules are measured from. A target carrying no chain and no governance anchor
reports nothing at all: it has no date to measure against, and diffing from the
start of history would read the whole catalog as new.

An anchor this toolkit cannot resolve reports nothing by the same route, and that
one is not visible. A stamp naming a revision the running clone has never seen,
which is what a registry install without history or a shallow clone produces,
fails the read and yields an empty list rather than a stated absence. It looks
identical to a target holding every rule the toolkit publishes. `newSkills`
behaves the same way, and neither carries the `historyUnavailable` flag the
per-domain scan uses to separate the two. Treat an empty section on a toolkit
that is not a full clone as unmeasured rather than clean. This gap does not
reach the chain-based read above, since it consults no anchor at all.

In the fallback, entitlement is filtered, because a stack does not receive
every rule. The base stack takes the `core` and `claude` folders whole and
every other stack extends it with individually named rules, so an unfiltered
list would tell a base consumer about rules it can never receive and train the
reader to skip the section.

The filter accepts a band on either of two grounds. A folder the base stack takes
whole is entitled to every target, read from the stack file so a folder added to
base later needs no code change. Every other band is read off the folders the
target already carries, which is the fallback's only evidence of what a target
was entitled to before it recorded a chain. One band can be reached by more than
one stack, so the test over-reports inside a folder the target holds, which
costs a line where under-reporting would cost the section its point.

A rule the target already holds is dropped by name. That is what keeps a rule the
toolkit moved between band folders out of the list, since a rename reaches this
read as an addition and only the name tells the two apart.

This closes the dangling-citation case as a side effect rather than checking for
one. The live instance is a rule citing a sibling authored after the target's
install, and the section names the sibling as new rather than naming the citation
as broken. That is enough for an operator to act on, and it is not a citation
check.

#### The reverse walk

`reverse` is the one section built by walking the target rather than the
catalog. Every other surface enumerates toolkit-owned keys and asks whether the
target matches, so a folder the toolkit deleted appears in none of them. It
carries `unclaimed`, `migrations`, and `historyUnavailable`.

`unclaimed` names a folder the target holds at a top-level path the toolkit once
shipped and has since deleted. The candidate roots come from the toolkit's own
history rather than from a list, so a root dropped later is covered without a
code change. Scoping to those roots is what keeps the walk useful: walking the
whole tree reports every project folder as unclaimed, which is true and says
nothing.

The managed gate above applies here too, and it is the one place it surprises.
A directory holding a dropped folder and nothing else reports an empty `reverse`
rather than the folder, because it carries none of the three markers. Read an
empty section on an unmanaged target as a walk that never ran rather than as a
clean result.

Each entry carries `rel`, a file count, and an `attribution` of `dropped`,
`project`, or `unattributed`. A dropped folder and one the project wrote are the
same bytes at the same path, so the verdict is traced from history rather than
guessed from the filesystem.

Content matching a version the toolkit published reads as `dropped` and carries
the `since` commit that published it. Names the toolkit shipped holding content
it never published read as `unattributed`, which is a state in its own right
rather than a soft yes. No overlap at all reads as `project`, and the render
drops those while the JSON keeps them.

Only files whose path the toolkit once held are hashed, so a project folder
colliding on a retired name costs the walk no reads. The cost is that a file the
toolkit shipped and the target renamed goes unmatched, the same limit the
`unmigrated` count carries.

`migrations` names a proposal-only skill with a live case in this target. It
fires on a `CLAUDE.md` past 250 lines for `migration-claude-md`, and on a `docs/` folder
holding markdown with no populated `.claude/context/` for `migration-context`.
Each entry carries the skill name and the measurement behind it, so a consumer
can check the proposal before running it. Without the field both skills are
documented and unreachable from any report.

#### What counts toward the gate

`unmigrated` counts toward `--exit-code`, since running the relocation closes it.
`superseded` and every seed state are excluded, for the reason `orphaned` already
is: only the user can move content they wrote, so failing a job on it leaves the
job red with no mechanical remedy.

`newRules` is excluded on a different ground, since a command does close it. What
excludes it is that installing a rule changes what a project is governed by, so
gating on the count would pressure a target into adopting rules nobody chose.
`newSkills` is excluded because it needs no command at all.

The whole `reverse` section is excluded on the same grounds, and more strongly.
Every entry in it is a judgment about a file the project may own, and one of its
three verdicts is a labelled unknown by design. The unmigrated detection shipped
that exact false positive once, failing a push with no action that cleared it,
so this section reports and gates nothing.

## Bootstrap

`canon init` installs up to four core domains and reports each one independently. A
domain that fails does not abort the run, so the command finishes the rest and
exits 1 naming the failures. Passing any flag skips the confirmation prompt,
which is what makes it scriptable.

`--stack` defaults to `base`, and the default
does not read as a passed flag, so a bare `canon init` installs governance and
still prompts. `--skip` takes `wiki` and `governance`, and warns
without aborting on any other value. There is no `--standards` and no
`--snippets`, since no run writes either corpus into the target.

## Unguarded tooling primitives

`canon tooling inject` and `canon tooling prune-gitignore` are the unguarded
primitives beneath `sync`. They apply one stack with no scan and no prompt, and
they deliberately skip the check that rejects `claude`, which is how `canon
claude` drives its own stack through them. Use `sync` unless you are scripting
provisioning. Both frame their own output, so pass `--nested` when calling from
inside an already-open frame.
