#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-youtube-transcripts",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  mkdir -p bin
  cat <<'EOF' >bin/yt-dlp
#!/usr/bin/env bash
out_template=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-o" ]; then out_template="$arg"; fi
  prev="$arg"
done
work_dir=$(dirname "$out_template")
video_id="sandboxVid01"
cat >"$work_dir/$video_id.en.vtt" <<'VTT'
WEBVTT

00:00:00.000 --> 00:00:02.000
attention lets the model

00:00:02.000 --> 00:00:04.000
attention lets the model weigh tokens

00:00:04.000 --> 00:00:06.000
weigh tokens against each other
VTT
echo '{"id":"sandboxVid01","title":"How Attention Works","channel":"Deep Learning Daily","duration":372,"upload_date":"20260114","webpage_url":"https://www.youtube.com/watch?v=sandboxVid01"}'
EOF
  chmod +x bin/yt-dlp

  git add . && git commit -m "chore(sandbox): scaffold transcripts fixture and yt-dlp shim" --no-verify -q

  log_step "Scenario ready: youtube transcripts (offline shim)"
  log_info "Context: deterministic yt-dlp shim at bin/yt-dlp, no network needed"
  log_info "Action:  /youtube-transcripts https://youtu.be/sandboxVid01"
  log_info "Note:    launch claude with the shim on PATH: PATH=\"\$PWD/bin:\$PATH\" claude ..."
  log_info "Expect:  .canon/transcripts/<fetch-date>--how-attention-works--sandboxVid01.md with frontmatter and deduped prose"
}
