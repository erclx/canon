---
title: Context audit
description: What the context audit gates and reports, how its folder scope resolves, and which unit answers a required-sections measure
---

# Context audit

## Decisions

### What gates and what reports

One check out of `canon context audit` gates `bun run check` and the rest report. Citation resolution has no false positives and a silent failure mode without it, so it earns a stage. Every other measure is a judgment, and a push failing on one teaches contributors to route around the stage.

Gate on a fact and report a judgment, for any later check.

### The requirements record gates the verb

The record's word count is the second measure to pass that test. It gates the verb rather than the push, and only where the record states the rule it is held to.

- `--citations-only` is what the push stage runs, and it never measures the record
- The audit-set stage only warns on a finding that is a fact
- The exit therefore reaches a direct run, the seed stage passing `--gate`, and the `canon audits run` verdict
- Widening either stage is a policy change about what fails a push, which `src/audits/catalog.ts` cautions against making as a side effect

### `--gate` moves findings by corpus

`--gate` widens the failing set to required sections and index drift, and the seed stage is its only caller. The corpus moves a finding across the line, not the measure.

A context entry in a live project is edited under time pressure by its owners, so a threshold there reports. A seed is authored once and read by every scaffolded project, so the same finding ships outward and gates. Thresholds that measure distance stay advisory under both corpora.

### Reference form reports

A cited path resolving is a fact. The form a reference is written in is a judgment carrying a measured false-positive rate, so the check reports and the rule is enforced through the gating citation check, since a reference spelling its path lands inside it.

`context-fold` instructs the path form at its context-refresh step, so a documentation run stops producing the bare names the check reports. Pointing that step at the standard instead puts the rule one file from where the reference is written.

### The gate runs this checkout's CLI

The gate invokes `src/cli.ts` of its own checkout, never `canon`. A globally installed `canon` resolves to the main checkout from any worktree, so the gate would measure the wrong tree and pass a branch whose own citations are broken.

`cliRunner` in `src/gate/sequencer.ts` holds the rule as one function rather than a habit each stage keeps.

### Folder scope is a named list

The audit's folder scope is a named list, not the index-plus-entry contract read off disk. `.claude/internal/standards/` satisfied the contract while its mirror generated it, and auditing it would measure a generated copy against a rule for per-domain narrative.

`--folder` admits another folder without an edit, the escape hatch the contract reading would have given.

### The list bounds the citation gate

`citationPattern` builds its expression from the same names, so a `.claude/` folder outside the list is never resolved and a path into it rots unreported. That is how the retired `.claude/standards/` mirror was deleted with 60-odd live citations still spelling it and no stage going red.

`canon/context/` is the only folder under `.claude/` carrying an `index.md`, so the list stands on the citation-scope reason alone.

### Resolution under `.claude/` then root

A folder name resolves under `.claude/` first and at the project root second, which puts `docs/` in reach of the same engine. A sibling command measuring a different root would put one behavior in two places.

`--folder` stays a name, since a path invites `../../elsewhere` and the scope is corpora inside the repository.

### Root resolution is opt-in

`canResolveAtRoot` is set only by `--folder`. Applying it to the default list was the first shape, and it audited any target holding a root `context/` or `diagrams/` against a standard it never adopted, on a bare run naming nothing.

A root folder is measured and stays out of the citation scope, since the pattern spells the `.claude/` prefix.

- A bare `docs/x.md` would match prose referencing nothing
- A run with no `.claude/` folder says the check is out of scope
- Under `--citations-only` it refuses, since a gate exiting clean on a scope it could not build is the failure it exists to catch

### Which measures reach a folder

The tier stating the rule behind a measure decides, not whether a standard claims the folder.

- Length and the catalog-table scan are judgments about how far a reader travels
- Depth and bullet weight are stated in `claude/skills/markdown-craft/references/markdown.md` over every markdown file
- All four report wherever the audit is pointed, `docs/` included
- Required sections and provenance narrow to the folder `claude/skills/context-fold/references/context.md` claims through `governsContent`
- Citation resolution keys on the `.claude/` prefix

No standard claims `docs/` and none needs to, since a folder opting into measurement reads the output without a rule to cite.

### Reference form narrows inside the folder

The check reaches the folders a domain split into and stops at the flat one above them. A split folder's entries are named for sub-areas of one domain, so a bare name matching one points at it. The flat folder's entries are named for whole domains, common nouns a seed spells the same way, and both measured false positives sat there.

The sibling set narrows again inside a split folder, so a reference to an entry in a different folder is governed by the rule and never reported.

### A folder's index gates its splits

`resolveFolders` locates a name by testing for `<base>/<name>/index.md` and walks for nested folders only after that. A tree carrying `canon/context/governance/` and no `canon/context/index.md` contributes nothing.

The run refuses only when no other name resolved, so a project holding a `.canon/diagrams/` folder an older install left prints a scope line that leaves the context subtree out without saying so.

### No name resolving refuses

A run where no requested name resolves refuses, whichever list it read. Naming the absent ones narrows to a name passed by hand, since a project carrying one of the three default folders is ordinary and warning on the other two every run would train a reader past the scope line.

### Which unit answers a measure

Required sections are the first measure that cannot decide from one entry, so the judgment sits in `missingSections` beside `measureFolders` rather than widening `measureEntry`. `nested` on `AuditedFolder` decides which unit answers.

- Four domains split across a folder and describe one domain between them, so any sibling answers and the finding names the folder
- Entries of the folder named under `.claude/` are one domain each and answer for themselves
- Rolling every folder up was the first shape, and it let one entry stand in for thirteen domains beside it

### Required sections report by default

A heading at any level satisfies a required section, since split domains carry the overview as the `#` title and an `##` under it would repeat the filename.

The check reports by default, the closer call since a missing section reads as a fact. The standard sanctions omitting `## Layout` from a domain owning no paths, and no measure separates that from an entry that forgot it.

### Stubs under `--gate`

The `stub: true` frontmatter field answers that sanctioned omission. A file declaring it is dropped before the check and reported nowhere, and both seed install paths strip the field so no target receives it.

The exemption covers this one measure, since a skeleton is exempt from owing sections rather than from being well formed.

### Weight and depth moved out

Bullet weight and depth left this command for `canon markdown audit`. Both are stated over every markdown file, and a check reaching every markdown file has no reason to require a folder that resolves.

`claude/skills/context-fold/references/context.md` keeps the incident half of the bullet remedy, which needs a decision to keep.

## Gotchas

### A seed path collides with a moved entry

The citation resolver lifts a `canon/context/<name>.md` suffix out of a longer path. A line naming a seed file under `tooling/base/seeds/canon/context/` fails the gate once the entry it mirrors becomes a folder, though the seed exists and is spelled correctly.

The report names only the suffix, so the line reads as a plain broken citation. Read the whole cited string first, and reword or mark the line rather than repoint a path that was never wrong.

### Naming an entry after a standard

An entry named for a standard's filename makes the reference-form check report every bare mention of that standard inside the folder as a bare reference to the sibling. Name the entry for its sub-area, which is why the ban scan's entry is `canon/context/cli/audits/markdown-bans.md`.
