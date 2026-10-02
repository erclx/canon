#!/usr/bin/env bash
# Writes web/src/fixtures/agent-view.json from a real `canon sessions list
# --json` read of this repository's own sessions.
#
# The page it feeds re-creates an orchestrator dispatching workers, which is the
# one thing this toolkit does that no other surface here shows. A re-creation
# earns nothing if the rows behind it are invented, so the session half is a
# live listing and never a literal.
#
# Every role in the roster appears, not the workers alone. The controlling
# session is pinned above the bands and planners sit in them beside workers,
# which is what the surface being re-created does. An earlier version of this
# script filtered the listing down to sessions holding a feature branch, and
# that dropped the orchestrator and every planner, since a controlling session
# and a planning session both sit on the default branch. A page about a dispatch
# that excludes the dispatcher is the defect that filter shipped.
#
# Two fields cannot come from the listing and are transcribed by hand into the
# table below. The activity text is written by Claude Code into its own status
# line and no verb here reports it. The pull request number sits on a task file
# with nothing joining a session record to it, which the plan behind this script
# took as a trade rather than building the join. Both are recorded as
# transcribed in the fixture's own header, so a reader of the committed file can
# tell which half was measured and which was typed.
#
# The honesty cost this leaves open is the one assets/captures/install.html.tmpl
# already documents for the terminal frames: a hand-edit after generation
# defeats the discipline silently, and nothing here detects one.
#
# Clone-only. It reads this repository's own sessions, and a registry install
# carries no such listing.
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

OUT="$PROJECT_ROOT/web/src/fixtures/agent-view.json"

# Transcribed half, keyed by session name. The name is the only key that reaches
# every row: a controlling session and a planning session both sit on the
# default branch, so a branch cannot tell them apart or from each other. A
# dispatched session is named `<role>-<project>-<slug>` after the work it was
# given rather than after what it turned out to be doing, which is what makes
# the name stable enough to key on here.
#
# Each row is `name|activity|pullRequest|state|age`. The state is `pinned`,
# `working`, or `completed`, and it is where the row renders. An empty pull
# request field is a session that had not reached its ship step when the
# snapshot was taken.
#
# A pinned or working row has to appear in the live listing or this refuses, and
# its age comes from the listing rather than the table, so the trailing field is
# empty for those. A completed row names a session that has already exited, so
# no listing carries it, its age is transcribed with the rest of the row, and
# leaving that field blank would print an empty column on half the list.
# Re-transcribe this table against a fresh listing rather than editing the
# generated file.
#
# A planner belongs in this table as much as a worker does. `role-planner`
# forbids entering a worktree, so a planner registers on the default branch at
# launch and stays there for its whole life, which is why the branch filter this
# script used to carry dropped every one of them permanently rather than
# occasionally.
ROWS=(
  "orchestrator-canon-lead|dispatching the planners that need a plan||pinned|"
  "worker-canon-agent-view-and-deploy|PR #1510 open (landing page)|1510|working|" # canon-allow-reference: transcribed status text
  "planner-canon-context-wireframe-draft|drafting the context and wireframe plan||working|"
  "planner-canon-skill-coverage-pointers|reading the skill coverage pointers||working|"
  "planner-canon-screenshot-trap-guard|planning the screenshot trap guard||working|"
  "planner-canon-write-route-hook-bypass|plan written; tested write probe||completed|32m"
  "planner-canon-indexes-list-lookup|plan and task board consistent||completed|13m"
  "worker-canon-labels-scan-body-file|address-review pass finished|1508|completed|21m"
  "worker-canon-web-context-entry|PR #1507 addressed with commit|1507|completed|20m" # canon-allow-reference: transcribed status text
)

# The listing reports a session's repository as the main `.git` directory, which
# is what this resolves whether the script runs from the main checkout or from a
# linked worktree. Comparing against PROJECT_ROOT instead would match nothing
# from a worktree, where the two differ.
MAIN_GIT_DIR="$(cd "$PROJECT_ROOT" && git rev-parse --path-format=absolute --git-common-dir)"

# `bun src/cli.ts` rather than `canon`, since a globally linked binary resolves
# to the main checkout no matter which worktree is running, and this script is
# run from a worktree as often as not.
SESSIONS_JSON="$(cd "$PROJECT_ROOT" && CANON_NON_INTERACTIVE=1 bun src/cli.ts sessions list --json 2>/dev/null)"

if [ -z "$SESSIONS_JSON" ]; then
  echo "regen-agent-fixture: the session listing returned nothing, refusing to write an empty fixture" >&2
  exit 1
fi

# The listing crosses into the eval as a file rather than an environment entry,
# since Linux caps a single env string at 128KB and a machine running many
# sessions can cross it, which fails the exec with E2BIG before any check can
# report a thing.
SESSIONS_FILE="$(mktemp)"
trap 'rm -f "$SESSIONS_FILE"' EXIT
printf '%s' "$SESSIONS_JSON" >"$SESSIONS_FILE"

TRANSCRIBED_ROWS="$(printf '%s\n' "${ROWS[@]}")"
READ_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export SESSIONS_FILE OUT PROJECT_ROOT READ_AT TRANSCRIBED_ROWS MAIN_GIT_DIR

bun --eval '
const { readFileSync } = require("node:fs")

const { SESSIONS_FILE, OUT, PROJECT_ROOT, READ_AT, TRANSCRIBED_ROWS, MAIN_GIT_DIR } =
  process.env

const listing = JSON.parse(readFileSync(SESSIONS_FILE, "utf8"))

const rows = TRANSCRIBED_ROWS.split("\n")
  .map((line) => line.replace(/\s*#\s*canon-allow-reference:.*$/, "").trim())
  .filter((line) => line !== "")
  .map((line) => {
    const [name, activity, pullRequest, state, age] = line.split("|")
    return {
      name,
      activity,
      pullRequest: pullRequest ? Number(pullRequest) : null,
      state,
      age: age || null,
    }
  })

// Narrowed to this repository, and the reason is disclosure rather than scope.
// `canon sessions list` is machine-wide, so an unfiltered read carries the
// session names and worktree paths of every other project on the machine, which
// here includes paths under a folder named `private` and several client names.
// This fixture renders on a public page, so the filter is what keeps them off
// it. The cost is a fidelity gap stated plainly: the real surface is
// machine-wide and the depiction is one repository, and that is a deliberate
// narrowing rather than an oversight.
//
// Keyed by name for the reason the shell comment gives: a session on the
// default branch has no other identity, and the orchestrator and every planner
// sit there.
const live = new Map(
  listing.sessions
    .filter((session) => session.repository === MAIN_GIT_DIR)
    .map((session) => [session.name, session]),
)

// The real surface shows an age per row, so the fixture carries one. It is
// frozen at the read rather than live, which the rendered provenance line dates
// so a reader is never told a stale figure is current.
const ageLabel = (startedAt) => {
  const minutes = Math.round(
    (Date.parse(READ_AT) - Date.parse(startedAt)) / 60000,
  )
  if (!Number.isFinite(minutes) || minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

// A row the page shows as running has to be running. Transcribing one that is
// not is the failure the live half exists to prevent, so it refuses rather than
// rendering.
const absent = rows.filter(
  (row) => row.state !== "completed" && !live.has(row.name),
)
if (absent.length > 0) {
  console.error(
    "regen-agent-fixture: no live session for " +
      absent.map((row) => row.name).join(", ") +
      ". Re-transcribe the table in this script against a fresh listing rather than editing the generated fixture.",
  )
  process.exit(1)
}

const sessions = rows.map((row) => {
  const session = live.get(row.name)
  return {
    name: row.name,
    branch: session ? session.branch : null,
    state: row.state,
    activity: row.activity,
    pullRequest: row.pullRequest,
    age: session ? ageLabel(session.startedAt) : row.age,
  }
})

const ageless = sessions.filter((entry) => !entry.age)
if (ageless.length > 0) {
  console.error(
    "regen-agent-fixture: no age for " +
      ageless.map((entry) => entry.name).join(", ") +
      ". A completed row carries its age in the table, since the session has exited and no listing reports one.",
  )
  process.exit(1)
}

// What the real surface prints above its own list. The remainder is every
// session on the machine this page has no room to show, which is a real count.
const summary = {
  working: sessions.filter((entry) => entry.state === "working").length,
  completed: sessions.filter((entry) => entry.state === "completed").length,
  more: Math.max(0, listing.sessions.length - live.size),
}

const fixture = {
  // Read by web/src/components/agent-view.astro. Every field below is either a
  // live read or a hand transcription, and this header is what says which.
  generatedBy: "scripts/core/regen-agent-fixture.sh",
  readAt: READ_AT,
  source: {
    command: "canon sessions list --json",
    live: [
      "name",
      "branch",
      "age",
      "that every pinned and working row is running",
      "the remainder count",
    ],
    transcribed: {
      activity:
        "written by Claude Code into its own status line, which no verb here reports",
      pullRequest:
        "read off a task file by hand, since nothing joins a session record to one",
      state:
        "a completed session has already exited, so no listing carries the row at all",
    },
  },
  summary,
  sessions,
}

await Bun.write(OUT, JSON.stringify(fixture, null, 2) + "\n")
console.error(
  `regen-agent-fixture: wrote ${sessions.length} session rows to ${OUT.replace(PROJECT_ROOT + "/", "")}`,
)
'
