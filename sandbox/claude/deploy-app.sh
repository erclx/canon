#!/usr/bin/env bash
set -e
set -o pipefail

# Two pick-only arms, one host signal each. Both host procedures call live
# `wrangler`, `vercel`, and `gh` against real accounts, so neither arm drives
# past the Pick step. Run each under a permission mode that denies every tool
# outside the read set, which is what keeps the session off any account rather
# than the prompt asking it to stop.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  log_info "cloudflare : a wrangler.toml and nothing for Vercel, skill picks cloudflare"
  log_info "vercel     : a vercel.json and nothing for Cloudflare, skill picks vercel"
  select_or_route_scenario "Which scenario?" "cloudflare" "vercel"

  cat <<'EOF' >package.json
{
  "name": "pick-host",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "vite build"
  }
}
EOF

  case "$SELECTED_OPTION" in
  "cloudflare")
    cat <<'EOF' >wrangler.toml
name = "pick-host"
pages_build_output_dir = "dist"
EOF
    git add . && git commit -m "chore(deploy): add the wrangler config" --no-verify -q
    ;;
  "vercel")
    cat <<'EOF' >vercel.json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist"
}
EOF
    git add . && git commit -m "chore(deploy): add the vercel config" --no-verify -q
    ;;
  esac

  log_step "Scenario ready: pick-only, $SELECTED_OPTION signal"
  log_info "Action:  /canon:deploy-app Pick the host, then stop before running any command."
  log_info "Tools:   drive it with no shell, so no wrangler, vercel, or gh call can run:"
  log_info "         CANON_SKILL_TEST_TOOLS=Read,Glob,Grep,Skill"
  log_info "         CANON_SKILL_TEST_PERMISSION_MODE=dontAsk"
  log_info "Expect:  declared in fixtures/claude/deploy-app/$SELECTED_OPTION/expect.toml"
  log_info "         Check it with: canon sandbox check claude:deploy-app $SELECTED_OPTION"
}
