---
title: Skill audit
description: Measuring both skill corpora against standards/skill.md, the checks it reads, the requirement gate that is the only failing one, and the drift verb that names bodies rewritten since a ref
---

# Skill audit

`canon claude skills audit [path]` reports both skill corpora against the rules `standards/skill.md` and `standards/skill-requirement.md` state mechanically. It reads and reports. Fixing what it finds is separate work.

```bash
canon claude skills audit
canon claude skills audit --json
canon claude skills audit --requirements-only
```

| Option                | Behavior                                                             |
| --------------------- | -------------------------------------------------------------------- |
| `--json`              | Add a machine-readable record on stdout, keeping the frame           |
| `--requirements-only` | Run the gating presence check alone, printing nothing when it passes |

## Corpus scope

Both trees are measured. `claude/skills/` installs into a target and `.claude/skills/` stays in the toolkit, the standard governs each, so a run reading one reports a pass over half its subject. A tree the project does not carry is skipped, which puts a target holding `.claude/skills/` alone in scope. A run where neither resolves refuses, since a clean exit over nothing measured is the outcome the command exists to prevent.

The audit reads the directory it is pointed at, defaulting to the cwd. `canon claude skills list` resolves the shipped corpus from its own install root instead, so a dev-linked binary reports `main` no matter which worktree runs it. Auditing a branch needs the cwd reading, which is why the two commands resolve their root differently.

## What it measures

Each check traces to a line in the standard.

- `REQUIREMENT.md` present in every skill folder
- Frontmatter `name` matching the folder name
- Frontmatter `description` present
- `description` under 1024 characters
- No `README.md` inside a skill folder
- Folder name in kebab-case
- Each `REQUIREMENT.md` declaring `Gap` and `Must`, matched at any heading level
- No ISO date in `SKILL.md` or any file under `references/`, reported as `datedProvenance` in the JSON record's `findings`

A body whose frontmatter does not parse reports as declaring neither field rather than ending the run, so one malformed file cannot hide the corpus behind it. A key present with an empty value reads as absent, since a blank `name` would otherwise report as a name disagreeing with every folder. A folder carrying no requirement is reported once under presence rather than counted again for the sections it therefore lacks.

The date check reads prose alone. A date inside a fence or a code span is example data, such as a sample frontmatter block, and a date in the body's own frontmatter is metadata, so neither reports. `REQUIREMENT.md` and `EVAL.md` are not read, since the requirement's `Gap` is where the standard sends the incident and the date that earned a rule.

Each finding names the file and the line, such as `claude/skills/<name>/references/<file>.md  line 12: <date>`. A date after "measured" or "verified" reports like any other, unlike the context audit, because a skill body states the rule a session follows today rather than a reading of the tree.

## What it leaves alone

The report names its own blind spots on every run, including the run where everything passed. Whether each `Must` traces to a stated gap is the rule in the requirement standard worth the most and no parser reads it. Whether a gap states an observed failure rather than an intent, and whether a description routes, are the same kind of judgment. The 150-line body checkpoint is the one mechanical rule still absent here, and adding it would print a count rather than a defect, since the standard makes it a prompt to look with nothing enforcing it.

The date check reads ISO dates alone. A date written in words, a month with no day, and provenance carrying no date at all pass it.

A check with no rule behind it prints an opinion as a defect, which is where the list stops.

## Exit codes

Exit codes are `0` for a clean run, `1` for a refusal, and `2` for a skill folder carrying no `REQUIREMENT.md`. Only presence sets a failing code. Name, description, folder, requirement-section, and dated-provenance findings print and return `0`, because each is a judgment a reader settles and failing a push on one would make the check something to route around.

## The requirement gate

`--requirements-only` is the half wired into `bun run check`. Presence of a required file is a fact with no false positives, and the rule had nothing reading it, so a skill shipped without the sibling passed every stage while the standard required it.

The check is preventive rather than diagnostic. Every mechanical rule passed across both corpora the day it shipped, so what it buys is the regression it stops rather than a backlog it surfaces.

## Drift since a ref

`canon claude skills drift <ref>` names the shipped skill bodies rewritten between that commit and the current `HEAD`.

```bash
canon claude skills drift HEAD~20
canon claude skills drift 02d7b265 --json # canon-allow-reference: a copyable command takes a literal git ref, which no qualified form is
```

| Option   | Behavior                                                   |
| -------- | ---------------------------------------------------------- |
| `--json` | Add a machine-readable record on stdout, keeping the frame |

A skill body enters a session once and stays. Re-invoking the skill does not re-read the file, so an edit made this session is not picked up and nothing compares the two. A session that outlives a merge touching a body it loaded keeps applying what it loaded, and a compaction carries the held copy forward with the summary it writes, which makes that exposure the age of the oldest load rather than the age of the session.

Age is one route and not the only one. A session that edits a body and then invokes that same skill later in the same run replays the pre-edit text, which is what a ship chain does whenever a branch touches a body the chain runs at the end. This verb does not reach that route, because it reads history and the edit is still uncommitted when the replay happens. Re-read a body after editing it, and do not wait for a report to name it.

Which shape the staleness takes decides whether anyone notices. A held body naming a file the branch deleted fails loudly by having nothing to read. One naming a file that still exists while saying something different resolves and reads current, so the session applies the stale rule and reports success.

The ref is required and carries no default. `HEAD` is the only value the command could supply for itself, and it answers every run with nothing moved, which is the silence this verb exists to break. A session passes the commit it started from.

Nothing on the machine records that commit, so a session recovers it from its own elapsed run time with `git log -1 --format=%H --before='<duration> ago'` and rounds the duration up. Over-reporting costs one read of a body while under-reporting costs the answer, so the generous end of the estimate is the correct one and no session needs to pin the exact commit.

### What drift reads

Bodies alone, one `SKILL.md` per folder, across `claude/skills/` and not the internal tree. A reference or a requirement beside the body is read by whoever opens it and holds no copy that outlives the read, and the internal corpus never loads into a target session at all.

The report names the newest commit that rewrote each body rather than the first, so a body rewritten twice in the range points at the version on disk now.

### What drift cannot answer

The report says a file moved, not that a session holds a stale copy. A session cannot read its own loaded body as bytes, so the comparison runs against history and a ref older than the oldest load over-reports. That is the safe direction, since confirming a name costs one read of the body while the failure being answered is silence. Every run states the bound, including the run that names nothing.

The verb answers only when someone runs it, and a report read is not a report acted on. A session that sees a moved body in the result and does not re-read that body stands where it started. One session reached that outcome after running the verb at session start, then followed the held copy for the rest of the day.

Two cases fall outside the range. An uncommitted edit in the working tree is not history yet, so a body changed and left unstaged reports as unmoved. A target project loads the plugin from a marketplace cache with no repository behind it, where the verb refuses and names the absent history rather than reporting a clean tree.

Exit codes are `0` when history was read, whether or not a body moved, and `1` when the question could not be answered. An absent shipped corpus, an absent repository, and a ref matching no commit each refuse with their own reason on stderr. A command exiting zero on a question it never answered is the failure `canon/ARCHITECTURE.md` already records against two skills, which is why no path here reports an empty result in place of a refusal.
