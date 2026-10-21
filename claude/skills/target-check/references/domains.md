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

Read four fields off the same report, then three verbs:

- `unmigrated`: a domain still at the root layout with nothing under `.claude/`. The most urgent finding, because such a domain reports no drift of its own while being entirely behind.
- `superseded`: a file a newer seed folder replaced. No command moves it, since the content is the project's own.
- `unmovedSurfaces`: a surface held only at its `.claude/` spelling, each carrying `rel` and `movesTo`. Read the array itself, since every other field and the drift status read clean here by design.

### Reverse and the verbs

The fourth field and the two verbs cover what the toolkit stopped shipping and what the context folder holds.

- `reverse`: `unclaimed` names folders at roots the toolkit stopped shipping, each with an `attribution` of `dropped`, `unattributed`, or `project`.
- `canon context audit --json`: required sections, entry length, citations, and index drift across the context folder.
- `canon records validate <kind> --json`, once per record folder the target carries.
- `canon migrate status --json`: every migration in run order, each with a `state` of `pending`, `clean`, or `refused`. It exits 2 while any is pending.

### Verdicts

Each of the three states takes all seven reads together.

- Current: `unmigrated`, `superseded`, and `unmovedSurfaces` all empty, `reverse.unclaimed` carrying nothing outside `project` attribution, and all three verbs finding nothing.
- Behind: any of those carrying an entry, or a `pending` migration. Name the entry and its attribution, and for `unmovedSurfaces` each `rel` with its `movesTo`.
- Unread: `historyUnavailable` set on `reverse`, a `reverse` or `unmovedSurfaces` key the report does not carry, or any verb refusing, a `refused` migration included
- A missing key is a binary predating the field rather than a target with nothing to report, so name the installed version beside it

Routes by finding.

- A `pending` migration routes to its entry's `verb`, which only reports its plan until `--write` is passed. Name each in the order the status gives, and run neither form.
- `unmovedSurfaces` is the `surface-roots` migration. Name each entry's `rel` and `movesTo` beside its verb.
- `unmigrated` routes to a relocation the user runs, since no command moves it.
- `superseded` routes to a split the user makes, since no command moves the content and no skill proposes it.
- An `unclaimed` folder carrying `project` attribution routes nowhere, since history proved the project owns it.

## 3. Governance rules

Read `domains` off the report and take every entry it carries rather than naming governance here. Each entry carries `stamped`, per-state `counts`, and `entries` with a `state` and a `rel` path.

The states are `matching`, `stale`, `customized`, `drifted`, `orphaned`, `retired`, `stranded`, and `missing`. A `retired` rule is one the toolkit no longer ships, and the next sync deletes it.

- Current: every count but `matching` reads zero.
- Behind: any other count is non-zero. Report the counts, and name the paths behind each state.
- Unread: `stamped` false with no entries, or the domain absent from the array while the target carries installed rules.
- Keep `stale` and `missing`, which a sync repairs, apart from `customized` and `drifted`, which the project wrote and a sync would overwrite

Routes to `canon <domain> sync`, or to `canon sync` for every installed domain at once. Read the `canon-cli` skill before naming either, since a command name says nothing about what it does to a file already there, and a `customized` entry is exactly the file a sync takes back.

## 4. Tooling

Read the `tooling` block off the report first, because the comparison command needs a value it carries. Read `measured` before anything under it, since every count is zero when it is false, an absence of measurement rather than a measured zero.

### The comparison

On a measured report, take `<stack>` from the first name in `chain` and run `canon tooling sync --check <stack>`. Never run it bare.

- Omitting the stack reaches a prompt the non-interactive variable resolves to the catalog's first entry rather than refusing
- That compares the target against a stack it does not use and reports the difference as drift

### Verdicts

Unread splits three ways, so it takes its own table below.

- Current: `measured` true, `chain` naming stacks the toolkit still ships, and `--check` reporting nothing it would change.
- Behind: `--check` naming files it would replace, or `counts.gitignore` carrying missing managed entries.
- Unread: `measured` false. Report it as unmeasured with its cause named rather than as clean.

| Cause                                   | Meaning                                                              |
| --------------------------------------- | -------------------------------------------------------------------- |
| Empty `chain` at a workspace root       | By design, since a chain there would guess at what the packages hold |
| Empty `chain` anywhere else             | No tooling install is recorded                                       |
| `chain` naming stacks no longer shipped | Injecting would write against a retired name                         |

### Routes

Routes to `canon tooling sync <stack>`, or to `canon tooling inject --gitignore <stack>` for ignore entries alone, taking `<stack>` the same way the comparison above does. An unmeasured report names no stack, so it routes to neither.

`canon tooling diff` is the verb this section wants and it does not exist yet. `--check` answers the same question today and stays working as an alias by design, so the retarget when that verb lands is a change of name rather than of behavior.

## 5. Seeds

Read `seeds.entries` off the report. Each entry is `matching`, `stale`, `drifted`, or `missing`, and the set spans `CLAUDE.md`, the `canon/` records, the generated indexes, `.claude/settings.json`, and the hook scripts under `.claude/hooks/`.

- Current: every entry reads `matching`.
- Behind: anything else. Report `stale` and `missing` separately from `drifted`, which means the content matches no version the toolkit ever published, so the project wrote it.
- Unread: `historyUnavailable` set on `seeds`, which leaves every difference unattributed. Say so rather than reporting a file as untouched.

Report a `stale` seed as safe to take whole and a `drifted` one as a hand merge against the toolkit copy, since a sync command would overwrite the project's edits.

A seed entry matching says the file's bytes match the shipped seed. It says nothing about whether the harness those files configure is wired, which is the next domain.

## 6. The Claude harness

No verb reads this domain. Report it `unchecked` on every run, as a row rather than omitted.

What goes unread is whether the target's hooks fire, whether `.claude/settings.json` registers them, which plugin version the target's sessions load, and whether the marketplace cache matches what the toolkit ships.

### Confirm the gap live

Confirm the gap against `canon claude --help` and the help of any subcommand that sounds like an answer, rather than a list held here. A list in this file freezes on the day it was written and reports a gap a later release closed.

- `canon claude skills drift` comes nearest, but it reads the toolkit's own history against a ref, which says what moved upstream rather than what this target holds
- On a run where a verb answers one of the four questions, report the domain checked with what the verb answered

### No file inspection

Reading the domain by file inspection is the alternative and it is refused. Every other section here answers from the verb under test, and a section answering from a hand-rolled read of the same files reaches a verdict nothing else in the report is entitled to make. A hole a reader can see is worth more than a number nobody can trace.

`canon claude plugin-update` is what an operator runs to bring a cache forward. Name it as the action available rather than as a repair for a finding, since no finding was taken.
