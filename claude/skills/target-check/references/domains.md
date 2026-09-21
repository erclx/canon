---
title: Target check domains
description: What each of the six domains reads, what counts as current, and where a finding routes
---

# Target check domains

One section per domain, in the order the body reports them. Each names the read, what current looks like, what the states mean, and the command or skill a finding routes to. Naming a repair is not running one.

## 1. Toolkit version

Read `skew` off `canon sync --check . --json`. It carries `state`, `installed`, and `latest`.

- Current: `state` reads `current`, or `installed` equals `latest`.
- Behind: `installed` trails `latest`. Name both versions.
- Unread: no `skew` key, or the whole report refused. Say the version could not be read and treat every section under it as read against an unknown binary.

Routes to `canon upgrade`, which reinstalls with the manager that installed it.

This domain is first because it conditions the other five. A target a release behind carries an older verb surface, so a section reporting unread below may be reporting a missing subcommand rather than a missing surface, and the version state is what separates those two readings.

## 2. The `canon/` folder

Read three fields off the same report, then two verbs:

- `unmigrated`: a domain still at the root layout with nothing under `.claude/`. The most urgent finding, because such a domain reports no drift of its own while being entirely behind.
- `superseded`: a file a newer seed folder replaced. No command moves it, since the content is the project's own.
- `reverse`: `unclaimed` names folders at roots the toolkit stopped shipping, each with an `attribution` of `dropped`, `unattributed`, or `project`.
- `canon context audit --json`: required sections, entry length, citations, and index drift across the context folder.
- `canon records validate <kind> --json`, once per record folder the target carries.

- Current: `unmigrated` and `superseded` both empty, `reverse.unclaimed` carrying nothing outside `project` attribution, and both verbs finding nothing.
- Behind: any of those carrying an entry. Name the entry and its attribution.
- Unread: `historyUnavailable` set on `reverse`, a `reverse` key the report does not carry at all, or either verb refusing. A missing `reverse` key is a binary predating the field rather than a target with nothing unclaimed.

Routes by finding. `unmigrated` routes to a relocation the user runs, since no command moves it. `superseded` routes to a split the user makes, since no command moves the content and no skill proposes it. An `unclaimed` folder carrying `project` attribution routes nowhere, since history proved the project owns it.

## 3. Governance rules

Read `domains` off the report and take every entry it carries rather than naming governance here. Each entry carries `stamped`, per-state `counts`, and `entries` with a `state` and a `rel` path.

The states are `matching`, `stale`, `customized`, `drifted`, `orphaned`, `stranded`, and `missing`.

- Current: every count but `matching` reads zero.
- Behind: any other count is non-zero. Report the counts and name the paths behind `stale` and `missing`, which a sync repairs, separately from `customized` and `drifted`, which the project wrote and a sync would overwrite.
- Unread: `stamped` false with no entries, or the domain absent from the array while the target carries installed rules.

Routes to `canon <domain> sync`, or to `canon sync` for every installed domain at once. Read the `canon-cli` skill before naming either, since a command name says nothing about what it does to a file already there, and a `customized` entry is exactly the file a sync takes back.

## 4. Tooling

Read the `tooling` block off the report first, because the comparison command needs a value it carries.

Read `measured` before anything under it. Every count is zero when `measured` is false, which is an absence of measurement rather than a measured zero.

On a measured report, take `<stack>` from the first name in `chain` and run `canon tooling sync --check <stack>`. Never run it bare. The stack argument is what the target carries, and omitting it reaches a prompt that the non-interactive variable resolves to the catalog's first entry rather than refusing, which compares the target against a stack it does not use and reports the difference as drift.

- Current: `measured` true, `chain` naming stacks the toolkit still ships, and `--check` reporting nothing it would change.
- Behind: `--check` naming files it would replace, or `counts.gitignore` carrying missing managed entries.
- Unread: `measured` false. It splits three ways, and each is reported as unmeasured with its cause named rather than as clean. An empty `chain` at a workspace root is by design, since a chain there would guess at what the packages hold. An empty `chain` anywhere else means no tooling install is recorded. A `chain` carrying names the toolkit no longer ships means injecting would write against a retired name.

Routes to `canon tooling sync <stack>`, or to `canon tooling inject --gitignore <stack>` for ignore entries alone, taking `<stack>` the same way the comparison above does. An unmeasured report names no stack, so it routes to neither.

`canon tooling diff` is the verb this section wants and it does not exist yet. `--check` answers the same question today and stays working as an alias by design, so the retarget when that verb lands is a change of name rather than of behavior.

## 5. Seeds

Read `seeds.entries` off the report. Each entry is `matching`, `stale`, `drifted`, or `missing`, and the set spans `CLAUDE.md`, the `canon/` records, the generated indexes, `.claude/settings.json`, and the hook scripts under `.claude/hooks/`.

- Current: every entry reads `matching`.
- Behind: anything else. Report `stale` and `missing` separately from `drifted`, which means the content matches no version the toolkit ever published, so the project wrote it.
- Unread: `historyUnavailable` set on `seeds`, which leaves every difference unattributed. Say so rather than reporting a file as untouched.

Routes to `seed-sync`, which proposes per-section edits without overwriting a customization. It is a proposal rather than a write, which is why a `drifted` `CLAUDE.md` routes there rather than to a sync.

A seed entry matching says the file's bytes match the shipped seed. It says nothing about whether the harness those files configure is wired, which is the next domain.

## 6. The Claude harness

No verb reads this domain. Report it `unchecked` on every run and report it as a row rather than omitting it.

What goes unread is whether the target's hooks fire, whether `.claude/settings.json` registers them, which plugin version the target's sessions actually load, and whether the marketplace cache matches what the toolkit ships.

Confirm the gap against the live surface rather than against a list held here, by reading `canon claude --help` and the help of any subcommand under it that sounds like an answer. A list written into this file freezes on the day it was written and would report a gap a later release had closed. `canon claude skills drift` is the verb that comes nearest, and it reads the toolkit's own history against a ref, which says what moved upstream rather than what this target holds. Report the domain checked, with what the verb answered, on the run where a verb does answer one of the four questions above.

Reading it by file inspection is the alternative and it is refused. Every other section here answers from the verb under test, and a section answering from a hand-rolled read of the same files reaches a verdict nothing else in the report is entitled to make. A hole a reader can see is worth more than a number nobody can trace.

`canon claude plugin-update` is what an operator runs to bring a cache forward. Name it as the action available rather than as a repair for a finding, since no finding was taken.
