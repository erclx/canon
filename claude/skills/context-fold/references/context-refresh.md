---
title: Refresh context entries
description: How context-fold Step 3 folds diff-scoped rewrites into canon/context entries, when it creates an entry, and the lines it reports
---

# Refresh context entries

Step 3 of `context-fold`, reached in order once `canon/context/index.md` lists at least one entry. The diff carries what the repository changed, and this step rewrites against it.

When the baseline is unusable, scope this step to the working tree and untracked files, and skip it only when that set is empty, reporting `⚠ No diff to scope against. Skipped the context refresh.`

## Reading each entry

Reuse the diff from the baseline above, names and content both. For each domain listed in `canon/context/index.md`, read its own entry, following the index rather than globbing the folder, since a folder can hold a file the index does not list yet.

- A flat domain reads `canon/context/<domain>.md`
- A domain split into a folder reads its `canon/context/<domain>/index.md` and every sibling file that index links

### What to rewrite

An entry is relevant only when the diff touches what it states, and the rewrite stays inside the part the trigger names.

- Treat an entry as relevant only when the diff adds, moves, or removes a folder its Layout lists, makes a folder's bullet untrue, or changes a trap it names
- For each relevant entry, rewrite only the H3 or the gotcha the trigger names, and leave unrelated sections alone
- Never rewrite a split domain's own `index.md`, which a regen overwrites, and rewrite the sibling file the section lives in instead
- Edit the bullet that went untrue in place and never append one beside it, the same rule the body states.
- Write a reference to another entry as the path that entry sits at, per `${CLAUDE_SKILL_DIR}/references/context.md`, since a bare filename strands it once a domain splits into subfolders

## When the diff removes a capability

The mapping above is scoped by file, and a removal invalidates claims that mapping cannot reach. Run this only when the diff deletes a command, a flag, a constant, or a folder. Ordinary feature work takes the narrow rule alone, since widening it on every ship churns prose nothing put in doubt.

Grep the tree for the name that went, rather than for the paths the diff carries. A capability removed by name is cited by that name, which reaches a file the diff never touched.

- Read an entry this run rewrote whole before leaving it. An updated top over a contradicting claim below reads worse than an untouched entry, since the opening lends authority to the stale rest.
- That is the one case overriding "do not touch unrelated sections", and only inside an entry the run edited anyway
- Check a claim comparing two surfaces even where its file is outside the diff. It holds only while both surfaces do, so moving one inverts it with nobody editing its file.

Report each hit as an ordinary rewrite.

## Creating an entry

Create a new entry only for a domain `canon/context/index.md` already lists but carries no file for, following `${CLAUDE_SKILL_DIR}/references/context.md` for its shape. A row in the catalog is the deliberate decision, taken by whoever added it, and this step only fills in what that decision left open.

- Confirm the domain holds no entry under either spelling, `canon/context/<domain>.md` or `canon/context/<domain>/index.md`, since a split domain passes a check for the flat file alone
- The next `canon indexes regen` rebuilds the catalog from each entry's frontmatter plus every sibling's, dropping a row whose file does not exist. Create the file before it runs.
- A domain the catalog does not list at all is a different case. Report it and stop, rather than creating an entry or a catalog row for it.

## Writing and reporting

Write each updated entry immediately. Output one line per file, naming the path this run actually wrote rather than always the flat template:

- `✅ Context: canon/context/<domain>.md` for a flat entry
- `✅ Context: canon/context/<domain>/<sub-area>.md` for the sibling file a nested edit landed in

The base lint-staged config runs `canon indexes regen` on every committed `*.md`, so `canon/context/index.md` refreshes automatically on commit. No manual step needed.
