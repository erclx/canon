---
title: shadcn on an app root
description: The preview question, its headless default, and the install step that initializes shadcn on a vite-react or nextjs root before the second detection
---

# shadcn on an app root

The `install` phase asks whether to initialize shadcn on an app root, being a language root whose tooling stack resolved to `vite-react` or `nextjs`. An app builds dialogs, menus, and selects, and shadcn hands it accessible primitives the project owns as source. The `gov` phase installs rules alone and asks nothing.

Skip the question on every other root. An `astro` site keeps its own components, and a root with no app stack has nothing to initialize.

## Ask

Ask it in the one structured ask the detect reference states, with two options. One answer covers every app root in the repository.

- Yes, the recommended first option, which adds the init to the **Commands** row once per app root
- No, which leaves the app to build its components by hand

### Answering ahead

A `--shadcn yes` or `--shadcn no` argument answers ahead of time and skips the question.

- With neither and no one to answer, take yes on an app root and say so in the preview and the report, so an install nobody asked for stays visible
- Yes is the default because a declined init leaves each later session hand-building primitives, while an unwanted one costs a removal of `components.json`, `src/components/ui/`, and `src/lib/utils.ts`

## Install

On a yes, initialize shadcn in each app root once every sync in Step 2 has finished and ahead of Step 3. Read the sequence from `canon tooling reference web` under `## Adding shadcn`, which names the stylesheet, template, and flags per stack, rather than composing the command here.

- Run it from the app root, which is the target itself on a single-root project
- Run it before the second detection, since that pass proposes the shadcn rule only once `components.json` exists
- Treat a failed or timed-out init as a gap the report names, and carry on with Step 3

## Report

Name the answer and what answered it, each app root initialized, and whether the second detection proposed the shadcn rule.
