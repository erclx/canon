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

## Guards

- If `package.json` does not exist at the project root, stop: `❌ No package.json found. Cannot verify.`
- If `node_modules/` does not exist, run `bun install` first, then proceed.

## Step 1: read scripts

Read `package.json` from the project root and extract the `scripts` block. Do
not hardcode script names. Different stacks expose different scripts.

## Step 2: run the chain

Run the scripts for the requested depth in order. Stop on the first failure and
surface the error. Skip any script not present in `package.json`. Do not invent
a fallback command. Run each as `bun run <script>` from the project root.

### Default depth

Every script is a leaf command, so failures point at the exact break and the
exit code is the whole verdict.

| Order | Script      | Skip if                     |
| ----- | ----------- | --------------------------- |
| 1     | `lint:fix`  | absent                      |
| 2     | `typecheck` | absent                      |
| 3     | `check`     | absent                      |
| 4     | `test:run`  | absent, fall back to `test` |
| 5     | `build`     | absent                      |

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

`deep` runs the four above and not the five leaf scripts, which the default
depth already covers. The two sets are disjoint, so running both depths runs
every declared script exactly once.

Take `deep` on request rather than by default. A dev server that starts slowly
reads as a failure here, which is too flaky to fail an unattended scaffold check
on, and the end-to-end stage needs a browser install the chain does not make.

### Server smoke

`dev` and `preview` run until stopped, so there is no exit code to read. Start
the script backgrounded, wait 5 seconds, then check two things: the process is
still running, and its captured output carries no string matching `error`,
`Error`, or `fatal`. Kill the process either way once judged. Report a failure
on either check failing.

This is weaker than a real readiness probe. No manifest key exposes a generic
port to poll across stacks, so port-probing is out of reach here.

## Step 3: report

For each script run, report one of:

- `✅ <script>`
- `❌ <script>` followed by the failing output (last 40 lines) or, for a server script, the reason judged (process died, or a fatal string in its output)

End with a summary line naming the depth that ran:

- On pass: `✅ Scaffold verified at <depth> (<n> scripts passed).`
- On fail: `❌ Scaffold failed at <script>. Fix the error and re-run the verify phase.`

## Out of scope

- Generating the configs these scripts drive, which the tooling stack reference owns.
- CI workflow validation. It runs in GitHub Actions on a pull request rather than locally. The `deep` depth runs the same end-to-end and screenshot stages locally, as the closest proxy.
