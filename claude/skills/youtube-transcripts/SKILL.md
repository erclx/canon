---
name: youtube-transcripts
description: Fetches a YouTube video transcript with metadata frontmatter into the current repo via `canon transcripts`. Use when the user pastes a YouTube URL and asks to "grab the transcript", pull captions, or save a transcript for context. Do NOT use for downloading the video file, summarizing a transcript that already exists, or non-YouTube links.
---

# YouTube transcripts

Turn a pasted YouTube URL into a markdown file with YAML frontmatter and a cleaned prose body. The `canon transcripts` command owns the fetch, the VTT cleanup, and the frontmatter shape. Do not reimplement or restate any of it here.

## Guards

- If no URL is provided, stop: `❌ No URL. Paste a YouTube link to fetch.`
- If the link is not a YouTube URL, stop: `❌ Not a YouTube URL. This skill fetches YouTube captions only.`

## Prerequisite

The command shells out to the `yt-dlp` binary. If a run fails with a `yt-dlp not found` message, tell the user to install it from `https://github.com/yt-dlp/yt-dlp` and stop. Do not attempt to install it.

## Run

From the project root, fetch the URL:

```bash
canon transcripts <url>
```

- Pass `--keep-timestamps` when the user wants `[mm:ss]` markers per line instead of prose.
- Pass `--out <dir>` to override the output directory. The default is `transcripts/` in the current directory.
- The written file path prints to stdout. Surface it back to the user as a full relative path, in the form the project's instruction file sets under `## Output`.

## After the fetch

- When the run reports `has_transcript: false`, tell the user the video has no auto-captions. The file still exists with frontmatter for later use.
- Do not summarize or annotate the transcript unless the user asks. Fetching and reading are separate requests.
