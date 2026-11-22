---
title: Planned services
description: The planned-services question the install phase asks ahead of the first commit, how each named service resolves to a stack or a gap, and the argument answering it ahead
---

# Planned services

Detection reads folders that exist, so a service the project will carry but has no files for yet is never seen. The `install` phase asks for those ahead of the first commit, since a service added after it lands configs and CI changes the root commit never ran. The `gov` phase installs rules alone and asks nothing.

## Ask

Ask it as its own question in the one structured ask the detect reference names, with two options.

- None planned, the recommended first option
- Name them, which the operator types as a comma-separated list of `<folder>:<kind>`, such as `api:python` or `worker:cloudflare`

Offer a subfolder in another language, a Cloudflare Worker, and a database as the examples in the question text, so the operator reads what counts as a service.

## Resolve each service

Match each kind against the stacks `canon tooling list --json` returned, the way a detected language root resolves, and give the service a preview row.

- A kind matching a stack takes `canon tooling sync <stack> ./<folder> --skip base --write`, the monorepo route's subtree command
- Create the folder first when it does not exist, since the sync writes into it
- A kind matching no stack, such as a database, takes no command, and its row is marked `gap`
- Carry each `gap` row into the report's detection gaps, surfaced rather than guessed as the detect reference's gap handling states
- A folder that already holds a marker is a detected root, so drop the planned row and say detection already covers it

A stack-matched kind in a language the governance stack does not carry adds its language rule to the extras by name, read from `canon gov list --json`, as a detected subfolder root does. `canon gov detect` proposes no language rule, so without this the service lands its tooling and none of its rules.

## Answering ahead

A `--services <folder>:<kind>,<folder>:<kind>` argument answers ahead of time and skips the question. `--services none` declares none.

- With neither and no one to answer, plan no service and say so in the preview and the report
- Planning none is the default because a guessed service lands a folder nobody asked for, while a missed one costs the amend route the report names
