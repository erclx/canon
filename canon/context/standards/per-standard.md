---
title: Per-standard decisions
description: What the plan standard fixes and why its sections are mixed, the inverted answer contracts, where an execution-time deviation is recorded, how a constraint declares its expiry, the memory standard, what the memory pen measured, the widened readiness test, the architecture record's verification anchor, the cross-reference form split by destination, the wireframe standard's transcription carve-out, its copy rule narrowing to structural text, and why the wiki standard got a reader rather than the move its reader count implied
---

# Per-standard decisions

Six standards in the corpus cost more reasoning than their shape rules show.

- The plan and memory standards were both drafted against a live folder holding two or three files, so the plan standard shipped a rule the whole corpus failed and the memory standard was measured against the pen instead
- The plan standard costs a second time for an unrelated reason, two rules under separate headings that read as pointing opposite ways
- The plan standard costs a third time for its constraint block, which is measured against a tree that has moved by the time a worker reads it
- The tasks standard carries a readiness test that has to admit a row no fact on disk can confirm
- The architecture standard borrows a marker from a sibling surface that has two writers and gets none of its own
- The publish standard splits one rule by destination, so the same reference takes opposite spellings on either side of the remote and no check can reach the half that goes wrong
- The wiki standard was cited by nothing, which made every page conforming by memory rather than by a read, and the fix is a reader rather than the move the ownership test would otherwise have taken

What each one settled belongs here rather than in the file itself, which states the rule and not the count behind it.

## The plan standard

`standards/plan.md` fixes the section list, the suggested-and-answer contract, and the lifecycle from `.canon/plans/` to `.canon/plans/archive/`. `plan-feature` defined that shape inside its own body and two more skills consumed it, which is past the second-case bar, so the body now cites the standard and `auto-ship` and `docs-fold` each point at the half they read.

The section markers are mixed on purpose, `## Summary` as a heading and the other four as bold labels, because that is what the corpus writes. Across the plan archive, `Summary` is nearly always a heading and never a label, while `Files to touch` and the other three sections mostly take the bold-label form.

Measure a format claim against the archive rather than the live folder, since the live folder typically holds only a handful of files and says nothing about the corpus convention.

The check accepts either spelling for a section and names the table's form in the finding. A plan carrying `## Risks` has stated its risks, so failing it teaches a reader to skip the output on the rule they are least served by, which is the same failure as a gate whose findings are all whitelisted.

## The plan answer contract

The plan and intake answer contracts invert each other and both files state the inversion, which is the both-sides rule applied to a contract rather than to a scope entry.

A blank `- Answer:` accepts the suggestion because a plan is written and read in one sitting with every question already surfaced, while an empty `You:` means unread because an intake folder is read over weeks and silence there is far more likely to be absence than assent.

The operator-call line's separator varies in the corpus and the standard fixes only one of the two. `standards/plan.md` writes `- Suggested: needs your call, <why>` with a comma, though the corpus also writes it with a full stop, so a reader parsing the phrase strips both rather than the comma alone. `reasonOf` in `src/tasks/answers.ts` is that reader.

Reading the phrase also means reading the `Questions` section rather than the file. A plan discussing the operator-call form in its own `Risks` can carry the exact phrase in backticks, so a whole-file match would read that plan as waiting on its own author. `splitPlanSections` holds the read to the section, which is the split `checkQuestionContract` already runs, leaving one definition of a question for both readers.

`558-plan` routes `.canon/plans/**` and joins `base`, following `556-groundwork` and `557-intake`. That one glob covers the archive as well, since a shipped plan moves into `.canon/plans/archive/` rather than to a folder of its own. It carries the three directives that ship silently when violated, a filled answer slot, a deleted plan, and a deviation from a suggestion recorded off the plan, and points at the standard for the rest.

## The branch standard's description cap

The cap reads 2 words as the target with 4 as the ceiling, wide enough that a branch derived from a plan filename is not renamed at ship. A rename there is a third derivation on top of the two `canon tasks plan-branch` exists to collapse, and it parts the branch slug from the plan slug that `session-worktree` tier 1 and `git-pr`'s fallback plan lookup both read back to find the plan.

The operator took it as a three-way call. Tightening `standards/plan.md` to three-word slugs was the second option, and it moves the same problem onto roughly a sixth of existing plans, most of them at four words. Changing neither and letting the verb flag a non-conforming description was the third, which leaves `git-branch` renaming a conforming slug anyway.

What it costs is that nothing can tell a plan-derived name from a hand-picked one, so the wider ceiling holds for every branch in every target that installed the standard rather than for the case it was widened against. The standard says that plainly rather than scoping the sentence to a case no tool can detect.

## Where an execution-time deviation goes

An executing session that reads the tree and picks other than the suggestion once had two rules pointing opposite ways. `standards/plan.md` bars filling the answer slot and requires amending the plan in place when a decision changes, and `558-plan` carries the pair under separate headings, so the prohibition read as covering the whole question block.

The route settled as a clarification rather than a new state. Amending the `- Suggested:` line was already permitted and already preserves the blank slot, so the gap was reach rather than permission, and the contract now says the prohibition covers the answer line alone.

The route reaches an unanswered question alone. A deviation from a filled slot goes back to whoever filled it, because a suggestion rewritten under an answer leaves the plan holding two picks with no default resolving them, which is the failure the blank slot exists to prevent arriving through the fix for it.

A fourth marker on the question block was the alternative it beat. The block already carries a suggestion, an answer slot, and a blank-means-accept default, and a template growing a line per edge case stops being read. The rewritten line opens with the fixed phrase `overridden at execution to <pick>,` instead, which names the source on a line already being rewritten and adds no marker.

A trailing measurement was the first candidate for that tell, and it does not discriminate: a plan's author routinely writes a number into their own `- Suggested:` line, so a reader meeting a measurement learns nothing about who put it there and the archived plan still reads as though its suggestion held. A tell that fires on a large share of the authored corpus is the same outcome as no tell, which is what the fixed phrase closes.

The deviation also takes one line in the open task's `## Findings`, because the plan is archived at ship and the task is what the board still points at. Naming the plan alone puts the record in a file nobody opens after the fact. The two registers hold different halves, the plan carrying why the pick moved and the task carrying what shipped. `standards/tasks.md` names the finding class from its own side, since a handoff written on one side of a boundary is never checked against the standard on the other, which is the both-sides rule the answer-contract inversion above already follows.

## When a plan constraint expires

A constraint block names the file set of every track in flight, and a plan sits in the ready queue until a worker picks it up. A constraint can be dead on arrival: written during a refill while a wave is still building, which is the moment the sweep says to plan forward, so the constraint is correct when written and stale by the time a worker reads it, once the wave it named has already merged.

The block opens with a stamp bullet reading Measured against `<commit>` on <YYYY-MM-DD>, and the standard says a worker re-tests before honoring it. A fetch paired with a log from the stamp to `origin/main`, scoped to the paths the constraint names, answers the test in one command, which is the bar the stamp had to clear, since a stamp a reader cannot act on costs a line per plan and saves nothing.

Two halves of that command carry the weight. The pathspec makes the read decisive, because a squashed merge carries a pull request number in its subject and the constraint names its track by work and file set. The fetch keeps the test honest, because a remote-tracking ref left behind reports fewer merges than have landed and hands back the dead-reads-as-live answer the stamp exists to remove. `task-board` already pairs a fetch with a log in one command for the same reason.

One stamp covers the block however many tracks the constraints below it name, since a plan is written against the tree once. The stamp takes its own leading bullet rather than fusing to the first constraint, which is what leaves a two-track block with no question about which constraint the commit applies to.

A date alone was the cheaper stamp and does not discriminate, since two constraints written on the same day can sit on opposite sides of a merge, leaving a reader comparing dates unable to tell which side of a wave a constraint was measured on.

Naming the tracks in the stamp beside the commit was the other candidate. The block already names each track by its work and its file set, so a second list of names is a second place to keep in step for a reader who has the first one directly above.

An unstamped constraint reads as unverified rather than as live, which is what covers the plans already in the queue. Restamping them is a sweep over files a worker may already hold, and confirming one without a stamp costs that worker the open pull request list, since the log has no commit to anchor against.

The rule sits in `standards/plan.md` with `role-orchestrator` naming the stamp alone, because a worker running the planning skill in its own branch writes constraints too. Stating the obligation in both bodies puts one behavior in two places that ship on different cadences, and stating it only in the orchestrator covers one of the two plan authors.

No check parses the block. Nothing reads a plan's constraints today, and a validator over prose is a larger question than the line this answers, so the rule holds by being read.

## The memory standard

`standards/memory.md` fixes the filename and its type prefix, the frontmatter, the body shape each type carries, links between entries, and the lifecycle.

`CLAUDE.md` keeps two bullets rather than pointing at the standard for everything: the write location, because `.canon/memory/` rather than `~/.claude/projects/` is project policy, and the routing rule, because it has to fire before an entry is written at all rather than once the standard is opened.

The delete prohibition stays in `CLAUDE.md` while the rest of the rule lives in the standard. A path-scoped rule fires when a session edits a file the glob matches, and a bulk retire runs through the shell as a `mv`, so `559-memory.md` is never loaded at the moment the irreversible act happens.

The tier test in `canon/context/context-model.md` asks whether a rule fires on a path being edited, and this is the case where the answer is no because the violating action is not an edit at all.

The rule sits in both tiers on purpose: the always-loaded copy is what reaches the shell path, and the rule copy is the reminder a session gets while editing an entry.

## The tasks readiness test

`standards/tasks.md` admits a row to `## Up next` on a written plan plus a stated reason the task cannot start, and that group's `Waiting on` cell carries a collision, a sibling task, or an external condition. `## Needs a plan` heads a column by the same name, so the three forms are stated under the group they govern rather than under the header they share. A test naming only the first two leaves a planned task waiting on a condition outside the board passing neither it nor the `## Needs a plan` test below it, so such a row sits in a group whose stated rule does not admit it.

A fourth heading is the obvious alternative and the standard bans one, because a board grouped under names of its own reads as empty to anything counting rows under a heading. Widening a test costs one clause and keeps the three headings every reader already parses.

The three tests are read in order, so widening `## Up next` alone leaves its new kind unreachable. A `## Run now` test whose second half names only a file collision admits a task blocked on an external condition, since such a task collides with nothing running, and the ordered read hands it to a worker before `## Up next` is ever consulted. Both tests therefore turn on the same clause, that the task carries no reason it cannot start, with the collision kept named under `## Run now` so the `Touches` column and the validator's collision check keep their basis.

The external kind names what would satisfy the condition rather than the condition alone. Without that clause the kind admits any excuse, including a row nobody has looked at, which collapses the group into a holding pen for whatever is stalled.

The `## Needs a plan` cell has a second half and it takes the same treatment one paragraph later than the three forms above did. The standard already said the cell states why the row sits where it does, and the clause drifted into stating why the row matters, which is an excuse of the shape the paragraph above rejects: it admits every row at once, so position recorded when each was filed and nobody chose the order. Naming the row or the class it is ranked against is what a comparison costs, and it is the same clause rather than a third one. `canon tasks validate` reads it back, and the mechanism behind that read sits at [canon/context/cli/audits.md](../cli/audits.md) rather than here.

`canon tasks validate` resolves the `Task`, `Plan`, and `Touches` columns by header text and never reads the `Waiting on` cell, so the widened test holds on reading alone and the standard says so. A non-empty check is the alternative and every row already passes it, which buys a check that has never once fired. Every finding the validator does report compares a written claim against the tree, and an external condition puts no fact there to disagree with, unlike a plan pointer that resolves or two file sets that intersect.

## What the memory pen measured

The shape rules are measured against the pen rather than drafted from the three sources, which is the lesson `plan.md` paid for. Every body opens with a prose rule line, no marker is ever indented, and `**Why:**` and `**How to apply:**` co-occur in every rule-bearing entry, and the entries carrying neither are exactly the `reference` and `user` types.

Blank lines between the three parts vary across the pen, so the standard states the three parts as the contract and stays silent on the separator. Requiring one spelling would report a large share of the corpus on the rule readers are least served by.

`category` is compared against the sentence-case form of the filename prefix rather than checked field by field. One comparison catches a prefix outside the four types, a field disagreeing with the prefix, and a casing drift that would open a second group in the generated catalog, and it reports one finding where three separate rules would report the same defect three times.

No dangling-link check ships. A `[[name]]` link that resolves to nothing usually names an entry not yet written rather than a retired one, which the format treats as a marker worth keeping, and a handful of apparent dangles are backticked TOML `[[table]]` syntax, so a check would have had to exclude code spans to report a class that is legitimate anyway.

The two classes the verb catches against a real pen are an entry titled with its own filename stem, which renders a slug in the catalog where the rule belongs, and a filename prefix belonging to none of the four types. The live pen reads clean of both.

## The architecture record's verification anchor

`standards/architecture.md` takes the verification marker the diagram standard already carries, in a different form and on a narrower scope. A diagram entry is one file per kind and keys its marker in frontmatter. The architecture record is one file holding many decisions and carries no frontmatter at all, so a file-level key would date the newest edit and say nothing about the rest. The anchor is therefore a trailing sentence on the decision entry, the only granularity the record's own diagram-folder reasoning permits.

Scope is forward. A decision already in the record when the rule shipped stays unanchored, because dating it by blame is archaeology for a marker nothing reads back. What that costs is a period where an unanchored entry means unchecked and never-anchored at once, which the standard resolves by turning the reading on whether the entry cites a number rather than on when it was written.

The rule reaches only a decision citing a measured number. The record's entries carry counts such as 486 occurrences across roughly 150 committed files, and those go stale while the reasoning around them stays correct. Requiring the anchor everywhere prices the cheap case at the expensive one, and an entry whose reasoning stands on its own has nothing to check.

A third class was drafted and cut, covering a decision that cites no number while resting on a state of the tree that can change. It gave the writing rule a case the reading rule could not express, since an unanchored entry in that class reads as needing nothing while the writing rule asked for a marker. Keying on the number alone is what collapses the two rules onto one test, and a marker over a claim nobody can re-measure is one no reader can falsify.

Nothing writes the anchor back. The diagram field has two writers that never touch each other's half, one setting `verified` and one appending `stale`, and the architecture record has neither. The rule shipped ahead of the pass that maintains it, since a rule with no anchored entries yet costs nothing to carry, and `canon/ARCHITECTURE.md` records the gap as an open risk rather than leaving it to be re-derived.

Two of its rules pull opposite ways on a pass that amends a decision's reasoning without re-reading its numbers. Anchoring on an amendment asks for a refresh, and the marker recording what a claim was read against forbids one, so the honest answer dates the measurement rather than the edit: a decision importing an existing observation from elsewhere carries that observation's own anchor rather than a fresh one stamped at the import.

## The publish standard's cross-reference form

`standards/publish.md` states the form a pull request or issue number takes, under `## Cross-reference form`. The rule is one test rather than a list of surfaces: bare where the destination auto-links it, backticked where it does not. A list goes stale when a seventh surface appears, and the test covers the cross-repository spelling without a clause of its own, since the same auto-linking reaches it.

The split runs through the remote. A pull request body, an issue body, a comment on either, and a commit message all auto-link, and a markdown file browsed from the repository tree links neither spelling, so the two forms are each correct in one place and a reference moved between them is rewritten.

`publish.md` holds the rule over `markdown.md` because it turns on where the text is going rather than on what the text is. `markdown.md` governs a file reference identically in every file, and this one is wrong in one destination and right in the other, which is the split `publish.md` already draws for phase labels. `markdown.md` carries the `Does not govern:` entry and `publish.md` names the rule in its own scope line, which is what makes the boundary declared from both sides. Writing the yield alone left a standard originating a rule its scope statement never claimed, and `canon/context/standards/scope.md` holds that failure as the general case.

Six skills write GitHub conversational text and every one already cites the standard, so a single section reaches all of them and no skill body carries the rule. Restating it per skill would put one rule in seven places on seven cadences.

Quoted text is exempt, which the rule has to say rather than leave to judgment. Two of the six consumers quote repository prose into a GitHub comment, so an instruction to rewrite a reference moved between destinations reaches inside a quotation and reports the source as having said something it never said.

Nothing enforces it and nothing can. `canon markdown audit` runs over repository files, where the backticked form is the correct one, so a check there would flag the compliant references in the tree and reach none of the published text that goes wrong. The rule joins the character and phase-label bans as something an author applies at publish time, and those at least have a verb behind them for the repository half.

## The publish standard's destination test governs every check under it

The paragraph scoping a check by destination sits under `## When it runs` rather than inside one check's section, so a check added later inherits it instead of restating it: a reader inside the repository holds the task board and a reader on a remote holds neither that nor any gitignored record folder. `## Phase labels` and `## Board identifiers` both fall under it, the second covering a label a code span quotes and a path under a record root, and each says under its own heading that the shared paragraph scopes it.

`canon labels scan` is the verb behind all three, and it is destination-scoped by construction rather than by a parameter, since the workflow wires it to `pull_request` and `pull_request_review`, both readers holding the checkout the check scopes against. The negative half is asserted rather than parameterized: a unit case runs the markdown ban sets, which are the repository-bound corpus, through the scan and expects nothing. A `destination` argument was the alternative and it moves a split the invocation site already draws into a function every caller then has to answer for.

`## Session links` is the third check the paragraph governs, and it is the one whose dependency the shared wording does not describe. The other two turn on the reader holding this checkout, so a clone repairs neither and the checkout repairs both. A session link resolves for the one account that started it, which no checkout and no clone reaches, so the section states that narrower dependency under its own heading rather than the paragraph being rewritten to cover a case only one check has.

It is reported on a release pull request too, where the board identifier is exempted. That exemption reasons from every commit in release-please's generated history having already passed this gate, and a category the gate did not yet scan for would reach a release body underneath the premise.

Which paths the verb reads as absent from a clone splits by root rather than composing one predicate for both. `.canon/` matches on the root alone, since one `.gitignore` line covers everything beneath it and no entry list can narrow that below the root itself. `.claude/` keeps the entry-list reading: `src/labels/phase.ts` composes it from `RECORD_ENTRIES` plus the worktrees folder, which is ignored at `.gitignore` and absent from that list on purpose, since the harness pins a worktree to `.claude/` and a migration told to relocate one would break it. Adding the entry upstream to close that reporting gap is the declined alternative, since it changes what the record move carries to fix what a scan reports. A worker announcement names a worktree path routinely, so the gap had live instances rather than theoretical ones. A path under a `.canon/` folder no entry list ever named, such as a worker's own scratch note, is what the root-alone reading catches without a matching entry to add.

`standards/pr.md` names the rule from the reader's side, one line in its `Does not govern:` list routing at `publish.md`. Three consumers already reached the widened check through the exit code and the two shipped bodies that call the verb, and the fourth is the person writing the body, who would otherwise meet a red check with no rule in front of them.

## The title-spelling check carries no standard section

`canon labels scan`'s fourth check, an unspelled word in a pull request title, sits beside the phase-label, board-identifier, and session-link checks in the command but not beside them in `publish.md`. Those three name a rule the destination-scoping paragraph in `## When it runs` governs: text a reader outside this checkout cannot resolve, whether that is a task-board reference, a gitignored record path, or a session link. A misspelled word carries no such dependency, so it fits neither that paragraph nor the namespace split `versioning.md` states for phase labels against semver tags. It is a narrower, mechanical fact about one field feeding one downstream sink: release-please copies a pull request title straight into `CHANGELOG.md` with nothing having spell-checked it first, so it stays a fact this entry and `docs/agents/commands.md` state about the verb rather than a rule a standard governs.

The check also carries a devDependency-availability design worth recording here rather than in a standard. `cspell` is a devDependency of this repository alone, per `075-dependencies.md`'s ban on importing a transitive-only package, so `src/labels/spelling.ts` resolves `node_modules/.bin/cspell` by walking from the caller's working directory up to the filesystem root, rather than shelling a bare `cspell` command. `bun src/cli.ts labels scan`, the invocation `phase-label-gate.yml` runs, sits outside `bun run` and carries no `node_modules/.bin` on `PATH`, so a bare spawn throws `ENOENT` even inside this repository. The resolved path also rules out a `bunx` fallback, which could reach the network from inside a command that has been fully offline and regex-based until now. A target project carrying no `cspell` gets no coverage from this check rather than a forced new dependency or a network call it never asked for.

`scanTitleSpelling` reads the `cspell` exit code and reports `check-failed` on any value outside its two defined ones, clean or issues found, rather than reading an unreadable exit the same way a clean title reads. The `--json` record carries `spellingChecked` alongside `unspelledWords`, so a caller can tell a clean title from one nothing checked, since both would otherwise report an empty array.

## The teach standard governs shape and the skill governs procedure

`standards/teach.md` fixes the layout, the ordinal naming, the frontmatter, and the mission and learning-record formats of a learning workspace, while the pedagogy that decides what to teach next sits in `teach-workspace/references/`. An attribute standard beside `markdown.md` was the alternative and it is declined on the second-reader test, since a standard nothing else cites has no owner to correct it. Folding the pedagogy into `teach.md` was the other candidate, and `591-standard-authoring` rules it out, since a standard governs one document type or one attribute rather than both. `teach.md` carries only prose naming the skill's reference rather than a path a check could resolve, since `canon gov citations` never opens `standards/`. Measured at `285723bc` on 2026-09-06.

The workspace is the first record folder named `<nn>-<topic>` rather than by a bare slug, so a listing sorts by when each opened, which was free because the surface was greenfield. The groundwork and intake folders then took one ordinal sequence across both kinds, derived from the first commit naming a folder where one exists and from filesystem timestamps otherwise, and slug resolution widened to match a bare topic against its ordinal-prefixed folder. Measured at `d5f519ee` on 2026-08-26.

## The glossary standard and its one stated exception

`standards/glossary.md` governs a glossary wherever it sits, which is why the format left `standards/teach.md` rather than staying inside it. A workspace glossary is promotable, so the shape has to travel with the file, and a rule stated in the standard over the folder it started in reaches nothing once it lands somewhere else. `teach.md` keeps the requirement that the file exists and yields the entry shape, which is the boundary declared from both sides.

The same reasoning is what moved it out of `teach.md` and into a standard of its own, since a promotion lands the file at a path no glob covers and `teach-workspace` is the one surface driving every such move. It sits at the flat root and resolves to `teach-workspace`. Both readers name the skill rather than a path: `teach.md` because the file a promotion lands has no fixed address to point at, and `561-teach.md` because it ships with the CLI while the reference ships with the plugin, so it carries the report-the-gap instruction `500-prose` already uses across that split.

The format came from the external source the teaching surface was built against rather than from the one glossary-shaped page already here, which is the more specified of the two: it adds a term only once the material has used it, picks one word per concept and lists the rejected synonyms as aliases to avoid, and requires the glossary's own terms inside other definitions. `internal/vocabulary.md` then departs on one rule and states the departure in its own intro, since a bank drawn from every session that produced a term has no first appearance to name and its use-when line carries what a reader came for instead. Recording the exception on the page rather than in the standard is what `standards/standard.md` already requires, since a standard citing a real file goes stale the moment that file moves.

## The Mermaid standard's aspect rule is a label-width problem

The taller-than-wide rule in `standards/mermaid.md` is decided by the widest rank's label text and column count, so a wide render is fixed by trimming node labels to three or four words and stacking independent siblings with a `~~~` invisible link, not by removing nodes. A `~~~` link inside a subgraph or folding two nodes into one label can swing a diagram from wider-than-tall to taller-than-wide with every node and edge otherwise unchanged. Read the ratio mechanically out of bytes 16 to 24 of a PNG header after rendering through `bunx -y @mermaid-js/mermaid-cli`. A fan-in the standard bans is a separate problem, and a vertical timeline with the trigger on each edge label clears both at once.

## The wireframe standard's transcription carve-out

The standard's `## What moves to canon/context/` sent class or token names and pixel-exact spacing out of a wireframe, and `## Layout` told an author a role label reads better than a class name. Both wireframes this repository has ever shipped do the opposite on purpose. `canon/wireframes/slides.md` names `src/slides/layouts.ts`'s `MX` and `BODY_Y` constants and states outright that each block transcribes its render function's placement rather than approximating it, and the four `canon/wireframes/teach/` files carry `.mast`, `.track`, `--chrome`, and a 4.4rem bar height on the same pattern.

The carve-out states the mode rather than repealing the rule. `## Transcription wireframes` permits a source citation, class or token names, and exact geometry only where the wireframe is regenerated from an already-built surface's own render code, and it requires the file to open by naming that source. A wireframe drafted ahead of any build keeps the original rule, since there is no source yet to check it against.

Moving the class names and pixel values into a `canon/context/` entry instead was the rejected alternative. Nothing else in the repository documents `src/slides/layouts.ts`'s constants or `course.css`'s teach variables, so the move would have created a second source for facts the render code already carries, rather than removing the contradiction between the standard and the two files.

Requiring both a source citation and a separate sentence stating plainly that the block transcribes rather than approximates was the wider version of the carve-out, and it was narrowed to the source citation alone: a class name and a line number traced to a real file already carry the signal a separate declaration sentence would only restate, and the wireframes already shipped name their source through a `Source: ..., regenerated for this plan against <commit>` stamp or an inline citation without stating the claim outright.

## The wireframe standard's copy rule narrows to structural text

`## Copy` required UI copy verbatim with no exemption for length or kind, and `canon/wireframes/teach/lesson.md`, the first wireframe in the corpus carrying substantial body prose, showed the cost: its ASCII figure bakes in the lede sentence and the `.assumes` panel text, both duplicated from the live HTML source rather than structural chrome the figure exists to show. The rule narrowed to short structural text, being labels, headings, empty-state strings, and nav or footer copy, and routes long-form or article-body content to a citation of its source file instead.

Citing every kind of on-screen text was the rejected alternative. A label has no source file to cite, being authored in the wireframe itself rather than pulled from a live document, so a citation requirement widened to cover it would ask for a reference that does not exist. The narrowing therefore runs one way: short structural text stays verbatim because it has nowhere else to live, and long-form content moves to a citation because duplicating it is what let `lesson.md` drift.

## The title-format check carries a standard section, unlike spelling

`canon labels scan`'s fifth check grades a pull request title against `standards/pr.md`'s `## Title` section, format, casing, and length, rather than against a fact this entry alone states the way the title-spelling check above does. The section already exists, so the check enforces a rule already written rather than inventing one to attach.

The three rules are checked independently, `structure`, the two casing pairs, and `length`, rather than the title failing wholesale on the first mismatch. `format.test.ts`'s own strategy decided it, breaking one rule at a time and asserting each fails alone, since a title breaking two rules at once and reporting only the first would leave an author fixing one and meeting the second on the next run rather than both in one pass. `structure` still stands apart from the rest, because a title failing the shape match parses no `<type>`, `<scope>`, or `<subject>` to grade casing against.

It does not check `<type>` against `standards/commit.md`'s fixed type enum, though a pull request title and a commit subject share the same form. `pr.md`'s own `## Title` section states format, casing, and length only, and cites `commit.md` for the structure it shares rather than for a type list, so checking a type list `pr.md` never names would enforce a rule from the wrong document.

A sibling rule closes the matching gap on the commit side. The built-in `subject-case` rule tests the whole subject string's casing, which would reject a legitimate capitalized proper noun anywhere in it rather than the first word alone `standards/commit.md` actually governs, and that is why `commitlint.config.js` leaves it at `[0]`. A local rule function checks the subject's leading letter run alone instead, mirroring the title check's own subject-casing rule rather than the built-in rule's whole-subject scope.

## A standard with one reader lives in that reader's skill

`issue.md` left the flat catalog for `claude/skills/git-issue/references/issue.md`, since `git-issue` is the only thing that reads it and the ownership test puts a one-reader fact inside its reader. It lost its frontmatter on the way, because a reference answers to its skill rather than to the standards template, so `canon standards issue` does not resolve it.

`snippets.md` was filed for the same move and stayed. Re-counting at `c175ec5d` found two readers behind the one the row carried: `create-snippet`, and the toolkit-internal `internal-snippets` skill, which sends a session to its cadence and audience tests before it admits a snippet. A skill reading a file to do its job is a reader, where a context entry pointing at it is not, so a second one ends the case. `skill.md` also names it as the sibling standard for chat prompts.

The count is the test, and it decays: a filed count that predates a later citation moves a file a second reader still needs, so re-count before every move.

## The wiki standard acquires its first reader

`wiki.md` was written and then cited by nothing. Every page under the wiki folder conformed to it, which is the reading that matters: the standard was being followed from the author's memory rather than from a read, so its rules were never once checked against the tree they govern. `draft-wiki` is the citation, and drafting it forced the check the standard had never had. All fourteen pages passed, including the sourcing rule, which is the one a session working from recall breaks silently.

A standard with no reader was nearly moved into its reader's skill under the ownership test above, which is what happened to `issue.md`. The move is wrong here for a reason the count does not show. `issue.md` had one reader and the test put the fact inside it. `wiki.md` had none, and a standard with zero readers is not a one-reader fact waiting to be relocated, it is a rule nothing enforces. Adding the reader is what closes that, where the move would have buried the rule inside the only thing that reads it and left the fourteen existing pages answering to nothing.

The write frequency is why this standard got a skill and three siblings did not. Measured at `f635d673` across all 1725 commits, the wiki folder appears in 90 against 8 for `canon/ARCHITECTURE.md` and 1 each for `canon/REQUIREMENTS.md` and `canon/decisions/`. The 90 counts commits rather than pages authored, so it overstates the writing, but not by enough to close a gap that wide.

Read over the last 200 commits instead and the order inverts: wiki 5, architecture 8, requirements 1, decisions 1. The two readings disagree because the wiki was written heavily and early while the other three were touched only recently, so every one of their commits sits inside that window and 85 of the wiki's sit outside it. The all-time figure is the one the decision rests on, since a skill is built for the traffic a surface attracts across its life rather than for whichever quarter is busiest. Both are recorded here because the recent window is the reading that would have argued for `draft-architecture` first, and a later reader re-running the count on a short range will land there and should know the choice was made against the long one.

A standard governing a surface nobody writes to does not need a drafting skill, however uneven that leaves the standard-and-skill table.
