#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/gov.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

use_anchor() {
  use_sandbox_anchor
}

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_GOV="true"
}

stage_setup() {
  local src_rules="$PROJECT_ROOT/governance/rules"

  configure_sandbox_anchor_remote

  # Governance is the one domain staged stale here. Standards left the sync
  # domains with the install channel, so a target holds no copy for a sync to
  # reconcile.
  local -a stale_rules=()
  while IFS= read -r file; do
    local rule
    rule=$(basename "$file" .md)
    local subdir
    subdir=$(rule_subdir "$file" "$src_rules")
    local dest=".claude/rules/canon/${rule}.md"
    [ -n "$subdir" ] && dest=".claude/rules/canon/$subdir/${rule}.md"
    [ -f "$dest" ] || continue
    echo "# stale" >>"$dest"
    stale_rules+=("${dest#.claude/rules/canon/}")
    [ "${#stale_rules[@]}" -eq 2 ] && break
  done < <(find "$src_rules" -type f -name "*.md" | sort)

  git add .
  git commit -m "chore(sandbox): make governance stale" --no-verify -q

  git push --force origin HEAD:main -q
  git ls-remote --heads origin 'chore/canon-sync*' 2>/dev/null |
    awk '{print $2}' | sed 's|refs/heads/||' |
    while read -r b; do git push origin --delete "$b" -q 2>/dev/null || true; done

  log_step "Sync sandbox"
  log_info "Anchor: $ANCHOR_REPO"
  log_info "Stale rules: ${stale_rules[*]}"
  log_info "Remote: $(sandbox_anchor_url)"

  log_step "Running: canon sync"
  exec bun "$PROJECT_ROOT/src/cli.ts" sync .
}
