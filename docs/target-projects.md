---
title: Target projects
description: Scaffold, add domains later, and sync upstream drift in a toolkit-managed project
category: Agent surface
---

# Target projects

How a project outside this repo consumes the toolkit across its lifecycle. Three phases: scaffold once, add a domain later when a new need appears, and sync when the upstream toolkit moves.

This doc stays at the narrative layer. For command flags and JSON shapes, see [agents](agents/index.md). For per-domain mechanics, see each `.claude/context/<domain>.md`.

## Getting the skills

The skills reach a session through a marketplace install, once per machine. Every session on that machine carries them afterward, and the installed copy stays at the version it was installed at. Claude Code ships auto-update off for third-party marketplaces, so neither a push nor a release reaches that copy until someone refreshes it with `claude plugin marketplace update canon` followed by `claude plugin update canon@canon`, or turns auto-update on once under `/plugin`. The `canon` CLI moves on its own schedule through the registry, so a machine can hold current skills against a stale CLI or the reverse.

```bash
claude plugin marketplace add https://github.com/erclx/canon
claude plugin install canon@canon
```

The URL form clones over HTTPS. The `erclx/canon` shorthand resolves to SSH and fails on a machine with no key configured.

A machine that installed the plugin under its previous name re-registers by hand, once. The marketplace and the plugin both moved, so the old `enabledPlugins` entry and the old marketplace key name things that no longer resolve, and the plugin stops loading without reporting anything. `canon migrate rename` does not reach this: it takes a `--root` and rewrites inside one project, where the plugin registration is machine-level state outside every project.

Both stale keys come out explicitly, since installing under the new name writes a new entry and leaves the old one sitting there. Uninstall before removing the marketplace, so the plugin is cleared while the marketplace it came from still resolves.

```bash
claude plugin uninstall aitk@aitk
claude plugin marketplace remove aitk
claude plugin marketplace add https://github.com/erclx/canon
claude plugin install canon@canon
```

The `canon` CLI is separate. Twenty skills invoke it in a command position, and a marketplace install does not put it on `PATH`, so it installs from the registry as its own step.

```bash
bun install --global @erclx/canon
```

The package ships the catalogs the CLI reads, not only `src/`, so `canon init` resolves governance, tooling, and the seeds from wherever the package landed, and `canon standards <name>` reads the corpus from there too.

Pointing Claude Code at a checkout stays the development path, where a local skill edit overrides the installed copy for that session.

```bash
claude --plugin-dir <toolkit>/claude
```

## Scaffold

Two steps, in order:

1. Run the framework's own scaffold if the project needs one, such as `bun init`, `npm create vite`, or `npm create astro`. The toolkit does not wrap framework scaffolding.
2. Invoke `canon:setup-init` in Claude Code. The skill detects the stack, resolves flags, previews the full chain, and runs it end-to-end.

The chain is:

- `canon init` installs base tooling, Claude seeds, and governance rules into `.claude/rules/` in the same pass
- `canon tooling sync <stack> --write` adds stack-specific deps, scripts, and gitignore entries
- The agent reads `canon tooling reference <stack>` (plus parents) as its audit context, follows it to generate eslint, vitest, playwright configs and the stack's setup script, and extends `.claude/context/ci.md` and `.claude/context/development.md` per the reference's extend sections <!-- audit-ignore-citations: .claude/context/development.md -->
- `setup-verify` runs the installed `package.json` scripts (lint, typecheck, check, test, build) and reports pass or fail
- `setup-indexes` bootstraps the `index.md` system over the project's own documentation folders, confirming candidate folders with the operator rather than running unattended

The chain stops at the project edge. `repo-metadata` and `git-commit` also ship, reaching a remote and the project's history respectively, and neither runs as part of it. The chain serves a fresh scaffold and names a destination for the three states it does not. An existing project goes to `canon:canon-operator`, which reads what the project already carries before naming a per-domain command. An install wanting the Claude layer without the tooling chain runs `canon claude init` for the seed docs and then `canon:setup-indexes` for the index system. A language the toolkit ships no stack for is the one of the three the chain still runs for, on `base`, with the fallback marked in the preview so it can be declined there.

Run `canon:setup-smoke` by hand once `setup-verify` passes, for the heavier server smoke, end-to-end, and screenshot pass, since the same flakiness reasons that excluded those stages from `setup-verify` keep it out of this unattended chain too.

Keep the `## Scripts` table in `.claude/context/development.md` current as scripts are added. Base tooling seeds that entry with the commands it installs, and each stack reference extends the table. `project-commands` reads it to start the app or run a check on request, so a command missing from the table cannot be run that way. A project whose entry outgrew one file and split into `.claude/context/development/` keeps the table in `overview.md`, which is where the skill looks next. <!-- audit-ignore-citations: .claude/context/development.md -->

### From scaffold to first feature

Scaffold installs tooling and seeds. It does not fill the planning docs or the design system. Complete those before the first feature session:

1. Fill `.claude/REQUIREMENTS.md` and `.claude/ARCHITECTURE.md`. The seed provides the files, the scope and decisions are yours to write.
2. For a UI project, invoke `canon:design-extract` to draft `.claude/DESIGN.md`. With no UI code yet it takes the greenfield path and proposes tokens from the requirements and a `## Personality` section. Skip for non-UI projects.
3. Optionally invoke `canon:draft-diagram` to draft entries under `.canon/diagrams/` from the architecture and the requirements. One file per diagram kind, so a later refresh of one kind leaves the others untouched. It renders each diagram it writes to verify the layout, which downloads the Mermaid CLI on first use and takes about 15 seconds.
4. Start the feature loop. See [AI workflow](workflow/ai-workflow.md) for the per-feature sequence.

A machine without a renderer still gets the diagrams and is told which check was skipped.

Each diagram entry records the commit and date it was last verified against, and nothing maintains that record for you. The folder is redrawn on demand rather than swept on every ship, so `verified` carries the whole signal: an entry whose date sits far behind your branch is due a read, and no pass will name which one. Run `canon:draft-diagram` again when the code a kind is drawn from moves.

`.claude/ARCHITECTURE.md` carries the same mechanism on the same ship. `canon:docs-fold` anchors a decision it amends to the paths that decision cites, and reports an anchored decision whose cited path the branch touched.

### Stack decision

The default path is `base`. `canon init` on `base` installs base tooling configs, Claude seeds, and governance core rules, and scaffolds an empty `.claude/wiki/`. Most projects need nothing more.

Escalate only for real web apps. The `setup-init` skill reads `package.json` and root configs, then picks the matching tooling stack (`canon tooling list --json` names the current set) and the matching governance stack (`react`, `astro`, `node`).

`node-server` is named rather than detected. It carries the server-side security and persistence rules for a project writing request handlers or a persistence layer in TypeScript, and the detect step matches a runtime or a framework against stack names, so nothing there marks a project as a backend. Pass it deliberately with `canon init --stack node-server` or `canon gov install node-server <target>`.

Markdown-heavy projects, CLI tools, docs sites, research notebooks, and scripting repos stay on `base`. Escalation is a ceiling move, not a default.

A project the toolkit ships no stack for lands on `base` the same way, and the skill marks that resolution as a fallback in its preview rather than reporting it as a match. Configs, seeds, and gitignore entries land either way, and the JavaScript development dependencies, scripts, and hook activation land only where a `package.json` exists to carry them. A project outside that ecosystem declines at the preview and takes `canon:setup-gov` for the governance layer alone, which is language-neutral.

Run `canon tooling list --json` and `canon gov list --json` to see the current catalogs. Never hardcode stack names.

### Core domains and skips

`canon init` installs base tooling, Claude workflow, and governance, and scaffolds `.claude/wiki/`. Governance defaults to the `base` stack, so a bare init carries the rules that route a project. Pass `--stack <name>` to install a framework stack instead.

No standard is written into the project. Each governance rule's authority line names `canon standards <name>`, which answers from the corpus inside the CLI's own package, and every toolkit skill names the copy in its own plugin root. `canon markdown audit` needs no standard at all, its ban sets and checkpoints shipping with the package as data.

No snippet is written into the project either. `claude/snippets` in the plugin cache symlinks to the toolkit's own `snippets/`, so a session reaches one at its `@` reference with no install step, the same live resolution `claude/standards` gives a rule's authority line.

`governance` and `wiki` are skippable:

- `--skip governance`: leave `.claude/rules/` empty, so no coding standard loads on a file match. The preview names any `--add` rules the skip drops, and the run prints the `canon gov install <stack> <path>` command to add rules afterward, carrying those extras so one paste restores what the skip declined.
- `--skip wiki`: skip the `.claude/wiki/` scaffold. A target that already carries a root `wiki/` keeps it, since the verb reports that folder rather than migrating it.

The plugin corpus carries runtime behavior rather than reference prose alone, because the pre-publish scan and the branch-slug transform each have a standard of their own, `publish.md` and `slug.md`, cited by the skills that run them.

## Add a domain later

When a new need appears after scaffold, install the one domain without re-running `canon init`.

- Governance rule for a newly adopted library: invoke `canon:setup-gov`, or run `canon gov install <stack> --add <rule> <path>`
- Project-specific rule the toolkit does not ship: invoke `canon:create-rule`. It scaffolds a rule into `.claude/rules/` with a non-colliding number, and `canon gov sync` leaves it untouched.
- Index.md system for a markdown-heavy folder that emerged: invoke `canon:setup-indexes`

Standards and snippets are not on that list, and there is nothing to add for either. Neither installs into a project, by default or by flag, so a session reads a standard with `canon standards <name>` and a snippet through its `@` reference off the live plugin symlink, both resolving against the toolkit rather than a project copy. A project holding a `.claude/standards/` or `.claude/snippets/` folder from an older toolkit is carrying a stale artifact nothing reads, and deleting it is safe.

Per-domain mechanics live in the corresponding `docs/<domain>.md`. The skill body in `claude/skills/<skill>/SKILL.md` covers detection and preview.

## Sync upstream drift

When the toolkit updates, target projects pull changes per domain. There is one catch-all and several targeted entry points.

### Move the records first, once

Session records moved out of `.claude/` and into a root of their own. What is committed stays where it is, and everything gitignored, being the task board, the plans, the memory pen, the review reports, and the scratch folder, now lives under `.canon/`, which a single ignore entry covers.

`4.7.0` carries `canon migrate records`, so run these three lines from inside the project. Run `canon upgrade` first regardless of what you hold, since the sweep learned to pass over the records themselves after that release and a `4.7.0` binary rewrites them.

```bash
canon tooling sync claude . --write
canon migrate records --json
canon migrate records --write --json
```

The first line takes the `.canon/` ignore entry, and the verb refuses until the project has it, since every folder it relocates is ignored where it stands and landing one under a tracked root commits the memory pen. The second reports the plan and the third applies it, moving the folders and repointing every tracked file that cites one.

Order matters between the first line and the two under it. The sync prunes the twelve old `.claude/` ignore entries down to the one `.canon/` line, which leaves every record still at the old root visible to git and therefore to the verb. The sweep passes over them on purpose, reporting a count of what it left alone rather than reading the memory pen and the groundwork trails as source.

### Back records up off this machine, once

Moving records under `.canon/` relocates them, and relocating them is not the same as backing them up. Run `canon records push` once a private repository exists for them, and it prints the one-time setup command when it finds none, since the task board, the memory pen, and the groundwork trails otherwise live on one disk with nothing pushing them off it. `canon init` prints the same reminder as a notice-only step rather than trying to run this non-interactively, since the private repository does not exist yet at scaffold time.

Read the `ok` field out of the `--json` record rather than the exit code. A shell profile that wraps `canon` in a function takes its status from whatever the function runs last, so an absent subcommand and a clean run can both exit 0, and a reader watching the exit alone concludes the move happened.

A tracked file that names an old record path on purpose, such as prose dating a decision, keeps it by carrying `canon-keep-record-root` on that line or the nearest non-blank line above. The report pass prints every file it would rewrite, which is where to catch one before `--write` runs.

Until the move runs, the project is exposed. The shipped ignore set no longer names the old record paths, so a project holding records at `.claude/` stops ignoring them on its next `canon tooling sync`, and the first sign is a memory file or a task board appearing in a commit. Every command reads either root, so nothing else breaks in the meantime, and running the move is what closes it.

Then sweep the records themselves, which the three lines above never reach. They enumerate through git, and the records are gitignored by construction, so a task still naming its plan at the old root resolves nothing once the folders move.

```bash
canon migrate record-tree --json
canon migrate record-tree --write --json
```

This is a separate step rather than a fourth line in the block above because the move has to land before there is a new root to walk. The scope is the folders a session still follows a path into, being `diagrams`, `memory`, `plans`, `proposals`, `review`, `tasks`, and `teach`, each minus its own `archive/` subtree. A closed groundwork or intake trail, the scratch folder, and the backup history are counted and left alone, since a path inside one of those sits in a sentence about work that already ended.

Read the report before `--write` here more carefully than above. The record tree is untracked, so a wrong rewrite has no git undo, and the report names every citation with its line number and the line text for exactly that reason. The same `canon-keep-record-root` marker protects a line that has to keep the old spelling.

### Move rules off the flat layout, once

Installed rules moved from a flat `.claude/rules/<subdir>/` layout to `.claude/rules/canon/<subdir>/`. A project that installed governance before that release still holds the flat layout, and neither of the two governance verbs below notices: `canon gov sync` reports `No governance surfaces found in target` and exits 0, and `canon gov install` lands a second, wrapped copy beside the stale one rather than replacing it.

Run `canon upgrade` first if you have not, then run this from inside the project:

```bash
canon migrate rule-layout --json
canon migrate rule-layout --write --json
```

The first line reports the plan and the second applies it, relocating each rule and carrying an edited one's recorded hash forward so it still reports as edited on the next sync rather than reading clean. Run it once, ahead of `canon gov sync` or `canon gov install`, on any project scaffolded before this move landed.

### Rename the skill citations, once

Twenty-five plugin skills dropped their `claude-` prefix for two-word names, so `canon:docs-fold` answers as `canon:docs-fold` and `canon:task-board` as `canon:task-board`. A project that installed governance or tooling before that release holds files naming the old ones, and the plugin answers to none of them.

Two of those files run rather than sit there. `.husky/post-merge` prints a command for a person to type, and `.claude/hooks/pr-create-log.sh` hands a session a message naming a skill, so a stale copy tells someone to invoke something that no longer exists. A rule under `.claude/rules/canon/core/` names skills too, though a rule is read rather than run.

Resync what the toolkit owns, then sweep what the project wrote:

```bash
canon gov sync
canon tooling sync <stack> . --write
canon migrate skill-names --json
canon migrate skill-names --write --json
```

Run the second line once per stack the project holds, since the two hooks above arrive from different ones. The third reports the plan and the fourth applies it.

The order carries the reason. A sync replaces each toolkit-owned copy with one already carrying the new names, and the sweep afterwards reaches the prose the project wrote itself. Sweeping first rewrites those installed files in place, which moves them off the hash the install recorded, so the next sync reads them as edited by the project and leaves them alone.

### Check first

`canon sync --check <path>` reports what has drifted without writing anything. It splits each difference by cause, which is the question that decides what to do next.

#### The binary first

The report opens by naming the binary running it. The installed version reads against the newest published one, and a version behind that points you at `canon upgrade`, since every section under it is a reading taken by whichever toolkit you happen to have. An unreachable registry reports unknown with its reason rather than failing, so `--exit-code` still gates on the drift the check measured locally and an offline machine stays green.

#### Then the causes

A `stale` file still matches what the toolkit installed, so the update is mechanical. A `customized` file carries local edits, so taking the upstream version is a decision and `canon:seed-sync` is the tool for it. A `stranded` file sits where an older toolkit installed it and the toolkit has since moved, which is a relocation the report names but no command runs.

That attribution comes from `canon/config/config.json` when a project carries it, falling back to `.claude/canon/config.json`, a stamp every install and sync still writes in this release. A target stamped before that path shipped is read from the retired `.claude/canon.json` instead, reported rather than migrated. Governance records a hash per installed file, plus the stack `canon gov install` was given, and tooling records the stack chain it resolved instead of any file hash, since its install runs no per-file walk to attribute.

Each domain holds its own toolkit commit, so syncing governance today does not move the revision tooling measures against, and each domain reports the upstream commits touching its own source path. Running any sync stamps that domain, and the report names the ones still unstamped.

A project that has never synced under a toolkit new enough to write a stamp falls back to the toolkit's own git history. Installed content matching any version that history published proves the file untouched, so it reports `stale` naming the commit it came from, and content matching no published version stays `drifted`. That fallback needs the toolkit as a git checkout. Installed from the registry it ships source without history, and the report says attribution was unavailable rather than reading every file as a local edit.

Further causes sit outside the per-domain scan, each naming something that walk cannot see. A seed the project edited is reported under `seeds` and reconciled with `canon:seed-sync`, since no sync command touches a seed. A file a newer seed folder replaced is reported under `superseded`, such as `.claude/TASKS.md` against the `.canon/tasks/` that now ships, and nothing moves it because the content is the project's own. A domain sitting at the root layout with nothing under `.claude/` is reported under `unmigrated`, and no command moves it either. The project moves the content itself.

`unmigrated` currently names no domain, since standards and snippets are the two the toolkit ever installed at the project root and both closed their install channel. A target still holding a root `standards/` or `snippets/` folder from an older toolkit is carrying its own authoring surface now, not an unfinished install, and nothing proposes moving either.

#### Rules you never received

A sync refreshes the files you already hold and adds none, so your rule set is frozen at the date you installed governance while every file in it reports as current. `newRules` names a rule you could receive that your tree does not hold, which is the one section that reads your absence rather than your contents. `canon gov sync` reports the same rules per file, marked `missing`, so you see them either way you check.

Take a clean section as reporting rather than as delivering. Nothing here installs, and it counts toward nothing, so pick the rules up with `canon gov install <stack>` or take one with `--add <rule>`. That separation is deliberate: adopting a rule changes what your project is governed by, which is a choice a sync has no business making for you.

Since `canon gov install` records the stack you gave it, the list is read by comparing that stack's current rules against what you hold right now, with no date involved at all. That is what lets it name a rule the toolkit shipped before you last synced: nothing here depends on when you installed. A target stamped before this recording shipped falls back to the older read below.

The fallback filters to what your stack can receive, read off the rule folders you already carry plus the folders the base stack takes whole. A rule under `lang/` or `ui/` belongs to some stacks and not others, so an unfiltered list would name rules you can never install. A target with neither a recorded stack nor a governance anchor reports nothing at all, since there is no date to measure against either.

In the fallback, an empty section is not proof either way when the toolkit running the check is not a full git clone. The read needs history to reach your anchor, and an install from the registry ships none, so the section goes quiet rather than saying it could not measure. Run the check from a clone before reading a clean result as a complete one. The stack-based read above is untouched by this, since it consults no history.

This also closes the case where a rule arrives citing a sibling you do not have. A sync refreshing a rule can land a version pointing at a file it never installs, and the section names the missing sibling rather than the broken citation, which is enough to act on.

#### What the toolkit stopped shipping

The last cause runs backwards. Every one above starts from what the toolkit ships and asks whether the target matches, so a folder the toolkit dropped appears in none of them. `reverse` walks the target instead and reports a folder sitting at a top-level path the toolkit once shipped and has since deleted.

Each entry carries a verdict, since a dropped folder and one the project wrote are the same bytes at the same path.

- `dropped` names the commit that published the content
- `unattributed` means the toolkit shipped that path and the content matches no version it published
- `project` means the folder only shares a retired name

Nothing acts on any of them, and the verdict is what makes the list safe to read.

The same field names a proposal-only skill with a live case here under `migrations`, which is how `canon:migration-claude-md` and `canon:migration-context` become reachable. Each entry carries the measurement behind the proposal rather than the proposal alone.

Add `--json` for the machine-readable report, and `--exit-code` to fail a CI job when a target falls behind. Files the project authored itself never count toward that exit code, and neither do superseded artifacts, seed drift, tooling, or anything the reverse walk reports, since each names content the project is expected to edit or place itself. An unmigrated domain does count, because running the relocation closes it.

Tooling reports under a section of its own, and `measured` there says whether the target ever recorded a chain. One that never ran a tooling sync reports unmeasured rather than clean, which is what separates tooling nobody has looked at from tooling that is current. A workspace root records nothing either way, since each package resolves its own chain.

Reconcile the configs with `canon tooling sync <stack> <path> --check` to read which files differ, then re-run it with `--write` to apply them. The drift report counts categories and the sync names paths, which is the difference worth knowing before a golden config the project edited is replaced.

### Catch-all

`canon sync <path>` runs every installed domain's sync in sequence. Safe to run on a cadence.

It never touches user-owned seed files. Governance rules in `.claude/rules/` and tooling configs refresh in place. Stale `.claude/GOV.md` from earlier installs is removed.

Standards take no part in that run. Nothing installed them, so there is no copy to reconcile and no `canon standards sync` to reach for.

### Targeted

- Claude seed docs such as `CLAUDE.md` and `.claude/REQUIREMENTS.md`: invoke `canon:seed-sync`. The skill splits each file into a preamble (between the H1 and the first H2) plus one part per `##` section, then diffs part by part and proposes per-part edits. User customizations are preserved.
- Governance rules already installed: `canon gov sync <path>` diffs and applies, and never adds new rules. A rule your recorded stack lists reports as `missing` instead.
- Tooling configs and seeds: `canon tooling <stack> <path>` overwrites golden configs and merges seeds
- Reference docs for a stack: `canon tooling reference <stack>` reads and never writes, so there is nothing to sync
- Index regeneration after markdown edits: `canon indexes regen`

Use a targeted entry point when only one surface moved upstream. Use the catch-all when the toolkit lands a bundled release.

## Verify a sync

Before running a sync against a real project, run the relevant sandbox scenario. The sandbox provisions a representative project state and routes `SANDBOX_SCENARIO=sync` through the domain flow. See [sandbox](../.claude/context/sandbox/index.md) for the scenario catalog and routing patterns.

## Scenarios

### Markdown-heavy project

```bash
cd <your-project>
claude
```

In the session, invoke `canon:setup-init`. The skill detects no framework and resolves tooling to `base` and governance to `base`. The preview marks both stacks as fallbacks, since neither came from a match, then the chain runs `canon init`.

Ongoing: run `canon sync --check .` to see what has drifted, then invoke `canon:seed-sync` for seed drift or `canon sync .` for a catch-all refresh.

### Web application

```bash
bun create vite my-app && cd my-app
claude
```

Invoke `canon:setup-init`. The skill reads `package.json` and the Vite config, resolves tooling to `vite-react` and governance to `react`, and runs `canon init` with the resolved flags.

Ongoing maintenance:

- What has drifted: `canon sync --check .`
- Seed drift: invoke `canon:seed-sync`
- Catch-all sync: `canon sync .`
- Governance rule refresh only: `canon gov sync .`
- Layer a new rule on top, for example `260-shadcn` after adopting shadcn: `canon gov install react --add 260-shadcn .`

### Monorepo with multiple language roots

The repo root owns the shared `base` layer, and each language lives in its own subfolder.

```bash
canon init --stack react .
canon tooling sync vite-react ./frontend --skip base --write
canon tooling sync python ./backend --skip base --write
```

`--skip base` drops the `base` layer from each subtree sync, so husky, prettier, cspell, commitlint, and CI stay single at the repo root. Without it, every subtree re-drops husky, and since git honors only one `core.hooksPath` the extra hook dirs silently break. Each subtree still gets its own framework configs (eslint, vitest, tsconfig, vite), and its own stack reference reads through `canon tooling reference <stack>`.

## Running sync from an agent session

`canon sync .` applies every installed domain sync, then offers to commit the result and open a pull request. That last step needs a terminal. Under `CANON_NON_INTERACTIVE=1`, which is how an agent runs it, the domain syncs still apply and the git workflow is refused: the command reports the branch and commit it would have created, writes nothing to git, and exits 0. Review the working tree and commit it yourself, or rerun interactively to reach the commit and pull request options.

Sync also refuses a target whose working tree is dirty, so commit or stash before running it. `canon sync --check .` has neither restriction, since it writes nothing.

## Related

- [agents](agents/index.md): CLI flags, exit codes, and JSON output shapes
- [AI workflow](workflow/ai-workflow.md): feature-development loop inside a toolkit-managed project
- [tooling](../.claude/context/tooling.md), [governance](../.claude/context/governance/index.md), [claude plugin](../.claude/context/claude-plugin/index.md), [indexes](../.claude/context/indexes.md), [snippets](../.claude/context/snippets.md), [standards](../.claude/context/standards/index.md): per-domain mechanics
- [sandbox](../.claude/context/sandbox/index.md): scenario catalog for verifying domain flows
