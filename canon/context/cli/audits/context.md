---
title: Context audit
description: What the context audit gates and reports, how its folder scope resolves, and which unit answers a required-sections measure
---

# Context audit

## What gates and what reports

One check out of `canon context audit` gates `bun run check` and the rest report. Citation resolution has no false positives and a silent failure mode without it, so it earns a stage. Every other measure is a judgment a reader settles, and a push failing on one of those teaches contributors to route around the stage. Apply the split to any later check: gate on a fact, report a judgment.

The architecture record's length is the second measure to pass that test, and it gates the verb rather than the push, and only where the record states the rule it is held to. `--citations-only` is what the push stage runs and it never measures the record, and the audit-set stage only warns on a finding that is a fact, so the exit reaches a direct run, the seed stage passing `--gate`, and the `canon audits run` verdict. Widening either stage is a policy change about what fails a push, which `src/audits/catalog.ts` cautions against making as a side effect of adding a measure.

`--gate` widens the failing set to required sections, index drift, and a wireframe's States table disagreeing with its evidence folders, and the seed stage is its only caller. What moves a finding across the line is the corpus rather than the measure. A context entry in a live project is edited under time pressure by the people who own it, so a threshold there reports. A seed is authored once and read by every scaffolded project, so the same finding ships outward and gates.

A wireframe carrying a sketch beside evidence that already exists stays advisory under both modes rather than joining that set. It reads a whole entry against whether any state has evidence, not one sketched layout against its own, so a conforming file, a captured default layout beside a sketch of a breakpoint layout nobody has built, can still trip it.

The thresholds that measure distance stay advisory under both corpora, since no corpus makes a judgment into a fact.

The reference-form check reports, which is the stated split applied to one more measure. A cited path resolving or not is a fact and the form a reference is written in is a judgment carrying a measured false-positive rate. What the rule buys is that a reference spelling its path lands inside the gating check, so the judgment is enforced by the fact rather than beside it.

The rule has a writer as well as a check. `context-fold` instructs the path form at its context-refresh step, so a documentation run stops producing the bare names the check reports. Pointing that step at the standard instead puts the rule one file away from where the reference is written, and a reporting check stops no drift on its own.

The gate invokes the CLI as this checkout's own `src/cli.ts`, never as `canon`. A globally installed `canon` resolves to the main checkout no matter which worktree is running, so the gate would measure the wrong tree and pass a branch whose own citations are broken. `cliRunner` in `src/gate/sequencer.ts` is what holds that, so the rule is one function rather than a habit each stage has to keep.

## Folder scope and resolution

The audit's folder scope is a named list rather than the index-plus-entry contract read off disk. `.claude/internal/standards/` satisfied the contract too while its mirror generated it, and auditing it would have measured a generated copy against a rule written for per-domain narrative. `--folder` admits another folder without an edit, which is the escape hatch the contract reading would have given for free.

The named list is also what bounds the citation gate, since `citationPattern` builds its expression from the same names. A `.claude/` folder outside the list is never resolved, so a path into one rots with nothing reporting it. That is how the retired `.claude/standards/` mirror could be deleted with 60-odd live citations still spelling it and no stage going red.

`canon/context/` is the only folder under `.claude/` carrying an `index.md` at all, so the named list stands on the citation-scope reason alone, with no live instance of the over-collection concern it was originally chosen to guard against.

A folder name resolves under `.claude/` first and at the project root second, which is what puts `docs/` in reach of the same engine. A sibling command measuring the same things against a different root would put one behavior in two places. `--folder` stays a name rather than a path, since a path invites `../../elsewhere` and the audit's scope is corpora inside the repository.

The root base is opt-in through `canResolveAtRoot`, which only `--folder` sets. Applying it to the default list too was the first shape, and it audited any target holding a root `context/`, `diagrams/`, or `wireframes/` against a standard that target never adopted, on a bare run naming nothing.

A root folder is measured and stays out of the citation scope, since the pattern spells the `.claude/` prefix. Widening it to a bare `docs/x.md` would match prose referencing nothing. A run with no `.claude/` folder says the check is out of scope, and refuses under `--citations-only`, because a gate exiting clean on a scope it could not build is the failure it exists to catch.

Which measures reach a folder is decided by the tier stating the rule behind them, not by whether a standard claims the folder. Length and the catalog-table scan are judgments about how far a reader travels, depth and bullet weight are stated in `standards/markdown.md` over every markdown file, and all four report wherever the audit is pointed, `docs/` included.

Required sections and provenance narrow to the folder `standards/context.md` claims through `governsContent`, and citation resolution keys on the `.claude/` prefix. No standard claims `docs/` and none needs to, since a folder opting into measurement reads the output without a rule to cite.

The reference-form check narrows inside the governed folder rather than at it, reaching the folders a domain split into and stopping at the flat one above them. A split folder's entries are named for sub-areas of one domain, so a bare name matching one points at it, while the flat folder's entries are named for whole domains and a domain name is a common noun a seed spells the same way. Both measured false positives sat there. The sibling set narrows a second time inside a split folder, so a reference to an entry in a different folder is governed by the rule and never reported, which is the measure reaching less than the rule rather than the rule stopping at a sibling.

A named folder's own `index.md` gates every split beneath it. `resolveFolders` locates a name by testing for `<base>/<name>/index.md` and walks for nested folders only after that, so a tree carrying `canon/context/governance/` and no `canon/context/index.md` contributes nothing. The run refuses only when no other name resolved, so a project holding `.canon/diagrams/` prints a scope line that leaves the whole context subtree out without saying so.

A run where no requested name resolves refuses, whichever list it read. Naming the absent ones is what narrows to a name passed by hand, since a project carrying one of the three default folders is ordinary and warning on the other two every run would train a reader past the scope line.

## Which unit answers a measure

Required sections are the first measure that cannot decide from one entry, so the judgment sits in `missingSections` beside `measureFolders` rather than widening `measureEntry`. Which unit answers is what `nested` on `AuditedFolder` decides.

Four domains here split across a folder and describe one domain between them, so any sibling answers and the finding names the folder. Entries of the folder named under `.claude/` are one domain each and answer for themselves. Rolling every folder up was the first shape, and it let one entry stand in for thirteen domains beside it.

A heading at any level satisfies a required section, since those split domains carry the overview as the `#` title and an `##` under it would repeat the filename. The check reports rather than gates by default, the closer call since a missing section reads as a fact. The standard sanctions omitting `## Layout` from a domain owning no paths, and no measure separates that from an entry that forgot it.

Wireframes owe `## Regions`, `## States`, `## Copy`, and `## Not on this surface`, keyed on the folder name in `REQUIRED_SECTIONS_BY_FOLDER`, and each file answers for itself however deep it sits. The standard keeps one surface per file, so a subfolder such as `canon/wireframes/teach/` groups surfaces the way the named context folder groups domains, and rolling it up would let one conforming surface stand in for its siblings. `## Behavior` is left out because a static surface has nothing to state there. Provenance stays scoped through `governsContent`, since the wireframe standard states no provenance rule, which is why the section lists travel apart from that predicate.

That sanctioned omission is what the `stub: true` frontmatter field answers under `--gate`. A file declaring it is dropped before the check and reported nowhere, and both seed install paths strip the field so no target receives it. The exemption is scoped to this one measure, since a skeleton is exempt from owing sections rather than from being well formed.

Bullet weight and depth left this command for `canon markdown audit`. Both are stated in `standards/markdown.md` over every markdown file, and a check reaching every markdown file has no reason to require a folder that resolves. `standards/context.md` keeps the incident half of the bullet remedy, which needs a decision to keep, so the specialized advice stays here while the measure moved.

## Gotchas

The citation resolver lifts a `canon/context/<name>.md` suffix out of a longer path, so a line naming a seed file under `tooling/base/seeds/canon/context/` fails the gate once the entry it mirrors becomes a folder, even though the seed itself exists and is spelled correctly. The report names only the suffix, so the line reads as a plain broken citation rather than as a seed path whose tail collides with a moved entry. Read the whole cited string before retargeting it, since the fix is to reword the line or mark it rather than to repoint a path that was never wrong.

Naming a split-folder entry after a standard's filename makes the reference-form check report every bare mention of that standard inside the folder as a bare reference to the sibling, since the check matches a bare name against the folder it sits in. Name the entry for its sub-area rather than for the standard it measures, which is why the ban scan's entry is `canon/context/cli/audits/markdown-bans.md`.
