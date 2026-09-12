---
title: Agents
subtitle: CLI catalog and invocation rules for agents, split by command domain. Start with overview.
category: Agent surface
---

# Agents

CLI catalog and invocation rules for agents, split by command domain. Start with overview.

- [Audits](audits.md): Running every health check as one set, what the single verdict means, the exit code each outcome takes, the retained baseline and the delta it reports, and which corpora are kept out of the record
- [Capture](capture.md): Rendering HTML sources to PNG, what the command asserts about fonts, and why the selector has no default
- [Census](census.md): Tracked-plus-untracked file count, a breakdown by extension, and a line total that skips whatever reads as binary
- [Command catalog](commands.md): Every project-level command and every domain subcommand, plus the shape each domain exposes
- [Comments](comments.md): Comment density by language and kind, the two structural exclusions, and how the degradation sweep finds its vocabulary
- [Context audit checks](context-audit-checks.md): What each non-gating check reports, the unit each checkpoint is measured in, the architecture record's length gate and claim coverage, which folders each check reaches, and what moved to the attribute tier
- [Context audit](context-audit.md): Running the audit, its flags and folder scope, the exit codes, the citation gate, and the widened gate the seed stage runs
- [Self-stated counts](counts.md): Reading a sentence that asserts a closed catalog's size, how a match is decided, the plausibility filter that keeps a generic word from matching a subset, and why the sweep reports rather than gates
- [Demo](demo.md): Compiling a screencast draft into a runnable plan, driving a served application to a recording and a still, reading numbered frames back out of a recording, the pointer the recording paints, and what each refusal reports
- [Docs](docs.md): How canon docs resolves the toolkit's own reference surface from an install root, and how a split domain is named
- [Driver](driver.md): Walking a page through named interactions, the probe catalog and the false finding each one carries, why viewport heights are never defaulted, and what each refusal reports
- [Merge gate](gate.md): Running the gate this repository verifies a branch with, what the stage table holds and what stays a script, how the changed set scopes three stages, and why a stage that cannot read its input reports rather than passing
- [Indexes](indexes.md): Flags, exit codes, and JSON shape for canon indexes regen and canon indexes list, plus when regen auto-stages what it rewrote
- [Install and sync](install-and-sync.md): What each install and sync verb writes, refuses, or leaves alone, and how drift is attributed in a target project
- [Intake](intake.md): Reading intake folder counts and items, the three read states an item can be in, landing a batch of selections in one cluster, the refusal reasons, and why a call is scoped to one file
- [Key Changes bijection](key-changes.md): Comparing the files a pull request body's Key Changes names against its own diff, the two directions and the split inside each that decides what is worth raising, the span rules the extractor was measured into, and the three refusals that separate a clean pass from a read that produced nothing
- [Label coverage](label-coverage.md): Reading a changed set against the pull request label map, the two tables it matches, how a gap is separated from a decision, and why an absent map is an answer
- [Markdown audit](markdown-audit.md): Running the audit over any markdown path, where its bans and checkpoints are read from, what each check reports, and why the ban half gates while the structural half reports
- [Output shape](output-shape.md): Two framed shapes every command renders into, how JSON and --names modes keep stdout clean, and the exit discipline that lets piped output drain
- [Overview](overview.md): What this folder covers, the invocation rules every command inherits, and where domain behavior is documented instead
- [Head-sensitive pull request reads](pr-reads.md): Resolving a branch tip from the remote rather than from the pull request object, reading what a review pass covered off its own marker rather than off GitHub's submission stamps, why an empty run list is not a pass, the refusal reasons each verb names, and what the remote read costs
- [Records](records.md): The two roots a record folder resolves at, validating the session records and the standards corpus, the per-kind checks, the refusal reasons, migrating a record a frontmatter change orphaned, claiming the ordinal intake and groundwork share, reading each folder's size and growth, backing the folders to a private remote, and which root each kind defaults to
- [Restated instructions](restated.md): Counting the instructions the always-loaded file and every path-scoped rule share with the seed, the shipped skill bodies, and each other, how a match is decided, the three classes, which surface a later edit starts from, and why the sweep reports rather than gates
- [Review classification](review-classification.md): Deciding whether a changed set needs the review pass, the two tests it runs, why an empty set refuses rather than skipping, and the written fallback a target on an older binary falls back to
- [Routing report](routing.md): Reading per CLAUDE.md section how many bullets name a path, what counts as naming one, when a rule counts as covering it, the two refusals, and why the verb reports rather than gates
- [Rule citations](rule-citations.md): Resolving every path a governance rule cites and every frontmatter glob the internal corpus declares, the three forms a citation is written in, the shapes that look like citations and are not, the two classes where an absent path is correct, why the glob half reads one corpus, and why this one gates
- [Sandbox](sandbox.md): Scenario routing, the expectation scoring surface, and the coverage census over scenarios and skills
- [Scripting](scripting.md): The runtime catalogs that replace hardcoded names, what each carries, and a headless invocation per domain
- [Sessions](sessions.md): Resolving live peer sessions to the worktree and branch each holds, reading which row is the caller, the liveness confidence field, and what each session surface can see
- [Skill audit](skills-audit.md): Measuring both skill corpora against standards/skill.md, the checks it reads, the requirement gate that is the only failing one, and the drift verb that names bodies rewritten since a ref
- [Citation reach](skills-reach.md): Reporting the skill bodies that cite a path no target project receives, which corpus the verb reads, the ownership key that decides what counts, the one-word qualifier that marks a citation as decided, and why the verb reports instead of gating
- [Standard success criteria](standards-audit.md): Reading the corpus against the success-criterion gate, the two headings it accepts, why the check scopes to arrival rather than the whole corpus, and the exit codes it sets
- [State-scoped risk](state-scoped-risk.md): Reading committed state rather than an arriving change, the shipped-tree corpus the secret scan reads, what it keys on and how a deliberate value is exempted, the advisory check and its network failure mode, and why one gates while the other reports
- [Superseded values](superseded.md): Reading where the tree still asserts a value a changed convention no longer produces, why the sweep keys on the value rather than the file, the family stem behind a templated citation, the exemption marker, the blind spots it cannot reach, and why it reports rather than gates
- [Targets](targets.md): The projects this toolkit installed into, the record the install writes against the sweep that backs it, what bounds each answer, and the cross-target pull request read
- [Tasks](tasks.md): Selecting a shipped task by stem or pull request, recording a number and closing an outcome, deriving the branch a dispatch and a worker both take, the refusal reasons, the board and backlog checks validate runs, and why the board root defaults to the main worktree
- [Teach](teach.md): Listing learning workspaces with what their records schedule next, opening one with its required files, recording sources and glossary terms, resolving what the next lesson needs before it is written, rewriting the root listing, a contents page, and each lesson's chrome and quiz stepper from its marker regions, the refusal reasons, and why every write here runs through a verb
- [Test order](test-order.md): Reading where an implementation reached history ahead of its test, how a pair is decided, the three verdicts, the coverage the pairing cannot reach, and why the check reports rather than gates
- [Worktrees](worktrees.md): Reporting which worktrees are reclaimable, removing the ones that are, the record a hook reads back, why the reading keys on the pull request rather than on git ancestry, the refusals it names, and the two removal shapes
