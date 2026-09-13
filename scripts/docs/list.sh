#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"

source "$PROJECT_ROOT/scripts/lib/ui.sh"
source "$PROJECT_ROOT/scripts/lib/frontmatter.sh"

DOCS_DIR="$PROJECT_ROOT/docs"
CONTEXT_DIR="$PROJECT_ROOT/canon/context"

INTERNAL_TOPICS=" ci development sandbox "

show_help() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Usage:${NC} canon docs list [options]"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Options:${NC}"
  echo -e "${GREY}│${NC}    --json       ${GREY}# Emit machine-readable JSON${NC}"
  echo -e "${GREY}│${NC}    -h, --help   ${GREY}# Show this help message${NC}"
  echo -e "${GREY}└${NC}"
  exit 0
}

is_target_facing() {
  case "$1" in
  "Agent surface" | "Domain references") return 0 ;;
  *) return 1 ;;
  esac
}

is_internal_topic() {
  case "$INTERNAL_TOPICS" in
  *" $1 "*) return 0 ;;
  *) return 1 ;;
  esac
}

# Emits `name<TAB>description<TAB>category<TAB>target` per target-facing doc,
# sorted so a domain split into a folder lands in its alphabetical place rather
# than after every file. A folder declares its category on its own index, since
# the allowlist is what separates a target-facing doc from a workflow one and a
# split domain is not exempt from it. A sub-area file declares its own, which is
# what keeps a page's listing membership unchanged by the folder it moves into.
collect_docs() {
  local file name description category
  {
    while IFS= read -r file; do
      name=$(basename "$file" .md)
      [ "$name" = "index" ] && continue
      category=$(read_frontmatter_field "$file" "category")
      is_target_facing "$category" || continue
      description=$(read_frontmatter_field "$file" "description")
      printf '%s\t%s\t%s\t%s\n' "$name" "$description" "$category" "docs/$name.md"
    done < <(find "$DOCS_DIR" -maxdepth 1 -type f -name "*.md")

    # A split domain is named by its folder and described by its generated
    # index, which carries subtitle where a sibling file carries description
    while IFS= read -r file; do
      name=$(basename "$(dirname "$file")")
      category=$(read_frontmatter_field "$file" "category")
      is_target_facing "$category" || continue
      description=$(read_frontmatter_field "$file" "subtitle")
      printf '%s\t%s\t%s\t%s\n' "$name" "$description" "$category" "docs/$name/index.md"
    done < <(find "$DOCS_DIR" -mindepth 2 -maxdepth 2 -type f -name "index.md")

    # A sub-area file is named and described like a sibling file, and reaches a
    # caller by that bare name, so the depth it sits at is not the listing's
    # business. Only a folder carrying an index is walked, matching resolveTopic
    while IFS= read -r file; do
      name=$(basename "$file" .md)
      [ "$name" = "index" ] && continue
      [ -f "$(dirname "$file")/index.md" ] || continue
      category=$(read_frontmatter_field "$file" "category")
      is_target_facing "$category" || continue
      description=$(read_frontmatter_field "$file" "description")
      printf '%s\t%s\t%s\t%s\n' "$name" "$description" "$category" "docs/$(basename "$(dirname "$file")")/$name.md"
    done < <(find "$DOCS_DIR" -mindepth 2 -maxdepth 2 -type f -name "*.md")
  } | sort
}

# Emits `name<TAB>description<TAB>target` per context entry, sorted so a domain
# split into a folder lands in its alphabetical place rather than after every
# file, the way listTopics in src/docs/read.ts sorts both together.
#
# It stops at the folder where listTopics goes on to name each sub-area file.
# This is the downstream catalog and that one answers what a caller could have
# typed, so a reachable name absent here is the same divergence the internal
# topics already carry, and `canon docs docs` states it.
collect_context() {
  local file name description
  {
    while IFS= read -r file; do
      name=$(basename "$file" .md)
      [ "$name" = "index" ] && continue
      is_internal_topic "$name" && continue
      description=$(read_frontmatter_field "$file" "description")
      printf '%s\t%s\t%s\n' "$name" "$description" "canon/context/$name.md"
    done < <(find "$CONTEXT_DIR" -maxdepth 1 -type f -name "*.md")

    # A split domain is named by its folder and described by its generated
    # index, which carries subtitle where a sibling file carries description
    while IFS= read -r file; do
      name=$(basename "$(dirname "$file")")
      is_internal_topic "$name" && continue
      description=$(read_frontmatter_field "$file" "subtitle")
      printf '%s\t%s\t%s\n' "$name" "$description" "canon/context/$name/index.md"
    done < <(find "$CONTEXT_DIR" -mindepth 2 -maxdepth 2 -type f -name "index.md")
  } | sort
}

list_text() {
  local name description category target
  log_step "Docs"
  while IFS=$'\t' read -r name description category target; do
    log_info "$name : $description"
  done < <(collect_docs)

  # Absent in a registry install, which ships docs/ without .claude/
  if [ -d "$CONTEXT_DIR" ]; then
    log_step "Domain context"
    while IFS=$'\t' read -r name description target; do
      log_info "$name : $description"
    done < <(collect_context)
  fi
}

emit_json_entry() {
  local name="$1" description="$2" category="$3" target="$4"
  [ "$JSON_FIRST" -eq 0 ] && printf ','
  jq -nc \
    --arg name "$name" \
    --arg description "$description" \
    --arg category "$category" \
    --arg target "$target" \
    '{name: $name, description: $description, category: $category, target: $target}'
  JSON_FIRST=0
}

list_json() {
  local name description category target
  JSON_FIRST=1
  printf '['
  while IFS=$'\t' read -r name description category target; do
    emit_json_entry "$name" "$description" "$category" "$target"
  done < <(collect_docs)

  if [ -d "$CONTEXT_DIR" ]; then
    while IFS=$'\t' read -r name description target; do
      emit_json_entry "$name" "$description" "" "$target"
    done < <(collect_context)
  fi
  printf ']'
}

main() {
  local json=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
    -h | --help) show_help ;;
    --json)
      json=1
      shift
      ;;
    *) log_error "Unknown option: $1" ;;
    esac
  done

  trap close_timeline EXIT

  if [ "$json" -eq 1 ]; then
    printf '{"docs":'
    list_json
    printf '}\n'
    exit 0
  fi

  list_text
}

main "$@"
