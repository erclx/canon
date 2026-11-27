---
title: Verify depths
description: The two verification depths and the script chain each runs against a freshly scaffolded project
---

# Verify depths

Runs the local verification chain against a freshly scaffolded project. Catches
config typos, missing deps, and wiring mistakes before the user ever sees them.

Two depths over one contract. Both read the `scripts` block from the project's
own `package.json` and run what is declared there, so neither hardcodes a script
name and a stack exposing a different set is covered without an edit here.

## Contents

- [Guards](#guards)
- [Step 1: read scripts](#step-1-read-scripts)
- [Step 2: run the chain](#step-2-run-the-chain)
- [Step 3: audit the context entries](#step-3-audit-the-context-entries)
- [Step 4: report](#step-4-report)
- [Out of scope](#out-of-scope)

## Guards

A monorepo syncs each language root into its own subfolder, so the project root
is one folder to verify among several rather than the only one. Collect the
folders first:

```bash
canon targets list --sweep <root> --json
```

- The root is a folder to verify when it carries a `package.json`.
- Each path in the record's `targets` that sits under the root and carries its own `package.json` is a folder to verify.
- A path under the root with no `package.json` is not verified. Name it as skipped with its fix, `sync the stack in <path> to write one`, and carry on with the rest.
- If neither the root nor any stamped subfolder carries a `package.json`, stop: `❌ No package.json at the root or in any synced subfolder. Cannot verify.`
- In each folder to verify, if `node_modules/` does not exist, run `bun install` there first, then proceed.

## Step 1: read scripts

Read `package.json` from each folder and extract its `scripts` block. Do not
hardcode script names. Different stacks expose different scripts, and a
subfolder synced with `--skip base` declares none of the scripts the root owns.

## Step 2: run the chain

Run the chain once per folder, root first. In each, run the scripts for the
requested depth in order, stop that folder on its first failure, and surface the
error. Skip any script not present in that folder's `package.json`. Do not
invent a fallback command. Run each as `bun run <script>` from the folder it was
read from.

### Default depth

Every script is a leaf command, so failures point at the exact break and the
exit code is the whole verdict.

| Order | Script      | Skip if                     |
| ----- | ----------- | --------------------------- |
| 1     | `lint:fix`  | absent                      |
| 2     | `format`    | absent                      |
| 3     | `typecheck` | absent                      |
| 4     | `check`     | absent                      |
| 5     | `test:run`  | absent, fall back to `test` |
| 6     | `build`     | absent                      |

Do not run composite scripts like `check:full`. Do not run `dev`, `preview`,
`test:e2e`, `test:ui`, or `screenshot` at this depth. They belong to `deep`
below.

### Deep depth

The checks a scaffold's leaf scripts cannot cover: whether the dev and preview
servers actually start, whether the end-to-end suite passes against a real
server, and whether the screenshot harness produces output.

| Order | Script       | Skip if | How judged              |
| ----- | ------------ | ------- | ----------------------- |
| 1     | `dev`        | absent  | server smoke, see below |
| 2     | `preview`    | absent  | server smoke, see below |
| 3     | `test:e2e`   | absent  | leaf script: exit code  |
| 4     | `screenshot` | absent  | leaf script: exit code  |

`deep` runs the four above and not the six leaf scripts, which the default
depth already covers. The two sets are disjoint, so running both depths runs
every declared script exactly once.

### When deep runs

The depth follows how the phase was reached.

- The bare chain on a fresh scaffold runs the default depth, then `deep`, in each folder that passed the default depth
- A folder that failed at the default depth skips `deep`, since a broken build fails every server stage for the same reason
- `setup verify deep` runs `deep` alone
- `setup verify` stays at the default depth, since a single-phase call states its own depth

### The two verdicts

A dev server that starts slowly reads as a failure, so the deep verdict depends
on one test: whether a person can answer a question in this session. A probe of
stdin does not decide it, since a Bash call reads no terminal even when a person
is there.

- Attended, when a person can answer: a deep failure fails the report the way a default failure does, naming the script
- Unattended, every other run: a deep failure reports as a warning naming the failing script and its output, and the chain does not fail

### Stages that cannot run

A stage the machine cannot run is reported as skipped by name with its fix,
never as passed and never as a scaffold failure. Carry on with the next stage.

Before `test:e2e`, install the browsers the suite runs in.

- Read the `projects` names from the folder's `playwright.config.ts` and run `bunx playwright install <engines>` with those names
- Install every named engine, since a narrower install fails the suite on the first engine it leaves out
- When the install fails, skip `test:e2e` and `screenshot`, naming the missing install and the command

A port another process holds is not a fault in the scaffold.

- When a server or the screenshot harness prints `already in use` or `EADDRINUSE`, skip that stage
- Name the port and `WORKTREE_PORT_OFFSET`, the variable that shifts it, as the fix

### Server smoke

`dev` and `preview` run until stopped, so there is no exit code to read. Start
the script backgrounded, wait 5 seconds, then check two things: the process is
still running, and its captured output carries no string matching `error`,
`Error`, or `fatal`. Kill the process either way once judged. Report a failure
on either check failing.

This is weaker than a real readiness probe. No manifest key exposes a generic
port to poll across stacks, so port-probing is out of reach here.

## Step 3: audit the context entries

Run the context audit once from the project root, after the script chain:

```bash
canon context audit --json
```

Read the record's `coverage` rather than the exit, which also carries findings
this phase does not report on.

- On `kind: 'measured'`, list each folder in `coverage.findings.unnamed` as a code folder no entry's Layout names
- Report each as a finding, never a failure, and name `/canon:context-sync` as the step that writes the Layout line
- Write no Layout line here, since what a folder does is the first build session's call and a line setup guesses is a stale claim
- On any other `kind`, report it in one line, such as `no-root` for a project with no code root yet

## Step 4: report

Report per folder, under a heading naming its path relative to the root, and
list each skipped folder with its sync fix. For each script run, report
one of:

- `✅ <script>`
- `❌ <script>` followed by the failing output (last 40 lines) or, for a server script, the reason judged (process died, or a fatal string in its output)
- `⚠️ <script>` for a deep failure on an unattended run, with the same output a failure carries
- `⏭️ <script>` for a stage that could not run, followed by the reason and its fix

End with a summary line naming each depth that ran:

- On pass: `✅ Scaffold verified at <depth> (<n> scripts passed across <m> folders).`
- On fail: `❌ Scaffold failed at <script> in <folder>. Fix the error and re-run the verify phase.`
- On an unattended deep failure: `⚠️ Scaffold verified at default, deep warned at <script> in <folder>.`

A fresh scaffold's report states whether the app was started, so a run where
every deep stage was skipped says the app was never started rather than reading
as verified at `deep`.

## Out of scope

- Generating the configs these scripts drive, which the tooling stack reference owns.
- CI workflow validation. It runs in GitHub Actions on a pull request rather than locally. The `deep` depth runs the same end-to-end and screenshot stages locally, as the closest proxy.
