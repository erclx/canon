---
title: Skill strategy
description: Where a plugin skill lives, the catalog command, the workflow against domain-knowledge split, the redundancy audit, and the trim read at seventy-three
---

# Skill strategy

Plugin skills live in `claude/skills/` and are auto-discovered from the plugin root, whether that root is a marketplace install or a `--plugin-dir` pointed at a checkout. No registration needed, folder presence is enough. Each skill is a kebab-case folder containing `SKILL.md`.

Skills that perform a one-time structural move of an existing project into a newer toolkit layout use the `migration-*` prefix, which `canon claude skills list --names` enumerates rather than this line. Add new one-shot relocations to this family. Recurring reconciliation tools like `seed-sync` are not migrations and stay outside it.

The family lost a member rather than drifting one: `migration-standards` relocated a root `snippets/` folder into `.claude/snippets/`, and once the snippets install channel closed alongside the standards one, that destination stopped being legitimate for either domain, leaving the skill no move left to propose. The retirement runs by hand across every target still holding a root `standards/` or `snippets/` tree, dropping the installed copy and repointing citations at `canon standards <name>` or the plugin's live snippets symlink. `setup-init` still names its remaining siblings under `Out of scope` and still invokes `setup-verify` as chain step 4, though the chain since folded `setup-indexes` in as step 5 rather than leaving it named there, so the setup-chain admission grew a step rather than holding unchanged.

`migration-standards-drop` closes the standards half of that gap and takes the family back to four members. It proposes the drop and the citation repoint and applies neither, on the shape its three siblings already set. What it ships against is the 2026-08-28 census rather than a live move, since the one task performing the repair stays parked on the operator declining outside-repository work. The snippets half is closed by neither a skill nor a task.

## The catalog

`canon claude skills list` is the catalog. It reports every folder under `claude/skills/`, `--names` emits those names one per line for a shell caller, and `canon claude skills list --json` returns the set as objects carrying `name`, `description`, and `requirement`. A session looking for which skills exist runs the first, and one looking for what a skill claims to do runs the third.

These entries hold the reasons instead: why a skill exists, where its boundary against a sibling sits, and what a coverage verdict turned on. None of that is recoverable from a listing, and the roster is recoverable from nothing else. `standards/context.md` puts a catalog a `list` command already returns under what does not go in, and says to link the command so the entry cannot drift from it.

## The consumer map groups by phase, and its table is the corpus

`docs/workflow/ai-workflow.md` carries the when-to-use map, and the `## Skills` table under it is what a coverage claim is measured against. Groups run in the order a project meets them, from setup through building, checking, and shipping to the pull request and the toolkit-sync relationship. The last two hold what serves no single moment: one for artifacts generated on request, one for skills answering a question at any point.

Naming the map rather than the table leaves the claim open, since mentions elsewhere in the file reach further than the table does, and a passing prose mention is not the same claim as a row. The table is the block, and coverage claimed anywhere else does not count toward it.

The groups derive from the scenarios above the map reconciled against the lifecycle `docs/target-projects.md` describes, rather than a third vocabulary beside those two. Each skill takes exactly one row, so a reader scanning a group reads a set rather than a sample, and a skill honestly serving two moments sits at the earlier one. The map carries no total, because the count moves whenever a skill lands.

Nothing checks that the table still covers the corpus. `canon claude skills list --names` reports the set and the comparison is a person's to run, so a skill added after this pass reopens the gap with nothing reporting it. That check belongs beside the other catalog commands rather than inside a doc rewrite.

## Workflow skills and domain-knowledge skills

Skills split into two categories by function. The toolkit owns the first and installs the second, and mixing them is the most common source of skill bloat and maintenance drag.

Workflow skills wrap how this toolkit operates: groundwork, planning, review, shipping, debugging, git, and governance install. They are thin, opinionated, and specific to the author's process.

Domain-knowledge skills encode expertise curated over many hours, such as frontend design anti-patterns, security audit patterns, and industry-specific UI rules. The wider ecosystem supplies those as `frontend-design`, `impeccable`, `ui-ux-pro-max`, `taste-skill`, and `trailofbits/skills`. Curation is the whole value of the second kind, so forking one means inheriting the cost of maintaining that curation against an upstream that keeps moving.

| Location                         | Purpose                                                    | Scope  |
| -------------------------------- | ---------------------------------------------------------- | ------ |
| `claude/skills/`                 | Workflow skills, installable into target projects          | Shared |
| `.claude/skills/`                | Toolkit-internal authoring skills, the `internal-*` family | Local  |
| Target project `.claude/skills/` | Per-project customization not worth upstreaming            | Local  |
| `~/.claude/skills/`              | Global user skills active across every session             | User   |
| Plugin marketplace               | Community and official plugins installed via `/plugin`     | User   |

Which location is right follows from who benefits.

- A commit style specific to one project stays in that project's `.claude/skills/`
- A commit skill the author uses everywhere goes in `claude/skills/`
- A frontend design anti-pattern skill maintained by a third party stays a plugin install

Forking has not been necessary in practice, and when one looks tempting a thin toolkit wrapper composing the upstream skill has met the need instead.

The rules this argument produces fire when a skill is being written, so they live in `.claude/skills/internal-claude/SKILL.md` rather than here.

## Three entry points, split by what a question costs

`plan-intake`, `plan-groundwork`, and `plan-feature` are the front doors, and one question routes between them. Can the item be answered by reading the repository today? Yes goes to intake at the cost of a session grepping, no goes to groundwork at the cost of runs and days, and already-decided goes to the planning skill. The test runs per item, since a dump of forty findings typically holds one that needs measuring and routing the whole dump on its worst item buys a folder nobody can close.

Intake is a skill rather than a mode inside either neighbor. A mode gives one skill two purposes and its `REQUIREMENT.md` two subjects, which is the collision the requirement file exists to prevent. A snippet was the other candidate and carries no read contract, so it cannot orient against the board or measure against the tree, and those two steps are what an intake pass turns on. Groundwork's qualifying guard refuses a breadth pass outright and names intake as the destination rather than sending a refused dump to the planning skill.

Answering what a pass filed is a second skill rather than a mode on the first, on the same argument that made intake its own front door. `plan-intake-answer` walks the unread slots in batches and lands each selection through `canon intake answer`, and it carries `disable-model-invocation` so routing never reaches for it mid-flow. A pass that files a dump and answers it in one run decides items on silence, which is the contract inversion the folder exists to hold.

The write is a verb rather than a body instruction because every worker runs in a linked worktree, where the file-editing tools refuse a main-root path and the stream editors this repository bans are what a shell route would reach for. That is the same constraint behind the task record verbs. One call carries a whole cluster, since concurrent calls against one file race on the read and keep only the last answer.

A pass that splits a finding after the fact labels the halves `3a` and `3b` rather than renumbering the file, and a parser accepting digits alone would drop those items with nothing reporting the gap, so the label is a string carrying an optional suffix and the standard says so.

An empty operator slot in an intake folder means unread, where a plan file's blank answer means accept. A plan is read in one sitting and an intake folder is read over weeks, so silence there is far more likely to mean nobody reached the item than that they accepted it.

## What a skill carries

A file a skill body cites has to arrive by the channel the skill itself travels on. Skills load live from the plugin root while standards, snippets, and governance rules are copied by a `canon` command, so a body naming an installed path is a dependency crossing that boundary and resolves only for a project that ran the matching install. Nothing reports the break, because an unresolved path produces no error until a session opens it.

The three orchestrator runbooks settle the rule: they sit in `role-orchestrator`'s own `references/`, cited with `${CLAUDE_SKILL_DIR}`, which resolves from any working directory in any target. What this narrows to is a test on readership rather than on topic: a file one skill reads ships inside it, and a file several surfaces reach stays in the catalog that publishes it.

The test cuts both ways. `plan-groundwork` and `plan-intake` are each edited by sessions that never invoked the skill, so their folder format lives at `standards/groundwork.md` and `standards/intake.md` instead, with a rule routing each path.

The sharpest failure of the same test is a citation naming no toolkit file at all. Twenty lines across eighteen shipped bodies sent a reader to a named section of the consuming project's own `CLAUDE.md`, and no root file here or in any known target carries that section, so every one resolved to nothing while reading as an ordinary pointer. Seventeen of the twenty now name `session-worktree`, which ships in the same plugin as the bodies citing it and pins no heading a retitling can break. One reaches `standards/plan.md` through the plugin root, and two lose the pointer outright because the file they sit in already carries the resolution a few lines above. `src/claude/skills-headings.test.ts` walks `claude/skills/` and fails on the shape, which is a prose pattern rather than a resolution because no check can read a target's own root file. It bans this instance and not the class: a body citing any part of the consuming project's file is the wider defect and nothing measures it.

The cost is the typed entry point, which is the part worth knowing before moving anything else. A person fires a snippet by typing its path and cannot type a reference, so a runbook whose moment the loop cannot detect has to be reachable some other way. An invocation word looks like the answer and is banned by `standards/skill.md`, which turns down a flag that selects an alternate flow because the model misreads it and runs the vanilla path, and a handoff that silently does not happen is lost at the next compaction.

What replaces it is a body that routes a plain request to the runbook serving it, leaving one flow with no flag in it. `role-orchestrator` does this for both compaction sides, while the sweep needs nothing because the loop already reaches it.

Which surface holds an invariant follows the same test, run against the failure rather than against the topic. A path-scoped rule loads when a session opens a file matching its glob, so it reaches what goes wrong inside a folder and never reaches a write that escapes one.

`plan-intake` carries both kinds: its write scope is a floor about paths outside `.canon/intake/`, which no glob over that folder can see, while its item format and answer contract are exactly what a rule would catch in a session editing the folder with the skill unloaded.

Only the second kind is a rule's to hold, and `standards/rule.md` has a rule point at the standard owning a document-type convention rather than restate it, so the second kind waits on a standard that does not exist. Writing one beside the skill's bundled reference would make two sources for one text, which is the shape `canon/ARCHITECTURE.md` turns down, and `plan-groundwork` carries the identical split, so the pair is one queued change rather than two.

Routing through the body moves the failure rather than removing it, and a skill carrying `disable-model-invocation` has to say so. The routing is only in play while the body is loaded, and a long session approaching a compaction is the likeliest place to have dropped it, which is the same moment the runbook exists for. A body that stops at the routing leaves the request landing as ordinary conversation with nothing reporting the miss, so it owes two recoveries: re-invoke the skill, and name the runbook paths so a reader can open one with the skill unloaded.

## Two surfaces on one rule, split by reach

The judgment-call rule in `CLAUDE.md` states two branches and each branch owns a surface. A call the session can weigh takes a pick carrying its tradeoff in one sentence, which `snippets/decision-help.md` shapes. A call whose answer turns on the operator's preference goes through the structured question surface, which the same file states generally and which reaches every session rather than only an invoked one, and `decision-escalate` layers batching over that statement so several open decisions arrive in one turn rather than one question each.

The two overlap in subject and never in reach, which is what keeps both on the shelf. A snippet is copied into a project by a CLI command and runs in a chat with no repository behind it, while a skill loads live from the plugin root, so a project that added the plugin and installed nothing reaches the skill alone. Reaching it without an install is the property the escalation branch needed, since a session hits that branch mid-run inside a repository.

`decision-escalate` carries `disable-model-invocation: true`, so nothing routes to it on a description match and the operator is what fires it. The body tests the surface rather than naming a vendor's tool or reading the project's instruction file, which keeps one body running where the structured tool exists and where it does not. Gating on the instruction file instead would reach no installed target, since the rule ships in the seed and a seed reaches only a project scaffolded after it.

## The interface pair splits on the act rather than the subject

`ux-audit` and `ux-measure` share a subject and differ on what they do to it. The first reads source and reports judgments against stated intent, the second starts the thing and reports numbers against published thresholds. Before the second existed, the question landed on whichever skill matched the word "UI", since no surface in the catalog covered a running interface at all.

Folding the measurement into the audit was the obvious alternative and its own guard rules it out. That skill stops when it finds no interface source to read, which is a condition a running interface does not satisfy, so the host would refuse the request before reaching it. Each body therefore declines the other by name, since a boundary stated on one side alone is never checked against the skill on the other.

Contrast stays with the static reader against the pull of the runtime one. Two color values compute it and the audit already reads the token table holding them, so moving it buys a browser start for an answer arithmetic gives. What that costs is a contrast failure from a color computed at runtime, which is invisible to a token-table reader and is accepted rather than overlooked.

The runner is detected rather than prescribed, since the harness differs per project. The surface owns the metrics and the thresholds, which are portable, and reads the project's choice of runner, which is not. Detecting nothing therefore reports what the measurement needs and stops, the same absent-key rule `canon-operator` already follows, since a stop there says the project has not chosen a runner rather than saying the skill is broken.

The front door reaches it through the audit offers. Four rows are `canon` verbs and this one is a skill handoff, so the execute contract governing a CLI run does not reach it. Its second condition is a browser harness, which the front door does not test, because the skill detects that already and a second reader of the same fact answers stale.

## A prefix groups a family, and the namespace already carries uniqueness

Two prefixes answer ownership and each one answers it the same way. `internal-` is a skill only this repository runs, and `canon-` is a skill whose subject is the toolkit or which wraps a `canon` verb. Beside them sit the act families, `git-`, `setup-`, `migration-`, and `create-`, which name what the session is doing rather than what it is doing it to. A family picking a further ownership answer beside these two is what recording the axis is meant to prevent.

`claude-` was a third ownership answer and it is retired. The plugin namespace already resolves every shipped skill as `canon:<name>`, so a prefix naming Claude bought grouping over a large family and bought uniqueness over nothing. What those skills took in its place is the phase or the subject their members share, landing in families such as `plan-`, `review-`, `role-`, `docs-`, `memory-`, and `ux-`, with `session-` and `draft-` growing to absorb further members.

`canon-` itself narrowed to the skills that genuinely name the toolkit. A member that instead drafts a document joins `draft-` (`draft-screencast`, `draft-slides`), and a member that is neither drafting nor naming the toolkit takes a standalone verb-first name instead (`record-screencast`, `read-frames`), rather than inventing a fourth prefix for a pipeline read as a sequence.

Ownership is what the trade gives up. A shipped skill outside `internal-` and `canon-` says nothing about whose surface it maintains, since the phase and act prefixes answer when in a session the skill is reached instead, and the two readings do not compose into one name. Nothing reports a skill landing under a phase prefix while owning a surface the phase says nothing about, which the retired ownership axis would have caught by reading.

A plugin skill takes two words and only rarely one. A bare single word such as `autoship`, `diagram`, `docs`, `feature`, `groundwork`, `intake`, `orchestrate`, `planner`, `review`, `tasks`, `teach`, `worker`, or `worktree` is an ordinary English word a reader meets in running prose, so a catalog holding it leaves no token to grep for. The rule costs the catalog its shortest available names and keeps every name in it a token a search can find.

The collision that made the ownership axis unavoidable rather than merely untidy: an internal skill and the plugin namespace can both want `canon-`, since the namespace already resolves every shipped skill as `canon:`. `standards/skill.md` puts project ahead of plugin, so a genuine collision resolves in the internal family's favor with nothing reporting it. `internal-` wins over `toolkit-` and over a bare domain name because it matches `internal/`, the folder `598-authoring-layout.md` already governs, so the prefix teaches the boundary instead of restating it. What it costs is that the family still names its domain second, so nothing improves about scanning it.

Where a skill writes does not decide the ownership answer. A thin wrapper over a `canon` verb that happens to write under `.claude/` still takes the phase-or-subject prefix rather than a location-based one, since a durable record folder written under `.claude/` by a skill that does maintain a workflow surface stays wherever its subject places it. The two are not the same rule.

The feedback pair is the one place the axis alone is not enough. `canon-feedback-file` and `canon-feedback-triage` share a subject and split on the act, which is the rule `## The interface pair splits on the act rather than the subject` already states, so the prefix places the family and the second word separates the producer from the consumer. Naming both for the subject would ship `canon-feedback` and `canon-triage`, which read as unrelated in a listing.

## The direction axis sorts by which repository a skill writes into

`canon-rollout` is a skill the prefixes above place correctly while saying nothing about what makes it different. Every other skill in the catalog acts on the checkout the session stands in. This one starts in the toolkit and writes into the projects the toolkit installed into, so `canon-` answers whose surface it owns and leaves its blast radius unstated.

Direction is a second sorting axis beside the phase-of-use one the prefixes carry, and it earns no prefix of its own. A family naming it would hold one member and would contradict the ownership answer the prefix already gives, which is the further answer `## A prefix groups a family, and the namespace already carries uniqueness` exists to prevent. What recording it here costs is an axis with no naming convention behind it, so a second outbound skill can land under a prefix that hides the fact and nothing reports it.

The distinction is worth an entry because the risk moves with it. A wrong run inside this repository damages a checkout under version control with a test suite over it. A wrong run outbound enters a worktree in somebody else's project and pushes a branch there, and the sandbox arm can reach a fixture rather than a real target, so no test in this repository covers the case the axis names.

### One skill rather than a family

The skill carries an orchestrator role and a worker role in one body, where `role-orchestrator` and `role-worker` split the same pair across two. Splitting was the alternative and it puts the target census in one body and the dispatch that reads it in another, when the three phases are one loop over one target list. The tradeoff accepted instead is a body longer than either half alone.

What keeps the two roles together past that answer is the three contracts both of them execute against: the fixed `chore/agents` branch and `chore(agents)` title, the ban on merging that binds every role rather than sitting as a setting on a wave, and the pull request URL every report carries. A family states each contract twice with nothing comparing the copies, which is the failure the fixed shape exists against in the first place, since four hand-driven repairs produced four titles across two scopes.

The body stays whole rather than moving one role into `references/`. A role read by exactly the sessions holding it and skipped by the other is the branch that would justify the move, and it was declined because the contracts above sit ahead of the split and belong to both roles, so a reference per role either duplicates them or leaves the reader who loaded one without them. `standards/skill.md` puts the 150-line prompt on a body carrying more than procedure, and what sits above the roles here is the contract set rather than narrative.

## The teaching surface sorts by what the reader is doing

`teach-workspace` runs a learning workspace on one subject across sessions. It sits beside the wiki rather than against it, because the two sort on independent axes: a workspace sorts by what the reader is doing, learning rather than looking up, and the wiki test sorts by who owns the subject. A workspace on how a system measures pronunciation accuracy and a workspace on how a feature is implemented here are the same surface with different subjects, which is why the wiki test needs no amendment.

The name follows the same pattern every skill owning a record folder under `.claude/` takes, naming that folder behind a prefix, which `plan-groundwork`, `plan-intake`, `task-board`, and `draft-diagram` all follow. A workspace at `.canon/teach/<nn>-<topic>/` names its skill `teach-workspace`. It carries `disable-model-invocation: true`, so opening a workspace is the learner's call rather than a description match.

The output splits by lifetime and the format follows the split. A lesson is worked through once, carries a quiz with immediate feedback, and is never committed, so it is markup. A reference page is looked up later and is the half a promotion pass would move into a gated corpus, so it is markdown and passes those gates the day it is written rather than at the moment someone tries to promote it. Authoring both as markup was the source's own choice and it puts the promotable half in a format no stage reads.

The durable half leaves through a promote step in the same skill, sorted by who owns the subject rather than by what the reader was doing. That is the wiki test unamended, so an Anthropic-owned subject goes to the wiki, an internal one to the matching context entry, and everything else, including a subject owned by another vendor, goes to the public docs. The step proposes and waits, and it writes nothing to a destination: a confirmed page lands in `.canon/tmp/teach-promotion/<slug>.md` and `docs-fold` folds it in from a branch, which is the handoff shape `memory-capture` already runs. The file is a sibling of the routed-facts one rather than the same file, because that one is deleted by whichever pass folds it and a third writer on a destructive reader loses another producer's unread work.

Two things carry a cost worth naming. The step is the first caller of the wiki scaffolding verb, which a closed track recorded as creating a folder nothing read, and it refuses rather than scaffolds when a project has no wiki, so the verb stays the operator's call. The fold reaches the public docs corpus, which `docs-sync` otherwise owns, and the carve-out is narrow: `docs-fold` lands a page whose destination is already confirmed and reconciles nothing there against a diff.

The rendered layer is the half a session works through rather than consults, and three of its rules moved out of the body into code. Quiz option order is drawn by `canon teach lesson` rather than instructed, because the source this design departs from reports answers defaulting to the first option while its stated mitigation addresses a formatting leak instead, so porting the instruction ports the defect. The same verb reports the numbered path the lesson takes, the shared stylesheet with whether it is on disk yet, and the mission's success lines, which is what turns those lines into exit criteria a session reports progress against rather than a list nothing reads.

The verb writes nothing, and the stylesheet is the reason. Every lesson after the first links what the first one wrote, so a verb that wrote the file on each lesson would discard what the last one added. Reporting `stylesheetExists` puts the write on the one lesson that needs it and leaves the rest linking.

The third is the chrome itself. `canon teach nav` splices the header, breadcrumb, jump menus, footer nav, and the embedded stylesheet into four marker comment pairs a lesson leaves empty, rather than a session composing them by hand, which is the judgment that let one hand-authored workspace carry a contents page while its sibling carried none. A lesson missing a marker pair is refused by name and left untouched, and the same run rewrites the root listing and every contents page from what the workspace holds on disk.

What the split cannot close is that the body is still free to reorder what the verb reports. The sandbox arm for this layer asserts the ordinal, the link, and the stylesheet, and the ordering is a property over many runs that one arm cannot see, so it is recorded as manual rather than claimed.

Three gaps between what the pedagogy reference prefers and what the surface offered closed together, and each cost a different thing. The reference prefers a produced answer over a selected one and the lesson carried only a quiz, so a teach-back block joined it, which costs nothing mechanical since a `<details>` needs no styles the workspace does not already give one. The reference asks for a schedule and every record named a revisit note nothing read, so `## Revisit` gained a fixed shape and `canon teach list <topic> --json` gained `due`, which costs a listing one read per learning record and puts the spacing ladder in code where an author told to widen a gap would have picked the number by judgment. The quiz showed every question at once, so a later stem could answer an earlier question, which the stepper closes by gating on `:has()` at the price of a markup contract a lesson author now writes by hand with nothing checking it until a quiz in the wrong shape renders flat.

The teach-back miss lands under what the learner got wrong rather than under a heading of its own, since a produced answer and a selected one are both retrieval failures the next session places from, and two headings split one placement input.

## The writing surface is a skill because nothing reads a standard nobody opens

`write-human` carries voice, rhythm, sentence construction, and information density. The bans, the spellings, and the frontmatter wording live in `markdown.md`, read by a command. This skill carries the half no check settles.

The name follows the job rather than the medium. `prose` names what is being written and every other candidate named the defect, where the job is removing machine tells and putting a person back into the writing. It is model-invocable, unlike the eight bodies carrying `disable-model-invocation`, since each of those is a workflow a person starts and this is guidance a session should reach for mid-draft.

Delivery is what makes it different from what it replaces, and the rule is the load-bearing half rather than the body. `500-prose` fires on every markdown edit and carries an explicit instruction to load the skill, so the guidance arrives on a glob match. A skill reachable only by description match reproduces the defect it was built against.

Three references hold what a body cannot. `machine-tells.md` is a diagnostic catalog behind a stated trigger, so a short original draft pays no read for it. `density.md` splits what a compression pass may cut from what it may not, which is the layer a terse register has no answer for. `source-material.md` records what was adopted from outside and what was declined, including the ban on abstract metaphor nouns: `surface` alone appears 593 times in tracked markdown at `57ee7467`, so adopting that item rewrites the corpus or is ignored in silence.

What stays open is the same gap `teach-workspace` records about option order. Cadence is a property of a passage over many sentences, nothing compares the output against these rules, and the sandbox arm therefore carries its rhythm claims as manual entries rather than asserting them.

## The restatement surface is asked for by name, which is what separates it from its two neighbors

`restate-plainly` takes a dense answer or a named markdown document and returns the plain version. Neither neighbor covers the request: `write-human` governs a passage being drafted or revised and arrives on a markdown edit, and `canon markdown audit` reports sentence spread and repeated openings from package data. One writes and one measures, and a reader who stopped to decode an answer is served by neither.

The name is the decision the row owns. `simplify` is the obvious pick and is a built-in whose subject is code cleanup, so taking it makes a description match ambiguous even though the slash form disambiguates. `plain-language` describes the output where the skill is named for the act. Model invocation stays on, unlike the eight bodies carrying `disable-model-invocation`, because the ask arrives in ordinary words far more often than as a command, and the description bars the one case the task forbade: the skill never fires on the model's own opinion of its own output.

The body writes no file. A restatement is read once to reach a decision, and rewriting a document into a file is a proposal against the source rather than a restatement of it. That keeps the arm's mechanical half small, since what it can assert is that the tree was left alone and the reply named the source path and the `Cut:` label. Whether the plain version kept the deciding half is the judgment the skill exists to make and nothing checks it, so every claim about the content sits under `manual` rather than being padded into the count.

## The proposal surface is a recombination, not a new design

`markdown-propose` closes a gap three shipped surfaces sit beside without covering: nothing drafts a markdown replacement, carries an answer slot, and waits. `standards-audit` maps changed files to standards and reports, ending on its own description, `Do NOT fix violations. Reporting only.` `canon markdown audit` measures bans and structural checkpoints from package data.

`review-branch` reports findings on a diff someone already wrote. All three report. None drafts, and none waits for an answer.

Its phases are `content-audit`'s five passes, generalized down to what describes a governing document rather than a person: inflation, staleness, contradiction, and duplication survive the generalization, and register drift does not, since this repository's docs carry no spoken-versus-written split for a word to drift across.

Its answer contract is `plan-intake`'s `You:` slot rather than a new one, chosen because it already ships toolkit-wide with the same empty-means-unread rule this surface needs. The plan file's blank-means-accept contract would read the wrong way on a folder read over days rather than one sitting.

The folder is `.canon/proposals/<nn>-<slug>/`, named for what it holds rather than leaning on a singular-versus-plural distinction against a sibling folder that reads the same at a glance. `src/records/backup.ts` carries it in `BACKED_FOLDERS`, since a proposal carries an unanswered decision and that list holds what a disk loss would take rather than regenerate.

The skill takes the concern and the surface it audits as invocation inputs rather than constants, which is what lets a second concern reuse the skill rather than fork it.

The format spec that would ordinarily be a standard, on the pattern `standards/teach.md` set for a workspace shape, stays inside the skill's own `references/format.md` instead, since this repository's own citation rule says a file only one skill reads ships inside it rather than into a corpus a second reader would have to find.

The variant format states `### N.` for a change and `#### A/B/C` for a variant explicitly, which is the shape that holds across a run producing several labelled bets on an invented change against one replacement on a corrected claim.

## The candidate surface, and the composed sheet it wanted has no verb

`draft-and-pick` covers work where several drafts are produced, looked at, and iterated until one is good enough. The four nearest surfaces all miss it by assuming the answer is known: `plan-feature` plans one answer, `ux-audit` reports roughness from source in one pass, `ux-measure` reads numbers off a running interface, and `ui-test` writes tests for a change already made. Each takes one pass at one answer, so a decision settled by looking landed on whichever of them matched the word "UI".

The name carries no ownership prefix, on the ownership axis above: this skill writes candidates to `.canon/tmp/<slug>/` and deletes them with the pick, so a bare verb phrase places it beside `restate-plainly` and `decision-escalate` rather than beside a workflow-surface family. A noun with no act in it was the alternative and was declined.

`captureSources` renders one image per source and composes nothing, so the contact sheet the source skill relied on has no counterpart verb here. What replaces it is authoring every arm side by side on one self-contained page and capturing that once, which gives the comparison the sheet existed for and needs no new verb. One file per arm was the alternative and hands the operator several images to hold against each other in memory, which is the comparison the page makes visible instead.

The measurement rules are cited rather than restated. `canon drive` ships the probes carrying most of the source skill's nine, and the body keeps the three no probe reaches: composite alpha before reading a color, sample inside the shape rather than at a bounding-box corner, and ask whether a reader would see the thing at all. A `references/measurement.md` was planned for the remainder and never written, since three rules sit well under the fifteen-line move checkpoint.

What travels and what does not is stated in the skill's own `REQUIREMENT.md` rather than in the plan or the task. Both of those are archived or gitignored at ship, so the requirement is the only one of the three a later reader opens. Three source capabilities stay behind, and a verb answers two of them: an arm switcher compiled into a project's own page gives way to `canon serve` over a scratch page, a site-wide treatment walker gives way to `canon drive` reading one page, and a copy cycle keyed to canonical text in a second repository is replaced by nothing at all, since no toolkit surface has that shape.

The pull request boundary rule went to `plan-feature` and not to `standards/plan.md`. It is the whole of the source skill's phase 1, and a session decides scope while writing the plan, so it lands in the skill that writes one rather than in the document standard that plan follows. A rule stated in both is two sources for one rule.

The sandbox arm resolves `canon capture` through `playwright-core` and the installed `canon` binary rather than `@playwright/test`, since the latter resolves out of a `node_modules` no target installs. A headless run has no operator to confirm a pick is right, so it carries a pre-supplied pick through the run, waits to its turn cap, and closes as its only terminal behavior.

What the arm cannot reach is the loop, the pick, and the hand-off, and that is a property of the harness rather than a gap a later fixture closes. The stop condition is a person and no fixture supplies one, so a green verdict is not coverage of the half the skill exists for. What is left to assert is the blast radius and the scope of the edit: a `write_scope` admitting the two surfaces a close legitimately reaches, and content pins holding the lines of the seeded page a treatment change must leave alone.

`canon capture` refuses a page that would rewrap against a substituted font, so a candidate page naming no font is refused on whatever the default font resolves to. Step 2 tells a run to declare a stack the machine resolves, since a page that carries everything it needs and a page that renders are not the same requirement.

A close records the decision wherever it was stated as open, in the same step that writes it, rather than in a separate path the write scope does not admit. The losing arms are deleted by the next step, so a pick that records nothing about why leaves the next reader re-deriving it from a diff.

## The draft surface, recombining docs-sync's domain with create-standard's confirm-before-write shape

`draft-docs` covers a page under `docs/` that does not exist yet, which is the gap `docs-sync` was never built to close: that skill classifies and rewrites existing sections against a diff since main, and a page with no prior version has no diff to classify. Reaching for it on a brand-new topic reports the page as unrelated to any change, which reads as a clean pass over a request nobody served.

The two skills stay separate rather than widening `docs-sync` to cover both, keeping a drafting branch out of a skill whose contract already reads as a rewrite. The split is by whether a diff exists to classify, the same axis `standards/docs.md` already sits behind `standards/context.md` and `standards/readme.md` on.

What it borrows from `create-standard` rather than from its nearer neighbor is the confirm step. `docs-sync` writes immediately after its preview, since the tool permission dialog is confirmation enough over a rewrite bounded by a diff. A new page carries no such bound, since placement is a judgment call weighed against the catalog's existing shelves rather than a change the branch already made, so the skill confirms the resolved path and the full content with the user before writing, the way `create-standard` confirms a slug and a body against no diff of its own.

Placement reads the catalog rather than assuming a folder. A `category` value already carried by a sibling page is reused verbatim, since a near-miss spelling opens a second shelf holding one page, and a topic matching no shelf lands at the `docs/` root, since a subfolder earns itself only once a shelf of pages already sits there. The guard against redrafting a covered topic runs the derived slug through `canon docs <slug>` and points at `docs-sync` on a hit, which is a heuristic gate rather than an exhaustive one, since the slug is guessed from the topic phrase rather than confirmed against every page's frontmatter.

## The context and wireframe draft surfaces, mirroring draft-docs's shape against two different standards

`draft-context` and `draft-wireframes` close the same gap `draft-docs` closes, for the two surfaces `docs-fold` already refreshes but never originates. That skill's own Step 7 declines outright to create a new `canon/context/` entry, and its wireframe-sweep step only ever writes a bare `TODO` stub for a surface a diff touched. Neither is a draft, so a domain or a surface with no file yet is reached by nothing that reads the owning standard, checks the catalog for a name collision, or confirms a placement judgment before writing.

Both skills take `draft-docs`'s five-step shape whole rather than inventing a second one: read the owning standard, check for a name-or-topic collision, decide placement, draft against the template, confirm, write. `draft-context` defaults every new domain to a flat file, since a fresh domain never holds the three or more sub-areas the context standard requires before it earns a folder. `draft-wireframes` walks the whole `canon/wireframes/` tree rather than its top level alone, since a collision can sit nested inside a grouped surface's own subfolder.

`standards/wireframes.md` documents only the per-surface ASCII shape. A three-tier framework deciding ASCII-only, ASCII-plus-render, or visual-as-source-of-truth lives in the project-wide visual design workflow guide instead, a once-per-project four-question call rather than a per-draft decision, and `draft-wireframes` reads it from there rather than from the wireframe standard.

`draft-wireframes` reads `canon/DESIGN.md` and the wireframes tree for an existing tier signal and reports what it finds, since no shipped mechanism turns a detected tier 1 or tier 2 into a companion render. Building that mechanism was out of reach for a skill mirroring `draft-docs`, so detecting and reporting is the ceiling rather than a scoped-down version of something more ambitious.

## Whether a skill earns its place

The redundancy audit below runs outward, against community counterparts. Inward, against the catalog's own two zero-cost tells, a folder wrapping something already reachable and a folder nobody calls, `create-skill` asks the first two before a folder exists, and `570-skill.md` carries the same check for whatever creates a `SKILL.md` some other way.

The third question, whether anything invokes the skill beyond the author typing its name, has no answer at creation time. It ships in the skill's own `REQUIREMENT.md` as a review criterion, read against a usage census rather than gated on up front.

### What a verdict requires

A skill carries a verdict when this entry reaches a disposition on it: a table row, a passage stating the reason it stays, or a `## Redundancy audit` line stating keep or borrow against a counterpart. Naming a skill inside another skill's disposition is a mention and settles nothing on its own.

### Reading a usage census

A typed-prompt history and a tool-level transcript record are both per-machine readings rather than repository facts, and reading either one straight risks several traps:

- Sandbox and eval runs inflate anything with a test driving it, in both records. Split a reading by project path to separate harness use from organic use.
- The tool-level record's window is shorter than the typed history's, so recent adoption reads lower there until the window catches up.
- A skill body read by path, rather than invoked through the tool, writes no record in either corpus.
- A one-shot skill (`setup-*`, `migration-*`) can only ever score in the typed record, since every target it acts on was scaffolded before any transcript window opened.
- The census spans whatever machine and project folders it was run against. It is a reading, not a repository fact, and does not reproduce on a second machine or a second pass.
- A skill carrying `disable-model-invocation: true` cannot be reached by a description match at all, so its tool-level number counts explicit hand-offs rather than routing, and its floor is structural rather than earned.
- A skill a sibling body chains carries a tool-level number that counts how often the chain ran rather than how often anyone wanted it specifically. Read it against the typed count of its chain head instead.
- A rename splits a skill's history across two spellings. A rename of the plugin's own prefix (such as the shift from an earlier plugin prefix to `canon:`) splits every skill's history at once rather than one skill's.

A zero or near-zero reading is not the same as nobody reaching the skill. A skill cited by sibling bodies, exercised only by a sandbox arm, or named by a governance rule or docs page can carry real reach with no typed or routed call behind it. Read a census as one input to a conversation about a skill's place, never as a removal list on its own.

### Every skill currently ships

Every folder under `claude/skills/` has been read against `create-skill`'s three questions, and none has failed them: each either has no simpler surface already reaching its moment, or carries a nontrivial procedure worth a body of its own, or both. A skill landing after a given census pass carries no verdict yet by construction, since the pass has nothing to count for a folder that had not shipped, and a later pass closes that gap.

A few load-bearing patterns came out of running the three questions across the whole catalog:

- Four skills, `git-commit`, `git-branch`, `git-pr`, and `git-stage`, each partly overlap a Claude Code built-in, decided by `governance/rules/core/087-git.md`. A project without governance has no such rule, and no seed fallback, since one scaffolded without the plugin carries no `canon:git-*` skills at all.
- `auto-ship`'s ship step invokes `git-ship` directly and states the sequence once, in the body a reader also meets on its own, rather than restating it. The one thing the wrapping chain still adds is marking the pull request as a draft, placed ahead of the CI watch rather than after it.
- A skill reached almost entirely through a chain, such as `memory-capture` or most of the `git-ship` sequence, is not adopted by an operator typing its name. The chain is the denominator its call count measures, not demand, so read such a skill's reach against the typed count of whichever skill heads the chain.
- The most-called skill in the catalog can carry no sandbox arm at all when its reach is already proven by how many chain steps route to it, and a skill with a real sandbox arm and a real citation can still score zero on every usage record. Neither instrument substitutes for the other.
- A skill whose own body forbids merging into a neighbor, on a stated contradiction the merge would create, stays split even when its usage looks nominal next to that neighbor's.

### Redundancy comparisons

A skill with no plausible community counterpart, which covers most of the catalog since it wraps this toolkit's own catalogs and formats, skips a redundancy comparison outright. Where a plausible counterpart exists, the comparison and its outcome are recorded in `## Redundancy audit` below rather than restated per skill here.

## A skill that is not built, and the gate that decides when to ask again

`canon-skill-eval` was proposed as a thin wrapper composing `claude plugin eval`, which is the one runner that scores whether a skill changes behavior rather than whether it conforms. It is not built, and this is where the reason sits, since a session proposing it again reads this entry before it finds a groundwork folder.

The command is gated. `claude plugin eval`, `claude plugin eval init`, and every target spelling refuse with `` `plugin eval` is currently in early access `` at Claude Code `2.1.250`, and the refusal precedes target parsing, so the resolution question the proposal turns on cannot be measured at all. A wrapper shipped against it would refuse in every target whose operator is not enrolled, and the toolkit would own a body whose failure it caused and cannot explain. Building the guard alone is a `README` line wearing a skill folder, which fails `create-skill`'s second question outright, and building a runner here instead is the forked-curation trap `## Workflow skills and domain-knowledge skills` already names.

Read that as a state on a date rather than a verdict. The gate can lift without notice, and the probe that reopens it is `claude plugin validate <path>`, the one ungated surface in the family nobody has run. `.canon/groundwork/47-skill-eval-resolution/` carries the four dropped alternatives and the enrolment question that closed unanswered.

What shipped instead is the half nothing blocks. `canon claude skills rank` and `reach` now read a target's own `.claude/skills/` through `resolveSkillsCorpus`, and `rank --cases` takes a project's own prompts as JSON, so the two live targets carrying 23 skills between them can be measured on routing for the first time. Routing against a project's own vocabulary is the axis no external runner will ever cover, because only that project can pose the question.

## Redundancy audit

Toolkit skills with a plausible community counterpart are compared below. Every one is kept, some have taken a borrowed section from the counterpart, and each taken borrow carries the body it landed in.

- `canon:systematic-debugging` vs `obra/superpowers/systematic-debugging`. Same methodology. Ours is 71 lines to their 296, capturing the four phases, circuit breaker, and red flags in a prose-tight form that matches toolkit conventions. No borrow.
- `canon:review-branch` vs Anthropic's `code-review` plugin. Different scopes. Ours runs on a local branch diff and reads four project docs. Theirs runs on a PR URL with multi-agent fan-out and posts inline comments via GitHub MCP. Added a high-signal filter section borrowed from Anthropic's framing to sharpen severity judgment.
- `canon:ux-audit` vs `impeccable`'s `/audit` and `/critique`. Different lenses. Ours enumerates UI surfaces to find missing states, edge cases, and inconsistencies. `/audit` scores technical quality across five dimensions and `/critique` scores design with Nielsen heuristics.
  - They compose, so run `ux-audit` first to find gaps, then the `impeccable` commands to polish what exists. No skill body change, because third-party skill references belong on this surface rather than in a `SKILL.md` body.
- `canon:plan-feature` vs the `obra/superpowers` planning skills `brainstorming`, `writing-plans`, and `executing-plans`. Different slots. Ours reads the full `.claude/` doc set and produces a structured plan at a coarser grain than the task-atomized `writing-plans`.
  - Plan mode and Ultraplan are positioned separately in `canon/context/claude-plugin/boundaries.md`. No borrow, since the approval gate between plan and implement already covers the clarification case `brainstorming` handles upfront.
- `canon:plan-groundwork` vs `obra/superpowers/brainstorming`. Closest external analogue, different output. `brainstorming` is an upfront clarification conversation feeding straight into a plan, so its product is a better-specified plan.
  - Groundwork produces a durable numbered folder of measurements and rejected options that can legitimately conclude in doing nothing, and it runs before a plan is warranted rather than while one is being written. No borrow.
- `canon:session-worktree` vs `obra/superpowers/using-git-worktrees`, read at 6.1.1. Different premises. Theirs is portable, so most of its 202 lines carry a fallback path for a harness with no native tool, down to an ignore check, a dependency install by ecosystem sniff, and a baseline test run. Ours assumes `EnterWorktree` and spends its 133 lines on what that tool leaves undone.
  - Taken into `session-worktree`'s Guards, and the measurement moved it. Their Step 0 records that `git rev-parse --git-dir` differing from `--git-common-dir` also holds inside a git submodule, and adds `git rev-parse --show-superproject-working-tree` before concluding. That premise does not hold here: at git 2.43.0 an absorbed submodule returns one identical path from both reads, so our first guard never fires and the failure the borrow described has no instance because it cannot occur.
    - What the same command does close is the opposite branch. A submodule passes the first guard, so Step 1 resolves the main root to the submodule, the plan lookup reads a `.canon/plans/` the project never wrote, and entry builds `.claude/worktrees/` inside a tree the superproject tracks as a commit. The guard therefore sits on the matching branch and stops there, naming the superproject.
    - The superproject read is empty in a linked worktree of a submodule and in one of the superproject alike, measured across all four shapes, which is what rules out qualifying the first guard with it. A test that reported a superproject where the paths differ would read a genuine linked worktree as a plain checkout and nest one inside it.
- `canon:ux-measure` vs the user-scoped `web-perf` skill, read at 201 lines against our 110. Same subject and same three thresholds, different premises on every other axis.
  - Theirs requires the `chrome-devtools` MCP server and stops when it is absent. Ours detects a browser MCP server, Playwright, or Lighthouse in that order and refuses to install any of them, which is the detected-rather-than-prescribed decision `## The interface pair splits on the act rather than the subject` records.
  - Three further splits. Theirs traces one load and ours takes the median of three cold readings, on the ground that a single load carries startup noise wider than the gap between two thresholds. Theirs recommends fixes by name and ours reports the reading and stops, since a remedy is a change with its own review. Theirs folds in an accessibility snapshot and a codebase pass, both of which ours lists under `Not measured` and routes to `ux-audit`.
  - Their threshold handling is the one place ours is the narrower design on purpose. `web-perf` retrieves boundaries from `web.dev` at run time and carries seven metrics to our three. Ours pins the published numbers in a table and forbids moving one to fit a reading, so adopting retrieval would contradict that rule rather than extend it. No borrow.
  - Taken into `ux-measure` Step 3 and its report format. Their `CLSCulprits` insight names which elements shifted, where ours reported a CLS number with no attribution. It sits inside our report-and-stop contract because it says where the score came from rather than what to do about it, and the body says so where it lands.
    - Building it measured a rule their version has no need for. Ours takes the median of three readings, so the attribution comes off the run that produced that median rather than merging all three, since merged shares are proportions of a total no run measured.
  - Most borrows found across this audit have been taken: this one, the `session-worktree` submodule guard above, the `auto-ship` Step 7 merge, and the `git-ship` verify gate below, plus the `git-worktree` path-prefix borrow read as a data-loss shape wanting its own verification. The `review-address` push-back borrow is the one still standing, a repair that edits a skill body no verdict pass has opened.
- `canon:auto-ship` vs `obra/superpowers/executing-plans` and the `finishing-a-development-branch` it requires. Different products. Theirs walks plan tasks against a todo list and closes by handing the operator a merge, PR, or cleanup menu. Ours closes on a draft pull request with CI polled and offers no menu.
  - No borrow. The middle of our chain has no counterpart at all, being a classifier that decides whether review runs from a prose-against-behavior-path test and a triage splitting findings by origin. `executing-plans` opens by critiquing the plan, and this toolkit takes that at the `plan-feature` approval gate ahead of autoship.
  - What the comparison did surface is ours against itself. Step 7 restated `git-ship`'s sequence item for item, differing only in the draft marking and the numbering, and the merge recorded against this skill lands in the `git-ship` bullet below where the kept copy now lives.
- `canon:git-ship` vs `obra/superpowers/finishing-a-development-branch`, read at 6.1.1. Same moment, opposite postures. Theirs detects the workspace state and presents a four-option menu covering merge, pull request, keep, and discard, with a typed confirmation guarding the destructive one. Ours runs a fixed nine-step sequence, closes on an open pull request with CI polled, and offers no menu.
  - The menu is the split rather than a section either side could adopt. A project on this toolkit answered the integration question at the plan-to-execute boundary, where `session-worktree` opens a branch that exists to become a pull request, so a skill asking again at the end reopens what a written artifact already settled. Theirs runs where no such artifact exists.
  - Two halves of theirs have no counterpart here and belong elsewhere if anywhere. Worktree cleanup with its provenance check is `git-worktree`'s subject, and the discard path is a destructive operation this chain declines to offer at all.
  - Taken as `git-ship`'s `## Verify` section. Their Step 1 refuses to present any option until the project's test suite passes, where our chain ran no verify of its own before this: `auto-ship` verified at its Step 3 and then handed several stop points back to `/git-ship`, which reached the remote without re-running anything, so a manual fix after a verify stop could ship unverified.
    - A project naming no verify command says so and continues, since a stop there would refuse every target without a suite. Verification is the one of the requirement's rules that belongs on both bodies, because a resume point trusting the caller's verify trusts a run that stopped.
  - `git-ship` keeps the chain and `auto-ship`'s ship step invokes it rather than restating it, on the argument that `git-ship` is reachable on its own where that step is reached only inside the chain, so the body a reader meets alone is the one that should be complete. The draft marking is what the step keeps, placed ahead of the CI watch rather than after it, because a pull request marked afterward is mergeable for the length of the run.

### Orchestration and review counterparts

- `canon:role-orchestrator` vs `obra/superpowers/dispatching-parallel-agents` and the `subagent-driven-development` beside it, read at 6.1.1. Same subject, opposite mechanism. Both of theirs delegate to in-process subagents and spend most of their length on constructing the context each one gets, since a subagent inherits nothing and is reached only through its final report.
  - Ours dispatches a separate `claude --bg` process holding its own worktree and its own pull request, and forbids the Agent tool outright. `.claude/ARCHITECTURE.md` records why under the dispatch boundary: independence, being steerable, and a worker's own pull request are the properties, and a subagent carries none of them.
  - No borrow, and the reason is that the halves do not correspond. Their prompt-construction sections exist because a subagent starts empty, and a dispatched session reads the plan file instead. What ours carries that theirs has no room for is the collision check composing a worktree listing, a session roster, and the refs already naming the branch.
- `canon:review-pr` vs `obra/superpowers/requesting-code-review` and Claude Code's own `/code-review`. Two counterparts at one moment, and the built-in is the closer of them.
  - Theirs dispatches a reviewer subagent and returns findings into the requesting session, which is the shape `## Review travels on the pull request` in `.claude/ARCHITECTURE.md` declines: a finding that lives in one session dies with it, and an orchestrator and worker pair outlive neither. Ours posts to the pull request so the record survives both.
  - `/code-review` is the live overlap. It takes a pull request target, `--comment` posts findings as inline comments, and `ultra --post` posts a finished review as one comment from the operator's account. `boundaries.md` documents the built-in against `review-branch` and names `review-pr` nowhere, so the entry describes the wrong pair. Recording that gap is this pass's finding, and closing it edits a context entry rather than a skill body.
  - What still separates ours is the re-review contract. A first pass reads the whole change, every later pass reads only the commits added since, the heading moves from `## Review` to `## Review closed` when a pass carries no finding, and a close-out that repeats one already standing is refused. No borrow.
- `canon:review-address` vs `obra/superpowers/receiving-code-review`, read at 6.1.1. Same moment, different kinds of document. Theirs is a posture: forbidden responses, how to handle unclear feedback, and how to correct a pushback that was wrong. Ours is a procedure: pull the findings and CI status, fix, verify, refresh stale docs, rebase, push, reply, confirm resolution.
  - They compose rather than compete, so a session can hold both and neither section duplicates the other. Ours has one line where theirs has a chapter, being the note that a finding may be a question or a conscious-accept and answered in the reply rather than by editing.
  - One borrow stands, not yet taken. Their `## When To Push Back` states six criteria for declining a finding, and ours states that a declined finding carries the fact that settled it without saying when declining is right. That is a judgment inside our existing reply path rather than a new step, so it fits and awaits a pass that opens the skill body.
- `canon:git-worktree` vs the Step 6 cleanup inside `obra/superpowers/finishing-a-development-branch`, read at 6.1.1. The `session-worktree` comparison above parked worktree cleanup as this skill's subject, and this is the pass that reads it. Different scopes at different moments.
  - Theirs cleans the one worktree the session sits in, at the end of one branch, and only for two of its four options. Ours enumerates every worktree in the repository at any time, resolves each branch's merge state through `gh` with a local-ancestry fallback, and removes the merged set in one batch.
  - Taken as a fourth enumeration test. Theirs tests the worktree path against a known prefix before removing anything and leaves a workspace the harness owns in place. Ours guarded on merge state, cleanliness, and the current-worktree exclusion alone, so `git worktree list` reporting every worktree could put a merged clean tree an operator added by hand elsewhere on disk inside the remove set, its branch following under `branch -D`. A non-main row whose path sits outside `<MAIN_ROOT>/.claude/worktrees/` now reads as `foreign` and joins the skip set with that reason, in `list` and `cleanup` both.

## Reading the catalog for overlap rather than for size

A catalog-size trim is answered by the marketplace subset lever instead of a cut: `canon/context/claude-plugin/distribution.md` carries the result, where a curated marketplace root holding one symlink per kept skill loads a handful of skills at a fraction of the always-on token cost of the full plugin. A trim measured by catalog size reaches that lever at a cost already paid, which is what an overlap read answers instead.

The one job-duplication candidate an overlap read across the catalog has found is `git-commit` inside `git-stage`. That pair fails the merge on a behavioral difference neither description states on its own: `git-stage` clears the stage and restages whole files, destroying the hunk-level selection `git-commit` preserves.

Every other pair that reads as overlap is a declared boundary or a wording collision rather than genuine duplication.

The four `migration-*` skills are not dead weight behind an unfinished migration. Each proposes a per-project structural move and applies none of it, so the job closes for a target that has taken it and stays open for every target that has not. No global finished state exists for a completed migration to reach, since a project scaffolded later arrives holding whatever layout it was scaffolded with. What retires one is its destination ceasing to be legitimate, which is what happened to `migration-standards` when the snippets install channel closed, a different event from a migration finishing.

Every folder under `claude/skills/` carries a verdict, a table row or a stated disposition, or a mention with no disposition of its own. `role-worker`, `role-planner`, and `repo-metadata` are three that answer question 1, whether a rule, a verb, or an existing skill already reaches this moment, with no: each asserts a role, a repository metadata proposal, or a channel obligation nothing else in the catalog covers.

`setup-smoke` sits beside `setup-verify` in one chain and reads a disjoint `scripts` block through the same declared-scripts contract, which is what makes it worth its own folder rather than a mode on its neighbor: a leaf script is judged by its exit code and a server has to be judged by whether it starts and stays up, a different procedure.

Two further candidates surfaced through queued additions carrying an overlap their own filing already found and answered by building anyway. A standalone TDD skill overlapping `auto-ship` was answered by adding `canon gov test-order` as an autoship step and building `test-first` as its own skill, since the rule already loads every session and the verb already reports while a red-green loop is a separate procedure the autoship step does not carry. A recording skill overlapping `draft-screencast` was answered by keeping the two separate, since a second skill re-reading a draft it did not write is the risk the split declines.

`test-first`, now shipped, does not restate the autoship step: its body carries the red-green loop and the autoship step carries a history read, so the overlap the filing predicted did not arrive. The boundary that mattered turned out to be against `systematic-debugging` rather than against the autoship step, since both write a test before a change and only one starts from a failure nobody has explained.

`wiki/claude/claude-skills.md` covers the Claude Code skill feature itself, and `docs/workflow/visual-design-workflow.md` is the worked example of per-workflow skill recommendations.

## The identity surface, and one pick settles the mark and its card together

`draft-identity` covers a project's logo mark and the social card composed from it, reached through `draft-and-pick`'s own render-and-pick loop rather than a second implementation of one. Before it existed, a project reaching for either output had nothing to reach for and redid the work by hand each time.

The name passed over two candidates. `logo` names one of the two outputs and leaves the card unaccounted for, and `assets` collides twice, with `canon capture`'s own `DEFAULT_SOURCE = 'assets'` and with this repository's top-level `assets/` folder of README captures. It takes the `draft-` prefix, joining `draft-screencast` and `draft-slides`, since the bare-word rule the rest of `SKILL_NAME_MAP` follows applies here too: it writes candidates to scratch and a final deliverable outside `.claude/`, so it is neither a Claude workflow surface nor a toolkit-subject skill, and a prefix-free name would misstate that.

One skill covers both outputs rather than two. The mark and the card are one identity rendered twice, and two skills each reading the other's pick can settle on shapes that do not compose. Drafting every arm already inside the card frame is what makes that real rather than aspirational, since the pick settling the mark's shape settles its composition in the same choice.
