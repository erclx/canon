---
name: record-screencast
description: Drives a screencast draft through to a recording. Compiles it with `canon demo compile` when no plan exists yet at the default path, skipping compile when one is already there, runs `canon demo run` once nothing is unresolved, then composes the take into a finished mp4 through HyperFrames when the draft's wrap section asks for anything. Reports every unresolved field from the compile or run record and stops rather than guessing one. Use when asked to "record the screencast", "run the demo", "compile and record this draft", or right after `draft-screencast` prints its next-step line. Do NOT use to draft the beats, which is `draft-screencast`, or to fill in a plan's target or URL, which is the operator's own edit.
---

# Record screencast

## Guards

- If no draft path is given, stop: `❌ No draft path. Pass the path draft-screencast printed.`
- Never guess or fill an unresolved field, a target, a URL, or anything else the compile or run record names. Report it and stop. Filling one in reproduces the failure `canon demo run`'s `plan-unresolved` reason exists to catch, one layer up where nothing enforces it.
- Never pass `--force` to compile. A plan already at the default output path may carry timing tuned by hand, and the draft cannot reproduce that, so leave it untouched.
- Drive the application through `canon demo run` alone. Never open a browser, click through the app, or write to the output paths some other way.

## Step 1: resolve the plan path

A draft lives at `demos/<slug>/beats.md`, so `<slug>` is the name of the folder holding it, and the plan sits beside it at `demos/<slug>/plan.json`. `demos/inline-edit/beats.md` resolves to `demos/inline-edit/plan.json`. Pass `--slug <slug>` to compile, since its default reads the draft's filename and would name every demo `beats`.

A plan compiled before the folder layout sits at `demos/<slug>.json`. Pass it to Step 3 by path when the caller names it, since only the default moved.

## Step 2: compile only when no plan exists yet

Check whether the resolved plan path already exists.

- **It exists.** A person may have tuned it by hand since compiling. Skip compiling and go to Step 3 with this path.
- **It does not exist.** Run:

  ```bash
  canon demo compile <draft> --slug <slug> --json
  ```

  Branch on the record rather than the exit code:
  - `reason: draft-missing` or `reason: draft-unreadable`: report the reason, plus the record's `message` when it carries one, and stop.
  - No `reason` key, meaning the plan was written: read `unresolved` off the record.
    - Non-empty: report the plan path and every field the array names, one per line, and stop. Do not proceed to Step 3.
    - Empty: continue to Step 3 with the record's `plan` path.

## Step 3: run

Run:

```bash
canon demo run <plan> --json
```

Branch on the record's `reason`:

- `plan-unresolved`: report every field in `unresolved`, one per line, and stop. This is the path a pre-existing plan takes, since Step 2 skipped compiling and never read its fields.
- Any other reason (`plan-missing`, `plan-unreadable`, `no-output-requested`, `cursor-unreadable`, `engine-missing`, `browser-missing`): report the reason, plus the record's `message` or `install` line when it carries one, and stop.
- No `reason` key, meaning the run wrote its output: continue to Step 4.

The take lands in `demos/<slug>/take/`, which git ignores.

## Step 4: compose when the draft asks for it

Read the draft's `## Wrap` section. When intro, outro, and music all say `none`, or the section is absent, stop at the take and go to Step 6. Composing an empty video adds a render that says nothing the take does not.

Otherwise confirm HyperFrames' `hyperframes` skill resolves. `bunx` would fetch the package on a machine without it, which installs by the back door, so the skill is the presence test. When it does not resolve, stop and report the install command, `bunx -y hyperframes init`, with the warning that init installs its skills machine-wide without asking, and report the take's paths as Step 6 does so the operator still holds the recording the run wrote. Never install it from here.

When it resolves, load it and build `demos/<slug>/index.html` around the take, with the intro, outro, and music the wrap section names. That skill owns the composition rules, so this body states none of them. Then run both from `demos/<slug>/`:

```bash
bunx -y hyperframes check
bunx -y hyperframes render --quality delivery --output renders/<slug>.mp4
```

Report a failing check, with the take's paths, and stop rather than rendering past it. The render sits in `demos/<slug>/renders/`, which git ignores.

## Step 5: read the render

Hand the render to `read-frames` as its video path, so the composed result is checked rather than only the raw take.

## Step 6: output

The record carries `video`, `mp4`, `gif`, and `still`, each a path or `null`. Report each one that is not `null`, one per line, skipping the rest, and add the render path when Step 4 wrote one. Name the mp4 as the deliverable, the webm as the raw take, and the gif as the form for a host that strips video.

Say so plainly if `canon demo compile` or `canon demo run` is not available, rather than driving the application some other way. Both ship with the CLI and this skill ships with the plugin, so a project carrying one and not the other is a real state.
