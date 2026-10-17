---
title: Transcripts
description: Fetch YouTube transcripts with metadata frontmatter into any repo
---

# Transcripts

## Overview

`canon transcripts <url>` fetches one video's captions through `yt-dlp` and writes a markdown file carrying the video's metadata as frontmatter and the captions cleaned into prose. It runs against the current working directory, so any repository with `canon` and `yt-dlp` on PATH can use it. Start from `canon transcripts --help`.

## Layout

### `src/transcripts/`

Wraps `yt-dlp`, cleans its captions, and writes the file.

- A missing `yt-dlp` fails with an install pointer before any fetch runs
- The cleanup strips inline tags, drops the rolling overlap of auto-captions, and joins cues into paragraphs, and `--keep-timestamps` emits one `[mm:ss]` line per cue instead
- A video with no captions still writes the frontmatter with `has_transcript: false` and a one-line note as the body
- The file is named `<fetch-date>--<title-slug>--<video-id>.md`, so a later re-fetch writes a new file
- The default output folder is the backed `transcripts` record folder, resolved against the main worktree, and a caller's `--out` resolves against the current directory

### Other folders

The plugin skill that drives the command sits outside `src/`.

- `claude/skills/youtube-transcripts/` owns the plugin skill that drives the command from a chat request

## Gotchas

- The written path prints to stdout and the framed run UI goes to stderr, so a wrapper pipes the path clean
- The first run in a folder writes a minimal `index.md` stub and leaves it alone afterward
