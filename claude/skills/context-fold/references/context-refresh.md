---
title: Refresh context entries
description: How context-fold Step 5 folds diff-scoped rewrites into canon/context entries, when it creates an entry, and the lines it reports
---

# Refresh context entries

Step 5 of `context-fold`, reached in order once `canon/context/index.md` lists at least one entry.

The diff carries what the repository changed, and this step rewrites against it.

When the baseline is unusable, scope this step to the working tree and untracked files, and skip it only when that set is empty, reporting `⚠ No diff to scope against. Skipped the context refresh.`

Reuse the diff from the baseline above, names and content both. For each domain listed in `canon/context/index.md`, read its own entry: a flat `canon/context/<domain>.md`, or, for a domain split into a folder, its `canon/context/<domain>/index.md` and every sibling file that index links. Follow the index rather than globbing the folder, since a folder can hold a file the index does not list yet.

- Map the entry's section headings, whether they sit in one flat file or spread across a nested domain's sibling files, to the changed files. An entry is relevant when its prose references files, modules, or decisions touched by the diff.
- For each relevant entry, rewrite only the sections affected by the diff. Same pattern as `docs-sync`. Do not touch unrelated sections. Never rewrite a split domain's own `index.md` directly, since a regen overwrites it the same way it overwrites the top-level catalog. Rewrite the sibling file the affected section actually lives in instead.
- Rewrite a restated or superseded statement in place rather than appending beside it, the same rule Step 3 applies to the other canonical doc types.
- Write a reference to another entry as the path that entry sits at, rather than as its bare filename. `${CLAUDE_SKILL_DIR}/../../standards/context.md` states the form, and a bare name strands the reference once a domain splits into subfolders.

## When the diff removes a capability

The mapping above is scoped by file, and a removal invalidates claims that mapping cannot reach. Run this only when the diff deletes a command, a flag, a constant, or a folder. Ordinary feature work takes the narrow rule alone, since widening it on every ship churns prose nothing put in doubt.

Grep the tree for the name that went, rather than for the paths the diff carries. A capability removed by name is cited by that name, which reaches a file the diff never touched.

- An entry this run already rewrote is read whole before it is left. A refresh that updates the top and leaves a contradicting claim below reads worse than an untouched entry, because the current opening lends authority to the stale remainder. This is the one case that overrides "do not touch unrelated sections", and it overrides it only inside an entry the run edited anyway.
- A claim comparing two surfaces is checked even where its file is outside the diff. Such a claim holds only while both surfaces do, so moving one inverts it with nobody editing the file it sits in.

Report each hit as an ordinary rewrite.

Create a new entry only for a domain `canon/context/index.md` already lists but carries no file for, following `${CLAUDE_SKILL_DIR}/../../standards/context.md` for its shape. Before treating a domain as carrying no file, confirm it holds no entry under either spelling, `canon/context/<domain>.md` or `canon/context/<domain>/index.md`, since a domain already split into a folder still passes a check that only looked for the flat file. A row in the catalog is the deliberate decision, taken by whoever added it. This step only fills in what that decision left open, and only until the next `canon indexes regen` pass, which rebuilds the catalog from each entry's own frontmatter plus every sibling's and drops a row whose file still does not exist. Create the file before that regen runs, or the row this bar exists to fill in is gone. A domain the catalog does not list at all is a different case: report it and stop, rather than creating an entry or a catalog row for it.

Write each updated entry immediately. Output one line per file, naming the path this run actually wrote rather than always the flat template:

`✅ Context: canon/context/<domain>.md` for a flat entry, or `✅ Context: canon/context/<domain>/<sub-area>.md` for the sibling file a nested edit landed in

The base lint-staged config runs `canon indexes regen` on every committed `*.md`, so `canon/context/index.md` refreshes automatically on commit. No manual step needed.
