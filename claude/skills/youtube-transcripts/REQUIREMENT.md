---
name: youtube-transcripts
description: Why the transcript fetch stays in the CLI, and why fetching stops short of reading
---

# Youtube transcripts requirement

## Gap

Without this skill, a pasted video link becomes captions printed in chat, which persist nowhere and cannot be cited later. A saved transcript with its metadata is context the repository holds.

A session fetching on its own gets the shape wrong. Raw captions carry timing cues and duplicates, a file without frontmatter loses its source, and reimplemented cleanup drifts from the CLI. A video with no captions looks like a failed fetch, and a summary answers a question nobody asked.

## Must

- Run the CLI, which owns the fetch, the caption cleanup, and the frontmatter
- Surface the written path in full, in the form the project's instruction file sets under `## Output`
- Report a video with no captions as a fact about the video, since the file still exists and carries its metadata
- Name a missing external binary and stop, leaving the install to the user
- Stop on a missing URL or a link that is not a YouTube URL, since the command cannot fetch either

## Must not

- Reimplement the fetch or the cleanup
- Summarize or annotate the transcript unasked
- Install the external binary the command shells out to

## Out of scope

- Downloading the video or its audio, which no skill here owns
- Summarizing a transcript already on disk, which is a plain read of that file
- Choosing where transcripts live, which the command's default and its flag own
