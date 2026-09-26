---
title: Drift surfaces
description: The six sections canon sync --check reports beside the per-domain scan, being seeds, superseded artifacts, unmigrated domains, new rules and skills, and the reverse walk, with the managed-target gate and what counts toward the exit code
---

# Drift surfaces

`canon sync --check` reports six sections outside the per-domain scan that
`install-and-sync.md` describes, because each names something
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

## Seeds, superseded artifacts, and unmigrated domains

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

No skill splits the file. The standard governing `replacedBy` is the one the
`appliesTo` the standards catalog declares, and `canon standards <name>` reads
its destination shape, so the split is the project's own to make.

`unmigrated` names a domain sitting at the root layout an older toolkit installed
to, with nothing at the path the current one reads. It carries `rootPath`,
`installPath`, and a file count. Without it a project holding `standards/` at its
root reports zero entries for that domain and reads as clean, which is the most
misleading state the report can produce.

The field currently names no domain. Standards is the one the toolkit ever
installed at a project root, and it closed its install channel, so a project
still holding a root `standards/` folder is carrying its own authoring surface
rather than an unfinished install. Nothing proposes moving it, and no
command relocates the content. Move it yourself.

## Rules the target never received

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
every rule. The base stack takes four folders whole, the code stacks add `code`, and
every other stack extends them with individually named rules, so an unfiltered
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

## The reverse walk

`reverse` is the one section built by walking the target rather than the
catalog. Every other surface enumerates toolkit-owned keys and asks whether the
target matches, so a folder the toolkit deleted appears in none of them. It
carries `unclaimed` and `historyUnavailable`.

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

## What counts toward the gate

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
