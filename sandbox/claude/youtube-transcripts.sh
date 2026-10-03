#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude youtube-transcripts shared 01-initial

  chmod +x bin/yt-dlp

  git add . && git commit -m "chore(sandbox): scaffold transcripts fixture and yt-dlp shim" --no-verify -q

  log_step "Scenario ready: youtube transcripts (offline shim)"
  log_info "Context: deterministic yt-dlp shim at bin/yt-dlp, no network needed"
  log_info "Action:  /youtube-transcripts https://youtu.be/sandboxVid01"
  log_info "Note:    launch claude with the shim on PATH: PATH=\"\$PWD/bin:\$PATH\" claude ..."
  log_info "Expect:  .canon/transcripts/<fetch-date>--how-attention-works--sandboxVid01.md with frontmatter and deduped prose"
}
