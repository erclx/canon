#!/usr/bin/env bash
# Spec-quality test for an always-loaded authoring artifact. The standards arms
# ask whether a session that has never seen a standard can author a conforming
# artifact from it alone. The seed arm asks whether a session handed a project
# scaffolded from the Claude seed can work in it without asking for context the
# seed should have carried.
#
# An ablation variant runs one half of a pair: the same prompt against the seed
# with a section and against the seed without it. Sufficiency and necessity are
# different measurements, and the arms above only answer the first. Prints the
# judged result to stdout.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly REPO_ROOT

arm="${1:-context}"

# Why the run was started, written by the caller. The harness cannot infer it:
# guessing from whether the verdict changed would mislabel a regression run
# that happens to find something. It defaults to `findings` so the documented
# one-argument invocation keeps working, which makes `regression` the label a
# caller has to remember on the runs that confirm nothing broke.
kind="${2:-findings}"

# A variant overrides the caller's kind below, after the variant is parsed. The
# harness cannot infer why an ordinary run was started, which is what makes
# `kind` a caller argument, but a variant carries its own reason: the run exists
# to be half of a comparison. Leaving it `findings` would put ablation halves
# and standards arms in one bucket, and `Verdict` means different things in
# each, so the count the ledger reads would silently mix them.

# One half of an ablation pair, as `<section>-kept` or `<section>-cut`. Empty
# runs the arm the way it has always run.
#
# Both halves carry a label rather than pairing a bare `seed` against a
# `seed-no-<section>`. A pair has to differ in the seed and in nothing else,
# and the bare arm carries the ordinary feature request, which reaches none of
# these sections. Pairing against it would vary the prompt and the artifact at
# once, which is the confound runs 01 and 02 already have.
variant="${3:-}"

usage="usage: run.sh [context|wireframes|seed] [findings|regression] [<section>-kept|<section>-cut]
sections: memory indexes output tasks
a variant records its kind as \`ablation\` and ignores the second argument"

case "$arm" in
context)
  standard="context.md"
  dest="canon/context/feedwatch.md"
  surface="one entry for this codebase"
  arm_dir="ctx-arm"
  ;;
wireframes)
  standard="wireframes.md"
  dest="canon/wireframes/feed-list.md"
  surface="one entry for the feed list surface"
  arm_dir="wf-arm"
  ;;
seed)
  arm_dir="seed-arm"
  ;;
*)
  echo "$usage" >&2
  exit 1
  ;;
esac

case "$kind" in
findings | regression) ;;
*)
  echo "$usage" >&2
  exit 1
  ;;
esac

# The lines a `cut` half removes and the prompt both halves carry.
#
# Anchor a candidate on its own text, never on its ordinal. The task that
# ordered this work names "Indexes bullets 3 and 4" against a section that now
# holds three, so a line-addressed strip would remove a real line and report it
# under the name of a different one. Each anchor is a fixed string checked to
# match exactly one line, which turns a reworded seed into a loud failure
# rather than a silent measurement of the wrong bullet.
#
# Each pair needs its own prompt because no single feature request reaches any
# of these sections. That is what makes four cuts into eight arms, and it also
# means the four results are not comparable to each other.
ablate_anchors=()
variant_prompt=""

if [ -n "$variant" ]; then
  if [ "$arm" != seed ]; then
    echo "→ a variant needs the seed arm" >&2
    exit 1
  fi

  ablate_section="${variant%-*}"
  ablate_half="${variant##*-}"

  case "$ablate_half" in
  kept | cut) ;;
  *)
    echo "$usage" >&2
    exit 1
    ;;
  esac

  case "$ablate_section" in
  memory)
    # The whole section. Removing its four bullets and leaving the heading
    # would plant an empty heading, which is a signal of its own.
    ablate_anchors=(
      "## Memory"
      "- Write all memory files to"
      "- Save a feedback memory only when"
      "- Keep feedback memories to 3 lines"
      "- Before creating a new memory file"
    )
    variant_prompt="Correcting you for the second time: a new delivery sink has \
to be registered in the sinks index or it never gets drained. Record that \
correction so a future session gets it right the first time."
    ;;
  indexes)
    ablate_anchors=(
      "- For folders where an agent browses to pick a document"
      "- Every \`index.md\` carries its own frontmatter"
    )
    variant_prompt="Write a narrative entry for the pollers domain covering how \
it is structured, the decisions behind it, and its gotchas, so a future session \
reads it before touching that code."
    ;;
  output)
    ablate_anchors=(
      "- In the main worktree: relative from"
      "- In a linked worktree (under"
      "- When the response covers multiple files"
    )
    variant_prompt="Add a Slack delivery sink that posts each new item to an \
incoming webhook URL read from the environment, and retire the email sink \
completely."
    ;;
  tasks)
    ablate_anchors=(
      "- When a task needs execution detail beyond its own file"
      "- Write the plan in the same session as the task file"
    )
    variant_prompt="Feedwatch has to move off bun:sqlite to Postgres. That is \
multi-session work with real dependencies, so queue it rather than starting it \
now."
    ;;
  *)
    echo "$usage" >&2
    exit 1
    ;;
  esac
fi

# What the ledger and the retained output call this run. A variant sorts next
# to its partner, which is what makes eight rows readable as four pairs.
arm_label="$arm"
if [ -n "$variant" ]; then
  arm_label="$arm-$variant"

  # Set here rather than taken from the caller, per the note beside `kind`.
  kind=ablation
fi

# What a run leaves behind, split by what each costs to keep. The raw output
# lands in gitignored scratch and the ledger row is committed. A transcript
# carries the full text of every file the session read, so a hundred retained
# runs is a repository hundreds of megabytes larger for every clone, against a
# row that costs bytes. Nothing prunes the scratch. Promote a transcript into
# the arm's result document by hand on the day it becomes evidence for a claim.
run_stamp="$(date +%Y%m%dT%H%M%S)"
run_dir="$REPO_ROOT/.canon/tmp/runs/eval/$arm_label-$run_stamp"
ledger="$SCRIPT_DIR/ledger.md"

# The stamp resolves to the second, so two runs of one arm inside the same
# second would land in one directory and the later would overwrite the earlier
# while both ledger rows still pointed at it. That destroys evidence silently,
# which is the failure this whole file exists to prevent. Take the next free
# name instead. `%N` would be shorter and BSD `date` does not have it.
run_suffix=2
while [ -e "$run_dir" ]; do
  run_dir="$REPO_ROOT/.canon/tmp/runs/eval/$arm_label-$run_stamp-$run_suffix"
  run_suffix=$((run_suffix + 1))
done

# Copy a run's raw output out of the workdir before the trap deletes it. The
# derived report was the only survivor until now, and it was wrong once: seed
# run 02 reported `(none)` for the seed surface because the pattern required a
# slash, and the correction was possible only because the full call list
# happened to sit in the same report. A narrower report loses the run.
#
# Writes to stderr and disk alone. Retention is additive, so every failure here
# warns and lets the verdict print. It reports the failure through its exit
# status as well, because the caller has to know whether the ledger may name
# the directory. A warning scrolls past and the row is the durable record.
retain_run_output() {
  local src="$1"
  local name="$2"

  if ! mkdir -p "$run_dir" 2>/dev/null; then
    echo "→ warn: could not create $run_dir, output not retained" >&2
    return 1
  fi

  if cp "$src" "$run_dir/$name" 2>/dev/null; then
    echo "→ output retained at ${run_dir#"$REPO_ROOT"/}/$name" >&2
    return 0
  fi

  echo "→ warn: could not retain $name at $run_dir" >&2
  return 1
}

# Append one row per run, so the claims repeated across the readme and the
# result files become a query rather than a memory.
#
# Append, never rewrite. The row anchors on no existing line, which is what
# keeps a stream editor's failure modes out of a file that grows one row at a
# time. The table therefore has to stay last in the ledger.
#
# The verdict is written `pending` because judging happens after a human reads
# the report, and whoever judges it edits that one cell.
append_ledger_row() {
  # A run whose output carried no result object leaves these empty rather than
  # null, since jq emits nothing at all on empty input and its `//` fallback
  # never fires. An empty cell reads as "nobody recorded it", so name the gap.
  local cost="${1:-unknown}"
  local turns="${2:-unknown}"
  local retained="${3:-no}"

  # A run that failed to retain must not name the directory it would have used.
  # The warning is on stderr and the row outlives it, so a path recorded anyway
  # is a durable claim that something is on disk when nothing is.
  local output_cell
  if [ "$retained" = yes ]; then
    output_cell="${run_dir#"$REPO_ROOT"/}"
  else
    output_cell="none"
  fi

  # The subject is the commit the standard or seed under test was read from,
  # since the run exercises the working tree rather than a release.
  #
  # The ledger is excluded from the dirty check. It is a tracked file that this
  # function appends to, so counting it marks every run after the first `-dirty`
  # with nothing under test changed, which corrupts the one column saying which
  # tree a run exercised.
  local subject
  subject="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  if ! git -C "$REPO_ROOT" diff --quiet HEAD -- ":!${ledger#"$REPO_ROOT"/}" 2>/dev/null; then
    subject="$subject-dirty"
  fi

  if [ ! -f "$ledger" ]; then
    echo "→ warn: no ledger at $ledger, run not recorded" >&2
    return 0
  fi

  if printf '| %s | %s | %s | %s | %s | %s | pending | %s |\n' \
    "$(date +%Y-%m-%d)" "$arm_label" "$kind" "$subject" "$cost" "$turns" \
    "$output_cell" >>"$ledger"; then
    echo "→ ledger row appended to ${ledger#"$REPO_ROOT"/}" >&2
  else
    echo "→ warn: could not append the ledger row to $ledger" >&2
  fi
}

# Remove the candidate lines from the installed seed, so the two halves of a
# pair differ in those lines and in nothing else.
#
# A miss is fatal rather than a warning. A cut half that silently kept its
# section is indistinguishable from its partner in the ledger and in the
# retained output both, so it would read as a null result for the section
# instead of as a broken run. Stop before spending the API call.
strip_seed_section() {
  local file="$1"
  local tmp="$file.ablate"
  local anchor matches

  for anchor in "${ablate_anchors[@]}"; do
    matches="$(grep -cF -- "$anchor" "$file" || true)"
    if [ "$matches" != 1 ]; then
      echo "→ anchor matched $matches lines, expected 1: $anchor" >&2
      echo "→ the seed moved under this ablation, so the strip is not trustworthy" >&2
      exit 1
    fi
    grep -vF -- "$anchor" "$file" >"$tmp"
    mv "$tmp" "$file"
  done

  # Collapse the blank pair a removed heading leaves behind. The seed is
  # prettier-formatted and carries no double blank of its own, so this only
  # ever closes a gap the strip opened.
  awk 'NF == 0 { if (blank++) next } NF { blank = 0 } { print }' "$file" >"$tmp"
  mv "$tmp" "$file"

  echo "→ ablated $ablate_section, ${#ablate_anchors[@]} anchors matched" >&2
}

# The fixture must live outside the repo. A fixture under the repo would load
# this project's CLAUDE.md through the ancestor chain and contaminate the run.
workdir="$(mktemp -d "${TMPDIR:-/tmp}/canon-eval-XXXXXX")"
trap 'rm -rf "$workdir"' EXIT

tar -xzf "$SCRIPT_DIR/fixture.tar.gz" -C "$workdir"
fixture="$workdir/$arm_dir/feedwatch"

if [ "$arm" = seed ]; then
  # Install through the real CLI rather than copying the tree, so the arm
  # exercises what a project actually receives: the executable bit on the four
  # hooks and the settings.json merge that registers them. Copying the seed
  # folder would skip both and test a state no project is ever in.
  #
  # Invoke the CLI by path, never the globally linked `canon`. PROJECT_ROOT
  # resolves from the CLI's own source directory, so a global binary would
  # install the main checkout's seed and silently ignore the edits under test.
  cli=("bun" "run" "$REPO_ROOT/src/cli.ts")

  # `canon claude init` seeds .claude/ and CLAUDE.md and installs no standards,
  # which is the whole shape now. The base stack's rules cite `canon standards
  # <name>` rather than a path, and that verb answers from the corpus inside the
  # package, so there is no second call and no half-installed state to avoid.
  CANON_NON_INTERACTIVE=1 "${cli[@]}" claude init "$fixture" >&2

  # Governance is not optional for this arm. The seed routes markdown, context,
  # and task edits through rules in the base stack rather than carrying its own
  # copies, so a fixture without them measures a project that no longer exists.
  # The first run omitted this and its prose finding was confounded as a result.
  CANON_NON_INTERACTIVE=1 "${cli[@]}" gov install base "$fixture" >&2

  # Strip after every installer has run, since each one may write CLAUDE.md and
  # a strip before the last would be overwritten without a word.
  if [ "${ablate_half:-}" = cut ]; then
    strip_seed_section "$fixture/CLAUDE.md"
  fi

  # Initialize git after the install, so the seed's .gitignore means something
  # and the rules that shell out to git are reachable rather than failing on a
  # non-repo. A section the fixture puts out of reach cannot be judged unused.
  git -C "$fixture" init --quiet
  git -C "$fixture" add -A
  git -C "$fixture" -c user.email=eval@local -c user.name=eval \
    commit --quiet -m "scaffold"
else
  mkdir -p "$fixture/.claude/standards" "$fixture/$(dirname "$dest")"
  cp "$REPO_ROOT/standards/$standard" "$fixture/.claude/standards/$standard"
  # The attribute standard too, since a standard under test cites whichever
  # governs it and a missing one leaves the citation dangling in the arm rather
  # than in the repo.
  cp "$REPO_ROOT/standards/markdown.md" "$fixture/.claude/standards/markdown.md"
fi

# acceptEdits alone treats paths under .claude/ as sensitive and refuses them,
# which cost two inconclusive runs before it was diagnosed. Fixture-local
# settings do not fix it either, because an untrusted workspace makes Claude
# Code ignore permissions.allow, and a mktemp path is never trusted. Skipping
# permissions is what remains.
#
# What makes that acceptable is not the fixture. The flag grants tool use
# across the filesystem, not within a directory, so a disposable fixture bounds
# the blast radius of nothing. What bounds it is the task: the cwd is the
# fixture, the prompt names one file to write, and no credential or repo path
# is in reach of the instruction. Copy the flag only where the same three hold.

echo "→ arm: $arm" >&2
echo "→ fixture: $fixture" >&2

if [ "$arm" = seed ]; then
  # An ordinary feature request, phrased the way a user would. It names no
  # .claude/ path and no seed file on purpose: naming one tells the session
  # where to look and measures obedience rather than discoverability, which is
  # the opposite of what a seed audit is for. A variant prompt is written to
  # the same rule and reaches one section's trigger instead of the sinks.
  if [ -n "$variant_prompt" ]; then
    prompt="$variant_prompt"
  else
    prompt="Add a Slack delivery sink to feedwatch, alongside the existing webhook \
and email sinks. It should post each new item to a Slack incoming webhook URL \
read from the environment."
  fi
else
  prompt="This project has no $(dirname "$dest")/ entry yet. Read .claude/standards/$standard \
and author $surface at $dest, following that standard. Write the file."
fi

# Snapshot the fixture before the run so the artifact can be recovered by
# difference afterward, wherever the session decided to put it. The snapshot
# lives in the workdir rather than its own mktemp file, so the existing trap
# removes it even when the run below fails under set -e.
#
# Hash rather than list. The seed arm needs edits to files the fixture already
# had, and a name-only snapshot reports a rewritten sink as unchanged.
#
# Worktrees are excluded by name rather than by the .git filter. A linked
# worktree's .git is a file, so its duplicated tree passes that filter and
# buries the real changes: run 01 reported forty such lines around three real
# ones. The seed tells a session to create one, so this is the normal path.
before="$workdir/.eval-before"
find "$fixture" -type f -not -path '*/.git/*' -not -path '*/.claude/worktrees/*' \
  -exec md5sum {} + | sort >"$before"

if [ "$arm" = seed ]; then
  # stream-json rather than json, because the finding is which seed files the
  # session opened and only the per-turn tool_use blocks carry real file_path
  # values. Never grep the transcript for a filename: the seed names its own
  # paths, so a grep hits the instruction text rather than a read of the file.
  # -p with stream-json requires --verbose.
  transcript="$workdir/transcript.jsonl"
  (cd "$fixture" && claude -p "$prompt" --output-format stream-json --verbose \
    --dangerously-skip-permissions </dev/null) >"$transcript"

  summary="$(jq -c 'select(.type == "result")' <"$transcript" | tail -1)"
  cost="$(jq -r '.total_cost_usd // "unknown"' <<<"$summary")"
  turns="$(jq -r '.num_turns // "unknown"' <<<"$summary")"
  echo "cost_usd: $cost | turns: $turns" >&2

  retained=yes
  retain_run_output "$transcript" transcript.jsonl || retained=no

  # Retain the seed the run actually read. A pair is only re-diffable later if
  # both halves recorded what they were handed, and the cut half's CLAUDE.md
  # exists nowhere else once the trap clears the workdir.
  #
  # Routed through the same flag as the transcript rather than swallowed. A row
  # claiming a retained output while the file that makes the pair re-diffable
  # is missing records a directory that cannot answer the question it is cited
  # for, and nothing else would report the gap.
  retain_run_output "$fixture/CLAUDE.md" claude-md.txt || retained=no

  append_ledger_row "$cost" "$turns" "$retained"

  calls="$workdir/.eval-calls"
  jq -r 'select(.type == "assistant") | .message.content[]?
    | select(.type == "tool_use")
    | [.name, (.input.file_path // .input.path // .input.pattern
        // .input.command // .input.notebook_path // "")]
    | @tsv' <"$transcript" >"$calls"

  echo "## Seed surface opened"
  echo
  echo '```plaintext'
  # Match anywhere in the call, not just at a path boundary. A session that
  # consults an index by `cat canon/context/index.md` reaches the seed exactly
  # as much as one that Reads it, and an anchored pattern reported the first
  # kind as "(none)". Session-owned scratch and worktree paths match too, so
  # read the list rather than counting it.
  grep -E "CLAUDE\.md|\.claude/" "$calls" | sort -u || echo "(none)"
  echo '```'
  echo
  echo "## Every tool call, in order"
  echo
  echo '```plaintext'
  cat "$calls"
  echo '```'
  echo
  echo "## Files the run created or changed"
  echo
  echo '```plaintext'
  find "$fixture" -type f -not -path '*/.git/*' -not -path '*/.claude/worktrees/*' \
    -exec md5sum {} + | sort | comm -13 "$before" - |
    sed "s|^[0-9a-f]*  $fixture/||" | sort || true
  echo '```'
  echo
  echo "## Final message"
  echo
  jq -r '.result // ""' <<<"$summary"
  exit 0
fi

result="$(cd "$fixture" && claude -p "$prompt" --output-format json \
  --dangerously-skip-permissions </dev/null)"

cost="$(jq -r '.total_cost_usd // "unknown"' <<<"$result")"
turns="$(jq -r '.num_turns // "unknown"' <<<"$result")"
echo "cost_usd: $cost | turns: $turns" >&2

# Retained as `result.json` rather than `transcript.jsonl`, because these arms
# ask for a single judged artifact and run under `--output-format json`. The
# seed arm needs per-turn tool_use blocks and so takes the stream instead.
printf '%s' "$result" >"$workdir/result.json"
retained=yes
retain_run_output "$workdir/result.json" result.json || retained=no
append_ledger_row "$cost" "$turns" "$retained"

# A session that cannot write the requested path may write somewhere else
# entirely, so recover from what the run actually created rather than trusting
# the path. Collect every new markdown file: picking one would silently drop the
# artifact whenever a run leaves notes beside it, and sort order does not track
# which file matters.
created_md=()
while IFS= read -r created; do
  case "$created" in
  *.md) created_md+=("$created") ;;
  esac
done < <(find "$fixture" -type f -not -path '*/.git/*' -not -path '*/.claude/worktrees/*' \
  -exec md5sum {} + | sort | comm -13 "$before" - |
  sed 's|^[0-9a-f]*  ||' | sort)

# The requested path first when the run used it, then everything else.
ordered=()
for candidate in ${created_md[@]+"${created_md[@]}"}; do
  [ "$candidate" = "$fixture/$dest" ] && ordered+=("$candidate")
done
for candidate in ${created_md[@]+"${created_md[@]}"}; do
  [ "$candidate" != "$fixture/$dest" ] && ordered+=("$candidate")
done

for candidate in ${ordered[@]+"${ordered[@]}"}; do
  rel="${candidate#"$fixture"/}"
  echo "→ artifact recovered from $rel" >&2
  echo "<!-- recovered: $rel -->"
  cat "$candidate"
  echo
done

[ ${#ordered[@]} -gt 0 ] && echo "<!-- run commentary follows -->"

jq -r '.result // ""' <<<"$result"
