---
title: Declined states
description: The four states that reach target-setup without the chain serving them, and the destination each routes to
---

# Declined states

Four states reach this skill that the chain does not serve. Name the destination for each, so the refusal routes rather than ends.

## An empty folder

Stop before `detect` when the target holds nothing but `.git`, and hand off to `target-scaffold`. Detection reads a stack from files a project carries, so an empty folder resolves to `base` and installs tooling onto no project. That skill starts the project and hands it back here.

## An existing project

Stop and hand off to `target-check`, which reports what the target already carries before anything is repaired. This chain never reads that, so a per-domain install picked here is a guess against configs nobody read. Name `target-update` when the operator wants the catch-up applied.

## The `.claude/` folder alone

Stop. Run `canon claude init` for the seed docs, then the `indexes` phase over the project's own documentation folders. Neither needs the tooling sync the `install` phase runs.

## A language with no stack

The chain still runs, on `base`, with the fallback marked in the preview. A project wanting none of `base` declines there and takes the `gov` phase, which is language-neutral and drops no `base` development dependencies.

Say so at the preview rather than resolving it here, since the fallback is a working default and only the person can say whether it fits.

## Route rather than build

Do not add a stack, a mode switch, or an existing-project branch to satisfy one of these. Each destination already exists and routing to it costs a line.
