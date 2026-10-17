---
title: Agents
subtitle: CLI catalog and invocation rules for agents, split by command domain. Start with overview.
category: Agent surface
---

# Agents

CLI catalog and invocation rules for agents, split by command domain. Start with overview.

- [Audits](audits.md): Running every health check as one set, what the single verdict means, the exit code each outcome takes, the retained baseline and the delta it reports, and which corpora are kept out of the record
- [Canvas](canvas.md): The canvas server, its content format, and the verbs that list, arrange, fit, select, edit, mark, and capture frames
- [Capture](capture.md): Rendering HTML sources to PNG, what the command asserts about fonts, and why the selector has no default
- [Census](census.md): Tracked-plus-untracked file count, a breakdown by extension, and a line total that skips whatever reads as binary
- [Comments](comments.md): Comment density by language and kind, the two structural exclusions, and how the degradation sweep finds its vocabulary
- [Context audit checks](context-audit-checks.md): What each non-gating check reports, the unit each checkpoint is measured in, the requirements record's word cap, which folders each check reaches, and what moved to the attribute tier
- [Context audit](context-audit.md): Running the audit, its flags and folder scope, the exit codes, the citation gate, and the widened gate the seed stage runs
- [Doc classifier](context-classify.md): Classifying canonical-doc content as keep, replace/rewrite, history, or move in diff and sweep mode, the classifier setting pair, the record shape, and the exit codes
- [Self-stated counts](counts.md): Reading a sentence that asserts a closed catalog's size, how a match is decided, the plausibility filter that keeps a generic word from matching a subset, and why the sweep reports rather than gates
- [Demo](demo.md): Compiling a screencast draft into a runnable plan, driving a served application to a recording and a still, reading numbered frames back out of a recording, the pointer the recording paints, and what each refusal reports
- [Driver](driver.md): Walking a page through named interactions, the probe catalog and the false finding each one carries, why viewport heights are never defaulted, and what each refusal reports
- [Merge gate](gate.md): Running the gate this repository verifies a branch with, what the stage table holds and what stays a script, how the changed set scopes three stages, and why a stage that cannot read its input reports rather than passing
- [Indexes](indexes.md): How canon indexes regen and canon indexes list resolve paths, what they stage, and the record and exit codes each emits
- [Install and sync](install-and-sync.md): What each install and sync verb writes, refuses, or leaves alone, the drift report and its seven side sections, the rule detection record, and version skew states
- [Label coverage](label-coverage.md): Reading a changed set against the pull request label map, the two tables it matches, how a gap is separated from a decision, and why an absent map is an answer
- [Markdown audit density](markdown-audit-density.md): The six layout limits the markdown audit measures, what each one counts, which paths take a finding, and how a folder's gate turns on
- [Markdown audit weight](markdown-audit-weight.md): The advisory sections of the markdown audit, being bullet and paragraph weight, run depth, the two cadence numbers, and the length ceiling, with the samples behind each checkpoint and which of those numbers gate through density
- [Markdown audit](markdown-audit.md): Running the audit over any markdown path, where its bans and checkpoints are read from, what each check reports, how a reference page opts into its shape check, and why bans, dead links, and density or reference shape on a gated path fail while the rest reports
- [Migrate](migrate.md): What each canon migrate verb moves, the markers that keep an old spelling, and what each one refuses
- [Output shape](output-shape.md): The framed output shape every command renders into, the JSON and color modes, the exit discipline, the runtime catalogs, and a headless invocation per domain
- [Overview](overview.md): What this folder covers, the invocation rules every command inherits, and how canon docs resolves a topic name
- [Records](records.md): Backing the record folders to a private remote, restoring them on a new machine, reading folder size, and pruning stale scratch
- [Restated instructions](restated.md): Counting the instructions the always-loaded file and every path-scoped rule share with the seed, the skill bodies, and each other, how a match is decided, the three classes, which surface a later edit starts from, and why the sweep reports rather than gates
- [Routing report](routing.md): Reading per CLAUDE.md section how many bullets name a path, what counts as naming one, when a rule counts as covering it, the two refusals, and why the verb reports rather than gates
- [Rule citations](rule-citations.md): Resolving every path a governance rule cites and every frontmatter glob the internal corpus declares, the one form a citation is written in, the shapes that look like citations and are not, the two classes where an absent path is correct, why the glob half reads one corpus, and why this one gates
- [Sandbox](sandbox.md): Scenario routing, the expectation scoring surface, and the coverage census over scenarios and skills
- [Sessions transfer](sessions-transfer.md): Moving a session to another machine with export and import, the manifest fields, the refusal reasons, and what a resume on the target depends on
- [Skill audit](skills-audit.md): Measuring both skill corpora against the skill standards, the checks it reads, the requirement gate that is the only failing one, and the drift verb that names bodies rewritten since a ref
- [Citation reach](skills-reach.md): Reporting the skill bodies that cite a path no target project receives, which corpus the verb reads, the ownership key that decides what counts, the one-word qualifier that marks a citation as decided, and why the verb reports instead of gating
- [Slides](slides.md): Where a deck folder lives and what it holds, what it declares for the whole deck in deck.json, the faces it embeds, what each slide declares on its own body, transitions and entrances, the master built from the project's tokens, speaker notes, charts, and what each refusal reports
- [State-scoped risk](state-scoped-risk.md): Reading committed state rather than an arriving change, the shipped-tree corpus the secret scan reads, what it keys on and how a deliberate value is exempted, the advisory check and its network failure mode, and why one gates while the other reports
- [Superseded values](superseded.md): Reading where the tree still asserts a value a changed convention no longer produces, why the sweep keys on the value rather than the file, the family stem behind a templated citation, the exemption marker, the blind spots it cannot reach, and why it reports rather than gates
- [Targets](targets.md): The projects this toolkit installed into, where each answer comes from, and the cross-target pull request read
- [Teach authoring](teach-authoring.md): Resolving what the next lesson needs before it is written, rendering a lesson body's blocks to HTML, and rewriting the root listing, a contents page, and each lesson's chrome and quiz stepper from its marker regions
- [Teach](teach.md): Listing learning workspaces with what their records schedule next, opening one with its required files, recording sources and glossary terms, viewing one with its chrome refreshed, where the lesson authoring verbs are described, the refusal reasons, and why every write here runs through a verb
- [Test order](test-order.md): Reading where an implementation reached history ahead of its test, how a pair is decided, the three verdicts, the coverage the pairing cannot reach, and why the check reports rather than gates
- [Upstream](upstream.md): The fetch, catalog, due, and advance verbs that read Claude Code releases against the toolkit, the cursor record, and each refusal reason
