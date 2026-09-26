---
title: Command catalog
description: Every top-level command with its purpose, each domain's subcommands and the page describing them, the browser commands, and the version skew report
---

# Command catalog

Full help: `canon <command> --help`. Bare `canon --help` lists every top-level command under five headings, Project, Domains, Author and render, Session and ship, and Repo reports, with descriptions cut at 80 columns. Piped into another command, the block prints without its frame glyphs and carries the same text. Behavior notes for the install and sync verbs live in `install-and-sync.md`.

## Project-level

One row per top-level command, in the order `canon --help` prints them. A domain's subcommands are in `## Domain commands` below.

| Command                     | Purpose                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| `canon init [path]`         | Bootstrap a project with selected toolkit domains                               |
| `canon sync [path]`         | Sync every installed domain, or report drift and version skew with `--check`    |
| `canon upgrade`             | Reinstall the CLI globally with the package manager the install path names      |
| `canon migrate <verb>`      | Move a project off a retired name or layout, reporting the plan until `--write` |
| `canon targets <verb>`      | Report the projects this toolkit installed into                                 |
| `canon gov <verb>`          | Install and sync governance rules, and audit the tree against them              |
| `canon standards <verb>`    | List, audit, or print a standard by name                                        |
| `canon tooling <verb>`      | Sync, diff, and verify tooling stacks                                           |
| `canon claude <verb>`       | Install the Claude workflow and audit both skill corpora                        |
| `canon wiki <verb>`         | Scaffold the wiki pages                                                         |
| `canon indexes <verb>`      | Regenerate `index.md` files from sibling frontmatter, or flatten them           |
| `canon docs [topic]`        | Emit toolkit reference docs (`list`, or a topic by name)                        |
| `canon design <verb>`       | Render `canon/DESIGN.md` tokens, build the board, install the base stylesheet   |
| `canon slides <verb>`       | Render a `.claude/SLIDES.md` deck, or list its layouts                          |
| `canon capture [source]`    | Render HTML or a URL to PNG and prove each declared font resolved               |
| `canon serve [dir]`         | Serve a directory on loopback and print the link that opens it                  |
| `canon demo <verb>`         | Compile and record a running app                                                |
| `canon inventory [subject]` | Group every route's elements by one computed property, never gating             |
| `canon drive <url> <run>`   | Walk a page through named interactions and measure each state                   |
| `canon transcripts <url>`   | Fetch a YouTube transcript with metadata frontmatter (needs `yt-dlp`)           |
| `canon teach <verb>`        | Open and author learning workspaces                                             |
| `canon sandbox [cat:cmd]`   | Run sandbox scenarios, toolkit-only like the tree it reads                      |
| `canon tasks <verb>`        | Read and write the task board, the plans it cites, and its archive              |
| `canon intake <verb>`       | Report intake folders and write answers into them                               |
| `canon records <verb>`      | Validate, size, prune, and back up the session records                          |
| `canon sessions <verb>`     | Resolve live sessions to worktree and branch, and move one between machines     |
| `canon worktrees <verb>`    | Report and remove worktrees whose pull request merged                           |
| `canon autoship <verb>`     | Decide whether a changed set needs the review pass                              |
| `canon pr <verb>`           | Read a pull request's diff, head, checks, and review, and post its evidence     |
| `canon feedback`            | Write toolkit feedback from stdin, or open an issue with `--github`             |
| `canon audits <verb>`       | Run every audit as one set under one verdict against the recorded baseline      |
| `canon gate <verb>`         | Run every stage that guards a branch here                                       |
| `canon secrets <verb>`      | Report credential-shaped values in the tree the package ships                   |
| `canon deps <verb>`         | Report published advisories against the resolved dependency set                 |
| `canon labels <verb>`       | Read a changed set against the label map, and scan pull request text            |
| `canon comments <verb>`     | Measure comment density by language and kind, with a trend from git             |
| `canon context <verb>`      | Report context folder health, and classify changed or stale sections            |
| `canon markdown <verb>`     | Fail markdown on a banned character or a dead link, and report its structure    |
| `canon repo <verb>`         | Propose and apply the remote's description, homepage, and topics                |
| `canon census [path]`       | Report tracked file count, extensions, and a line total skipping binaries       |

`canon serve` drives no browser, which is what separates it from the four that do. All four ship now that `capture` does, so the line between them is the engine rather than the package. A generated page loses its script to an editor preview and to a `file://` open, so the link is the delivery rather than a convenience, and every generated surface here reaches a reader through one. A teach lesson's stylesheet is embedded rather than linked, so only its script still needs a server. It binds `127.0.0.1` and never a wildcard, because what it is pointed at is routinely a gitignored record tree. It sends `cache-control: no-store`, since a preview exists to be edited and reloaded and a cached stylesheet reads as a fix that did not work.

A port already in use is the ordinary case rather than a refusal, so it walks forward to the next free one and reports which it took. That is why a caller reads `url` off the `--json` record instead of composing one from the port it asked for. Only contention is walked past. Any other bind failure refuses as `bind-failed` carrying the error's code, rather than being retried twenty times and reported as a range being full, which names a cause nothing checked.

A request naming a directory is redirected to its trailing-slash form rather than answered in place. A browser resolves a relative asset against the last slash of the URL it is on, so answering `/lesson` directly leaves the page asking for `/course.css` instead of `/lesson/course.css`, and it renders unstyled through the server that exists to prevent exactly that.

Containment is tested after symlinks are followed rather than on the path as written, and the test sits immediately before the read rather than beside the request that produced it. Resolving a request lexically clears a link pointing outside the served root, and this repository is a live instance of that shape, since `claude/standards` is a link out of `claude/`. Position is what makes the property hold: a directory request appends its index after the request path has been checked, so a check placed earlier leaves that index untested. `--index` answers a directory holding no `index.html` with a listing read per request, where the default stays a 404. Every entry the listing names takes the same containment test a request for it would, so a link out of the root is absent rather than greyed, and dotfiles are hidden. With no `--entry` and no root `index.html`, the printed link is `/` and `entryExists` reads true. An `--entry` that escapes the root refuses with `no-entry` before a port is taken, because `url` is the field a caller hands to a reader.

`canon demo` is the second browser command and the one that ships, since its purpose is running in a target rather than regenerating what this repository commits. It needs a browser binary the package does not carry, installed once with `bunx playwright install chromium`.

`canon inventory` is the third and takes the same answer for the same reason. It reads `inventory.toml` at the project root for its base URL, its routes, and the element query each subject runs over, so what it walks comes from the project rather than from the toolkit. It reports how many different answers a site gives for one property and never gates, because whether five focus rings across four routes is a defect is a judgment. A missing server and an unmatched query are both refusals rather than empty listings, since a listing with no rows reads as one consistent answer.

```toml
base-url = "http://localhost:4173"
routes = ["/", "/pricing", "/docs"]

[subjects.focus]
query = "button, a[href], input, select, textarea, [tabindex]"
```

`canon drive` is the fourth and ships for the same reason the three before it do. What separates it from all three is the axis rather than the destination: `capture` and `inventory` each answer about a page as it loads, and every defect that exists only after a menu opens or the page scrolls is invisible to both. It takes a JSON run file naming the viewport, the probes, and the interaction sequence, since a route catalog is state a project holds and an interaction sequence is a script written for one question. Viewport heights are never defaulted, because the heights a defect hides at belong to the layout rather than to this command. It reports findings and never gates, since every probe it ships carries a class of false finding a throwaway version already produced. See `driver.md`.

## Domain commands

Each domain exposes a consistent shape where applicable: `list`, `install`, `sync`, `create`. The page named beside a domain carries its flags, records, and refusals, and `canon <domain> --help` lists the flags of any subcommand.

- `migrate`, in `migrate.md`: `rename`, `skill-names`, `records`, `surface-roots`, `record-tree`, `rule-layout`, `scratch-evidence`, `record-layout`
- `targets`, in `targets.md`: `list`, `pulls`
- `gov`, in `install-and-sync.md`: `list`, `install`, `sync`, `build`, `regen`, `test-order`, `counts`, `superseded`, `citations`, `restated`
- `standards`, in `standards-audit.md`: `list`, `audit`, `<name>`
- `tooling`, in `install-and-sync.md`: `list`, `sync`, `diff`, `reference`, `create`, `verify`, `inject`, `prune-gitignore`
- `claude`, in `skills-audit.md`: `init`, `sync`, `setup`, `routing`, `plugin-update`, `seeds list`, `skills list`, `skills audit`, `skills drift`, `skills reach`, `skills rank`
- `wiki`, in `scripting.md`: `init`
- `indexes`, in `indexes.md`: `regen`, `list`
- `docs`, in `docs.md`: `list`, `<topic>`
- `design`, in `design-board.md`: `render`, `regen`, `board`, `css`, `install`, `sync`
- `slides`, described below: `render`, `list`
- `demo`, in `demo.md`: `compile`, `run`, `frames`
- `inventory`, described above: `run`
- `teach`, in `teach.md`: `list`, `open`, `resource`, `glossary`, `lesson`, `stylesheet`, `nav`, `render`
- `sandbox`, in `sandbox.md`: `reset`, `clean`, `check`, `coverage`
- `tasks`, in `tasks.md`: `next-label`, `archive`, `decline`, `plan-citations`, `plan-answers`, `plan-branch`, `plan-reach`, `plan-link`, `pull-request`, `outcome`, `list`, `validate`
- `intake`, in `intake.md`: `list`, `answer`
- `records`, in `records.md`: `validate`, `migrate`, `ordinal`, `size`, `stale`, `prune-tmp`, `push`, `pull`
- `sessions`, in `sessions.md`: `list`, `export`, `import`
- `worktrees`, in `worktrees.md`: `list`, `reclaim`
- `autoship`, in `review-classification.md`: `classify`
- `pr`, in `pr-reads.md`: `key-changes`, `head`, `checks`, `review-state`, `evidence`, `preview`, `local`
- `audits`, in `audits.md`: `run`, `list`
- `gate`, in `gate.md`: `run`
- `secrets`, in `state-scoped-risk.md`: `scan`
- `deps`, in `state-scoped-risk.md`: `audit`
- `labels`, in `label-coverage.md`: `audit`, `scan`
- `comments`, in `comments.md`: `scan`
- `context`, in `context-audit.md`: `audit`, `classify diff`, `classify sweep`, `classifier show`, `classifier set`
- `markdown`, in `markdown-audit.md`: `audit`
- `repo`, described below: `metadata propose`, `metadata apply`

Common patterns:

- `list --json` → machine-readable catalog on stdout.
- `install <name> <path>` → install a specific entry into a target project.
- `sync <path>` → reapply all installed entries in a target project.
- `create [name]` → scaffold a new authoring entry in this repo.

Subcommands no other page describes:

- `claude plugin-update` matches the installed marketplace plugin against `claude/.claude-plugin/plugin.json`'s own name and runs `claude plugin update` on it, reading the version back off `claude plugin list --json`, since the update call reports none of its own (`--json`).
- `claude skills rank` scores either skill corpus's descriptions against a case corpus by TF-IDF cosine similarity, reporting rank-one and top-three (`--cases <path>`).
- `design regen` rewrites this repository's `canon/DESIGN.md` from `src/design/tokens.ts` and `src/design/base.css` from `src/design/neutral.ts`. `design css` emits the tokens and components as CSS on stdout, with `--no-components` for properties alone, and `design render` declares each vendored face the typography table names under `--embed-fonts`.
- `slides render` renders a `.claude/SLIDES.md` source into a PowerPoint deck and reports any unrecognized layout name on stderr, and `slides list --json` emits the layout catalog.
- `labels scan` fails a pull request or a posted review whose title, body, or review comment carries a phase label, a label a code span quotes, a gitignored record path, a session link, a title word no dictionary holds, or a title breaking `standards/pr.md`'s format, casing, or length rule (`--event`, `--body-file`, `--json`).
- `repo metadata propose` compares a description, homepage, and topic set computed from the README and `package.json` against what the remote carries, writing nothing, and `repo metadata apply` writes an explicitly supplied set through `gh repo edit` (`--description`, `--homepage`, `--topics`).

## Version skew

`canon sync --check` and `canon claude skills drift` are the two moments a target
already stops to reconcile with the toolkit, so each reports the installed
version against the newest published one. No other command performs the lookup,
which keeps a registry round trip out of the catalog reads an agent runs in a
loop.

The report carries three states and never changes an exit code. `behind` names
`canon upgrade` as the remedy, `current` says so, and `unknown` carries the
reason the registry could not be reached. Branch on the `skew.state` field in
the JSON record rather than on the exit, since an offline machine has to read as
unmeasured rather than as a failing check.

`canon upgrade --json` carries one further state, `pending`, that the skew report
does not. It means the checkout at the working directory holds a release npm does
not serve yet, so there is nothing to install. The record names that version in
`checkout` beside `latest`, exits 0, and its `message` starts `CLI stays at`. A
directory outside any canon checkout never reads `pending`.
