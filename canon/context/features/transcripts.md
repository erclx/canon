---
title: Transcripts
description: Fetch YouTube transcripts with metadata frontmatter into any repo
---

# Transcripts

## Overview

`canon transcripts <url>` fetches a YouTube video's captions and writes them as a markdown file with metadata frontmatter. It wraps `yt-dlp`, cleans the raw VTT captions into readable prose, and tags the output with the video's title, channel, duration, and publish date. The companion plugin skill drives the command from a chat request.

## Layout

- `src/transcripts/` owns the fetch wrapper, the VTT cleanup, and the metadata extraction
- `claude/skills/youtube-transcripts/` owns the plugin skill that drives the command

### Related

`docs/agents/commands.md` holds the CLI flags and invocation contract for `canon transcripts`.

## Decisions

### Toolkit-native and missing captions

The command is toolkit-native. It runs against the current working directory, so any repo with `canon` and `yt-dlp` on PATH can pull transcripts without installing anything.

When a video has no captions, the command still writes the frontmatter with `has_transcript: false` and a one-line note in place of the body. A missing transcript is a recorded fact rather than a silent gap.

### External dependency

The command shells out to the `yt-dlp` binary, as the git skills shell out to `git` and `gh`. It is not bundled. Install it from the [yt-dlp project](https://github.com/yt-dlp/yt-dlp) first. The command checks for it on PATH and fails with an install pointer when it is missing.

### Fetch command

`canon transcripts <url>` writes one file per video to the output directory, named `<fetch-date>--<title-slug>--<video-id>.md`. The date prefix means re-fetching a video on a later date writes a new file rather than overwriting the earlier one.

| Option              | Default                         | Behavior                                             |
| ------------------- | ------------------------------- | ---------------------------------------------------- |
| `--out <path>`      | the backed `transcripts` folder | Output directory, resolved against the main worktree |
| `--keep-timestamps` | off                             | Prefix each line with `[mm:ss]` instead of prose     |

- The default output directory is a backed record folder, so `canon records push` and `canon records pull` carry it with the rest
- The first run in a directory writes a minimal `index.md` stub, left alone on every later run
- A caller-supplied `--out` resolves against the CWD, since naming a path is opting out of the backed default
- The written file path prints to stdout so it pipes clean into a wrapper, and the framed run UI goes to stderr

### Output shape

Each file opens with frontmatter, then an `# <title>` heading, then the transcript body.

```markdown
---
title: 'How transformers work'
channel: 'Some Channel'
video_id: dQw4w9WgXcQ
url: https://www.youtube.com/watch?v=dQw4w9WgXcQ
duration: 612
published: 2026-01-14
fetched_at: 2026-06-18
has_transcript: true
---

# How transformers work

...
```

The body is the value-add over a raw caption dump. YouTube auto-captions arrive as rolling VTT cues that repeat each line as the window slides. The parser strips the inline tags, removes the rolling overlap, and joins the result into paragraphs. With `--keep-timestamps`, it emits one `[mm:ss]` line per cue instead.

### Scope

The command fetches one URL per run. Curated-channel batch mode, where a channel list resolves to recent uploads, is a planned follow-up.
