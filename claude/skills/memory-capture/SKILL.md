---
name: memory-capture
description: Extracts durable patterns from the current session, routes a domain fact to the context entry that owns it, and writes the residue to `.canon/memory/` as feedback, project, user, or reference files. Use when asked to "capture memory", "capture lessons", "wrap up the session", "end of session memory", or as a step in autoship. Do NOT use to curate existing memory. Use `memory-review` for that.
---

# Memory capture

Scan the current session for patterns worth persisting, send each to the surface that owns it, and leave in `.canon/memory/` only what no surface owns. Pair with `memory-review` for later curation.

A fact about a domain belongs in that domain's context entry, which the three-tier model already loads on demand. Writing it to memory instead puts it in a folder nothing opens. Routing is therefore the point of this skill and the memory file is the fallback.

The filename and its type prefix, the frontmatter, the body shape each type carries, and the lifecycle are fixed by `${CLAUDE_SKILL_DIR}/../../standards/memory.md`. Read it before writing an entry and follow it rather than working the shape from memory.

## Guards

- All `.canon/memory/` reads and writes resolve at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does.
- From a linked worktree the file-editing tools refuse every path below, so each write in this skill goes out through `Bash` as a plain single command. A memory entry holds one fact and this session has read it, so an update rewrites the whole file with a heredoc rather than editing a line inside it.
- If `.canon/memory/` does not exist at the main worktree root, create it, along with an `index.md` carrying `title` and `subtitle` frontmatter. `canon claude init` seeds both, and a project predating that seed has neither. Regeneration errors without the index, so the first write into a bare folder would report a frontmatter failure against a file that is fine.
- If the session produced no user corrections, confirmations, or context disclosures worth persisting, stop: `✅ Nothing worth capturing.`
- Routing edits a tracked file, so it runs only where the caller commits. When the session is in the main worktree, or the caller states it does not commit, skip Step 3 and write every candidate as a memory file. `role-orchestrator` is the caller this covers.

## Step 1: read context

Read in parallel, skipping any that do not exist:

- `${CLAUDE_SKILL_DIR}/../../standards/memory.md`: the filename, frontmatter, body shape, and lifecycle every entry follows
- `CLAUDE.md`: the project's write location and any rule it states over the folder
- `.canon/memory/index.md`: existing index, to avoid duplicates
- `canon/context/index.md`: the domain catalog Step 3 routes against, read under `.claude/` instead in a project the surface move has not reached
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: banned words, punctuation, and formatting applied to memory file bodies
- The `write-human` skill: voice, rhythm, and sentence construction applied to memory file bodies

## Step 2: classify candidates

Scan the session and group candidate patterns as `feedback`, `project`, `user`, or `reference`. What each type holds and what makes one fire are the Types table in `${CLAUDE_SKILL_DIR}/../../standards/memory.md`. Read the table and classify against it rather than against a recollection of the four names.

Scan the whole session rather than its last exchange. A rule the user stated early and you followed since reads as settled and is exactly the one no file records.

## Step 3: route what a context entry owns

Only a **project** candidate is routable. Feedback, user, and reference describe how to work or who to ask rather than how a domain behaves, and no context entry owns them.

For each project candidate, match its subject against `canon/context/index.md`. The test is a named entry, not a judgment about fit: the fact names a surface that already has an entry in the catalog. Route it to that entry.

Fail closed. A project candidate matching no entry stays a memory file, and so does one matching two entries where neither is clearly the owner. The residue is what the folder is for, and a fact filed under the wrong entry is worse than one in memory because a context entry is a surface sessions trust.

Do not edit a context entry here. `docs-fold` owns those edits and folds the routed facts in on its own pass, or two skills write one file at the same step. Write each routed fact to `.canon/tmp/memory-routing/<slug>.md` at the main worktree root instead, appending when the file exists. Name the heading with the entry's own path from `canon/context/index.md`, flat or the nested `index.md`, since that heading is what tells `docs-fold`'s routed-facts fold which file to open. An append is a whole-file operation the shell does directly, so send it as a plain single `Bash` command carrying a heredoc:

A flat domain takes:

```markdown
## canon/context/<domain>.md

<the fact in one or two sentences, stated as a fact about the domain rather than as a session narrative>
```

A domain split into a folder takes its own generated index instead:

```markdown
## canon/context/<domain>/index.md

<the fact in one or two sentences, stated as a fact about the domain rather than as a session narrative>
```

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

The handoff is a file rather than a spoken result so the routed fact survives a compaction between this step and the `docs-fold` pass, and so the standalone caller leaves something behind for a later `/docs-fold` to consume.

## Step 4: dedupe

For each remaining candidate, grep `.canon/memory/` for an existing file on the same topic. If one exists, update it in place rather than create a new file. Read it first and write the whole file back, since the guard above rules out editing a line inside it.

## Step 5: write the residue

Write each remaining candidate to `.canon/memory/<type>-<slug>.md`, following the template and the shape rules in `${CLAUDE_SKILL_DIR}/../../standards/memory.md`. Copy the shape from there rather than from this body, so one edit to the standard moves every entry.

Two of its rules are the ones a capture pass gets wrong under time pressure. State the rule rather than the incident that produced it, since the session ending is the only reader who has the narrative. Write the `title` as the rule itself, never as the filename stem.

Do not edit the index. `.canon/memory/index.md` is generated from sibling frontmatter by a `PostToolUse` hook, the same way the task board's index is, so a hand-appended row is drift the next regeneration discards.

The hook matches `Write|Edit|MultiEdit`, so nothing fires on the shell writes a linked worktree makes. Regenerate the index once after the last write when the entries went out through `Bash`:

```bash
canon indexes regen --no-stage --root <main-root> <main-root>/.canon/memory/index.md
```

Run `canon records validate memory` when the writes are done and fix what it names. It reads the whole pen rather than this session's writes, so treat a finding on a carried entry as one to fix in place rather than as a reason to stop.

## Output

Respond with one line per fact routed, written, or updated:

- `➡️ Routed: <fact subject> → canon/context/<domain>.md` for a flat entry, or `→ canon/context/<domain>/index.md` for a nested one, matching the heading the routing file carries
- `✅ Wrote: .canon/memory/<file> (<type>)`
- `✏️ Updated: .canon/memory/<file> (<type>)`

When anything routed, add a line naming the handoff so the caller knows a `docs-fold` pass is owed:

`→ Routed facts wait at .canon/tmp/memory-routing/<slug>.md. Run /docs-fold to fold them in.`

Omit that line when the caller runs `docs-fold` itself later in its own chain.

When at least one memory file was written or updated, add a closing line so the standalone caller proposes fixes while context is fresh:

`→ Run /memory-review to propose fixes for the pen before the session ends.`

The ship skills run review Propose themselves, so this line is for the standalone `/memory-capture` path.

If nothing was captured, output:

`✅ Nothing worth capturing.`
