#!/usr/bin/env bash

# Fixture files carry this suffix so the repository's own checks ignore them.
# A stored `index.md.fixture` is not an `index.md`, so the index walker, prettier,
# shfmt, and shellcheck all skip it and the bytes reach the sandbox unmodified.
FIXTURE_SUFFIX=".fixture"

# The tree mirrors the scenario path, so `category` and `scenario` together match
# `sandbox/<category>/<scenario>.sh`. Both segments are load-bearing:
# four scenario basenames repeat across categories (`claude`, `docs`, `review`,
# `sync`), and `docs` is also a category of its own.
fixture_stage_dir() {
  local category="$1"
  local scenario="$2"
  local arm="$3"
  local stage="$4"
  echo "$PROJECT_ROOT/sandbox/fixtures/$category/$scenario/$arm/$stage"
}

list_fixture_files() {
  local source_dir="$1"
  find "$source_dir" -type f -name "*$FIXTURE_SUFFIX" -print0 | sort -z
}

count_fixture_files() {
  local source_dir="$1"
  if [ ! -d "$source_dir" ]; then
    echo 0
    return 0
  fi
  find "$source_dir" -type f -name "*$FIXTURE_SUFFIX" | wc -l
}

# The copy loops match on the suffix, so a file without one would be skipped in
# silence and the scenario would provision a tree it was never meant to have.
assert_fixtures_suffixed() {
  local source_dir="$1"
  [ -d "$source_dir" ] || return 0

  local stray
  stray="$(find "$source_dir" -type f -not -name "*$FIXTURE_SUFFIX" | sort | tr '\n' ' ')"
  [ -z "$stray" ] || log_error "Fixture missing the $FIXTURE_SUFFIX suffix: $stray"
}

fixture_target_path() {
  local source_dir="$1"
  local source_file="$2"
  local relative="${source_file#"$source_dir"/}"
  echo "${relative%"$FIXTURE_SUFFIX"}"
}

create_from_fixtures() {
  local source_dir="$1"
  [ -d "$source_dir" ] || return 0

  local source_file target
  while IFS= read -r -d '' source_file; do
    target="$(fixture_target_path "$source_dir" "$source_file")"
    mkdir -p "$(dirname "$target")"
    cp "$source_file" "$target"
  done < <(list_fixture_files "$source_dir")
}

# An append fixture extends a file the anchor or the injected seeds already
# provide. A missing target means that upstream shape changed, so fail rather
# than create the file and silently alter what the scenario provisions.
append_from_fixtures() {
  local source_dir="$1"
  [ -d "$source_dir" ] || return 0

  local source_file target
  while IFS= read -r -d '' source_file; do
    target="$(fixture_target_path "$source_dir" "$source_file")"
    if [ ! -f "$target" ]; then
      log_error "Append fixture has no target: $target"
    fi
    cat "$source_file" >>"$target"
  done < <(list_fixture_files "$source_dir")
}

# Stages the first `count` markdown files the toolkit ships for a domain into
# `dest`, flattening any source subfolder. Source rather than fixture tree,
# because an arm modelling a real install wants the files a target actually
# received and a copy under `fixtures/` would drift from them silently.
#
# The flattening is load-bearing rather than incidental. Both `detectUnmigrated`
# and the sync engine match a target file to its source by basename against the
# flat domain root, so a file lifted out of a source subfolder such as `bundled/`
# has no flat sibling and reads as project-authored. An arm staging one claims a
# drift or an unmigrated domain it did not stage.
stage_toolkit_markdown() {
  local src="$1"
  local dest="$2"
  local count="$3"

  mkdir -p "$dest"
  while IFS= read -r file; do
    cp "$file" "$dest/$(basename "$file")"
  done < <(find "$src" -maxdepth 1 -type f -name "*.md" ! -name "index.md" | sort | head -n "$count")
}

# The newest top-level path history records a deletion under that the toolkit no
# longer ships. Read from history rather than hardcoded, so an arm stages a root
# the walk will actually recognize instead of a name that has since come back.
# `prompts` is preferred because it is the case measured in a real target, and
# any other dropped root exercises the same walk.
pick_dropped_root() {
  local preferred="prompts"
  local first=""
  local candidate

  while IFS= read -r candidate; do
    [ -e "$PROJECT_ROOT/$candidate" ] && continue
    [ "$candidate" = "$preferred" ] && {
      echo "$preferred"
      return 0
    }
    [ -n "$first" ] || first="$candidate"
  done < <(git -C "$PROJECT_ROOT" log --all --diff-filter=D --name-only --format= |
    awk -F/ 'NF > 1 { print $1 }' | sort -u)

  echo "$first"
}

# Restores one file's exact published bytes from the commit before it was
# deleted. Content is what the attribution matches on, so a file written by hand
# would report unattributed and an arm would assert the wrong verdict.
#
# Both reads take the whole listing through a process substitution rather than a
# pipeline ending in an early exit. `set -o pipefail` is on, and a `grep -m 1`
# that matches the first line closes the pipe while git is still writing, so the
# substitution returns git's SIGPIPE status and the arm fails on a listing it
# actually read.
restore_dropped_file() {
  local root="$1"
  local rel="" commit="" line

  while IFS= read -r line; do
    case "$line" in
    "$root"/*)
      rel="$line"
      break
      ;;
    esac
  done < <(git -C "$PROJECT_ROOT" log --all --diff-filter=D --name-only \
    --format= -- "$root/")

  [ -n "$rel" ] || return 1

  while IFS= read -r line; do
    commit="$line"
    break
  done < <(git -C "$PROJECT_ROOT" log --all --diff-filter=D --format=%H -- "$rel")

  [ -n "$commit" ] || return 1

  mkdir -p "$(dirname "$rel")"
  git -C "$PROJECT_ROOT" show "$commit^:$rel" >"$rel" || return 1

  echo "$rel"
}

# Stages one step of a scenario arm into the sandbox working directory.
# Scenarios call this once per step so their own git operations stay between
# the steps, where they are visible.
stage_fixtures() {
  local category="$1"
  local scenario="$2"
  local arm="$3"
  local stage="$4"

  local stage_dir
  stage_dir="$(fixture_stage_dir "$category" "$scenario" "$arm" "$stage")"

  if [ ! -d "$stage_dir" ]; then
    log_error "Fixture stage not found: $category/$scenario/$arm/$stage"
  fi

  assert_fixtures_suffixed "$stage_dir/create"
  assert_fixtures_suffixed "$stage_dir/append"

  local staged
  staged=$(($(count_fixture_files "$stage_dir/create") + \
  $(count_fixture_files "$stage_dir/append")))
  if [ "$staged" -eq 0 ]; then
    log_error "Fixture stage provisions nothing: $category/$scenario/$arm/$stage"
  fi

  create_from_fixtures "$stage_dir/create"
  append_from_fixtures "$stage_dir/append"
}
