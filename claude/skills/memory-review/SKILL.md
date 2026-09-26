---
name: memory-review
description: Reviews `.canon/memory/` and proposes per-entry actions (promote to an always-loaded rule, move into a skill body, route to a context entry, hand off to governance, or retire as stale). Also runs the discuss, challenge, apply, and cleanup phases on an existing review file. Use when asked to "review memory", "discuss memory questions", "challenge the promotes", "apply memory decisions", "cleanup memory review", "promote memory", or "consolidate memories". Do NOT auto-apply. Output a grouped proposal and wait for block-by-block approval.
---

# Memory review

This skill drives the full memory review lifecycle in five phases. Pick the phase from what the user said and whether a review receipt already exists at `<main-root>/.canon/memory/review/memory-review-*.md`.

What an entry looks like and why a retired one is moved rather than deleted are fixed by `${CLAUDE_SKILL_DIR}/../../standards/memory.md`. Read it before rewriting an entry, since a promotion rewrites the rule and a rewrite has to leave the entry conforming.

| User intent                                                            | Phase     | Mutates                      |
| ---------------------------------------------------------------------- | --------- | ---------------------------- |
| "review memory", "promote memory", "sweep stale memories" (no receipt) | Propose   | review file only             |
| "challenge the promotes" (receipt exists)                              | Challenge | review file only             |
| "discuss", "respond to questions"                                      | Discuss   | review file only             |
| "apply decisions", "commit", "ship the review"                         | Apply     | tracked files + memory files |
| "cleanup", "delete the receipt"                                        | Cleanup   | one receipt + its skips      |

If the user re-pings the skill with no new phrase and a receipt exists, default to Discuss when any `Decision:` contains `?`, otherwise Apply.

## Guards

- All `.canon/memory/` reads, edits, and archive moves resolve at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does.
- If no `.canon/memory/` directory exists at the main worktree root, stop: `❌ No .canon/memory/ directory found.`
- If `.canon/memory/` contains no top-level `*.md` entries other than `index.md`, stop: `✅ No memory entries to review.` The pen holds two subfolders now, `review/` and `archive/`, and neither is a memory entry, so this count and every entry read below stay at the top level and never recurse into either.
- Cleanup is exempt from the two stops above. It works on receipts in `.canon/review/`, and a drained pen is the normal state once Apply has run, so a pen-shaped stop would strand the receipt it exists to delete.
- Resolve the main root via `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd`. All review and memory reads anchor here.
- Every main-root write below goes out as a heredoc, routed the way `session-worktree` states. The receipt and a memory entry are both short and this session has read them whole, so a rewrite replaces the file with a heredoc rather than editing a line inside it. Promotion targets are tracked files at `pwd` and keep taking `Edit`.

## Propose phase

Propose is the entry point for a standalone run. The ship skills stop at capture and never invoke it.

### Scope

- **Batch:** run `canon records stale memory --json` and take the first 25 entries whose `due` is true, in the order the record lists them. When fewer than 25 are due, take all of them and say so. Never pad a batch with an entry that is not due.
- **Named set:** when the user names entries, a list, or a slug, that set is the scope and overrides the verb's order. Propose nothing outside it.

A whole pen does not fit one pass. Every entry plus every promotion target reads as several hundred thousand tokens on a grown project, so a full sweep fails before it classifies anything. The batch is bounded by the receipt the operator approves, which stays short enough for one pass at 25 items.

Branch on the record rather than on the exit, which a shell function wrapping `canon` can flatten to zero. When the installed binary carries no `records stale` subcommand, or the record comes back with `ok: false`, stop: `❌ canon records stale is missing or refused. Update the canon CLI, since a review without it falls back to a full sweep that cannot run.` Never fall back to reading the whole pen.

### Step 1: read the memory folder

Read in parallel from the project root:

- `.canon/memory/index.md`: the generated index, which is what lets a batch entry find a duplicate outside the batch
- each entry in the batch, by name, never its `review/` or `archive/` subfolders: individual entries with frontmatter (`title`, `description`, `category`, and `reviewed` when a past pass kept it)

### Step 2: search promotion targets per entry

Do not read every target up front. For each entry in the batch, grep the target set below for the entry's subject, taking two or three keywords from its title and rule, and read the files that hit. Read `canon/context/index.md` once for the **Promote to a context entry** route. Skip any file or folder that does not exist.

- `CLAUDE.md`: project behavior rules and Content ownership section, still a read target for the absorbed-already check even though it takes no new promotion
- every `SKILL.md` under `.claude/skills/`: domain-scoped internal skill bodies
- every `SKILL.md` under `claude/skills/`: plugin skill bodies
- every `*.md` under `${CLAUDE_SKILL_DIR}/../../standards/`: authoring references
- every `*.md` under `governance/rules/` in the toolkit repo, or `.claude/rules/` in a target project: coding-standards rules
- every `*.md` under `internal/rules/` in the toolkit repo, or `.claude/rules/project/` in a target project: always-loaded rules a promote lands in

A target the grep missed turns a promote into a retire, and only the operator's pass catches that. Name the targets each item searched in its receipt entry so the miss is visible there.

### Step 3: classify each entry

`.canon/memory/` is a holding pen. Default every entry to promote or retire on review. Keep is the exception, reserved for an entry still true that no surface owns, such as active task overlap or a user-type memory with no in-repo target.

An entry's `unresolved` list in the stale record names paths it cites that the tree no longer holds. Weigh it as evidence for **Retire**, or for a rewrite when the rule survives the move, and never read it as the verdict alone. A rule can outlive the file it happened to name.

`memory-capture` routes a project fact naming a domain with a context entry to that entry, so a pen filled since routing shipped is mostly feedback: rules about how to work, which no context entry owns. Propose against what the pen holds rather than expecting the older mix. An entry carried from before routing may still name a domain that has a context entry, and that entry's action is **Promote to a context entry**, which hands it to `context-fold` the same way capture does rather than editing the entry here.

For each in-scope entry (see Scope), pick one action:

- **Promote to an always-loaded rule**: the rule is cross-domain behavior or a design principle applied across the whole project, passing `592-claude-md.md`'s test (applies every session regardless of what is being edited). Do not author a toolkit rule file inline.
  - In the toolkit repo, hand off to `internal-governance` and `${CLAUDE_SKILL_DIR}/../../standards/rule.md`, which own `internal/rules/core/` (this repo only, never ships) and `governance/rules/core/` (ships to every target).
  - In a target project, append the rule to an existing file under `.claude/rules/project/` with `Edit`, since a project rule is project-owned and sync never overwrites it, or hand off to the `create-rule` skill when no existing file fits.
- **Promote to a skill body**: the rule fires only when editing a specific path-scoped domain. Name the target skill.
- **Promote to a standards file**: the rule is an authoring reference that belongs in the project's own standards folder as `<domain>.md`.
- **Promote to a context entry**: the entry states a fact about a domain carrying an entry in `canon/context/index.md`. Append it to `.canon/tmp/handoff/memory-routing/<slug>.md` at the main worktree root, in the format `memory-capture` writes, and tell the user to run `/context-fold` from a branch. Do not edit the context entry here. A project-identity or command fact takes this action when a context entry owns the subject, such as a development entry for commands, and **Retire** otherwise, naming a hand edit to `CLAUDE.md` as the reason. Memory review does not write the root file itself.
- **Hand off to governance**: the rule is coding-standards class (typescript, testing, naming, error-handling, performance, logging, concurrency, planning), never a cross-domain behavior rule. Do not author the rule file inline. Never edit the synced `.claude/rules/` copies of toolkit rules, because `canon gov sync` overwrites them. Stop at handoff. This and **Promote to an always-loaded rule** never both claim one entry: class names the topic (coding-standards routes here), firing axis names the rest (applies-every-session routes to the rule promote).
  - In the toolkit repo, point the user at `internal-governance` and `${CLAUDE_SKILL_DIR}/../../standards/rule.md`, which own the source-of-truth rules under `governance/rules/`.
  - In a target project, point the user at the `create-rule` skill, which scaffolds a project-local rule under `.claude/rules/`.
- **Retire**: the rule is stale, already absorbed into a durable surface, too vague to phrase as a rule, or a one-time incident narrative. Apply moves the file to `.canon/memory/archive/` rather than deleting it.
- **Keep**: the rule is still true and no durable surface owns it. The entry stays in the pen, and Apply stamps `reviewed` so the verb does not queue it again until the window lapses.

Retire is an archive, not a deletion, which `${CLAUDE_SKILL_DIR}/../../standards/memory.md` states as the rule and this skill executes. The archive is worth less than a plan's, since a promoted entry survives in its destination and a stale one is discarded on purpose, which is why the move is cheap rather than free.

When two or more memories collapse into one rule on the same target, propose them as a single merged edit under the matching promote category. The consolidate case is a variant of promote, not a separate action.

#### Absorbed-already check

Before proposing promote, grep the target surface for the rule's keywords. If the rule is already stated there, the action is **Retire**, not promote. Do not rely on memory-file claims that a rule is documented elsewhere. Verify.

The check covers implication, not only keyword match. If an adjacent bullet in the target section already implies the rule, merge into that bullet rather than append a second.

#### Crispness check

Rules that resist crisp one-line phrasing default to **Retire** over promote. Never promote a memory unchanged. Rewrite to match the destination surface's tone. Use single-directive rule-bullet phrasing for an always-loaded rule and imperative phrasing for skill bodies.

### Step 4: write the proposal to the review file

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

Write the full proposal to `.canon/memory/review/memory-review-<slug>.md` at the main worktree root. Do not print it inline. Read `${CLAUDE_SKILL_DIR}/references/receipt-format.md` for the file structure, the item template, and how each action type varies the body. The four later phases rewrite items inside an existing receipt rather than authoring one, so none of them opens it.

A phase changing items reads the receipt, applies every change for that phase, and writes the whole file back in one command. Batching is what keeps a per-item rewrite from costing a full read each time, and it is the only route from a linked worktree, where the guard above rules out editing a line in place.

Tell the user `✅ Wrote proposal to .canon/memory/review/memory-review-<slug>.md`. Ask them to fill in `Decision:` per item, then re-ping with "discuss" for question rounds or "apply" to commit.

Rewrite the review file in place whenever the proposal changes mid-review. The file stays the source of truth for the current decisions.

## Challenge, Discuss, Apply, and Cleanup phases

Each later phase runs on its own invocation against a receipt Propose already wrote, picked by the table above. Read `${CLAUDE_SKILL_DIR}/references/later-phases.md` on reaching any of them, for the phase's trigger, what it may mutate, its procedure, and the line it ends on. Challenge and Discuss rewrite the review file only, Apply stops on the main worktree, and Cleanup removes one receipt.

## After completion

Output one line per action taken in the most recent phase:

- `✅ Promoted: .canon/memory/<memory-file> → <target>`
- `✅ Handed off: .canon/memory/<memory-file> → governance`
- `📦 Retired: .canon/memory/<memory-file> → .canon/memory/archive/`
- `🗑  Swept: .canon/review/<review-file>, folded <n> skips`
- `📌 Kept: .canon/memory/<memory-file>, reviewed <date>`
- `⏭ Kept: .canon/review/<review-file>, <n> items pending`

If the user accepted nothing, output: `✅ No changes applied.`
