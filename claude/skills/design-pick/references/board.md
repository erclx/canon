# The Frameboard board

Read before the first `frameboard` verb a `design-pick` run sends. It carries where the board sits, how the verbs are reached, how the server starts, the references page a round draws beside, and how a selection resolves to an answer.

## Reaching the board

Resolve `<board>` and `<project>` from the `board` and `project` keys of `canon/config/design.toml`, read at the main worktree root per `${CLAUDE_SKILL_DIR}/references/design-config.md`. A missing file or key falls back to `.canon/board/` and `picks`.

- Stop before starting a board when `<board>` came from that fallback, `.canon/board/` is absent, and `.canon/canvas/` exists
- Report `❌ The board is still at .canon/canvas/. Run canon migrate record-layout --write, then re-run.` on that stop
- A board started there drafts on an empty page set and leaves the migration a standing collision

Resolve `<board>` against the main worktree root, the way `session-worktree` resolves it, since a linked worktree holds no copy of the gitignored folder.

- Pass `--root <board> --project <project> --json` to every verb unless the step says otherwise, so no verb relies on the only-project default
- Where `frameboard` is not on PATH, run every verb as `bunx -y frameboard <verb>`. Say so once and keep that form for the run.
- The fallback takes the latest release unpinned, since the verbs and record shapes come from `frameboard docs --json` each run and a renamed verb surfaces as a refusal

Run `frameboard docs --json` before writing the first frame. Its `contentFormat` fixes what a frame may hold and link, and its `exitCodes` name every refusal a verb can return.

## Starting the board

Serve in the background unless the operator named an address that answers, since the server runs until its command ends:

```bash
frameboard serve --root <board> --no-open --tokens <stylesheet> --json
```

- Take `<stylesheet>` from the lead of `canon/DESIGN.md`, which names it in a hand-written record
- A lead naming a module, or no design document at all, means serving without `--tokens`. Say the frames render on the board's own tokens.
- Read `url` and `reused` off the record rather than composing an address
- `reused: true` means a server was already up, so this run did not start it and its close leaves it running
- Report a refusal's `error.code` and stop, since no file stands in for a board

## Drawing on the board

Read `drawing.md` beside this file before the first frame, for the widths, pages, layout, names, and heights every frame takes, and how a pick is asked.

## The references page

A round draws on the `references` page in `<project>`, which the `design-references` skill writes and owns. Start the board first, then read `frameboard list` for it.

- Reuse a `references` page that holds frames, since an earlier `design-references` run left it
- Otherwise invoke `canon:design-references` with the sites the ask names, or bare when it names none
- Draft on when that skill refuses or does not resolve, or the operator declines references, and say no reference backs the arms
- Never put `references` on the run's list of pages, so the close archives it beside the picked round and leaves it standing for the next round
- Find a reference's images in `<project>/assets/references/`, since Frameboard serves none from a page folder. The close's capture renders them into each frame, so nothing copies the folder.

## Reading the selection

Read `frameboard selection --root <board> --json` when the operator's answer points at the board, such as "the selected one". Resolve it against the record's `project` and `page` as well as its `frames`, since every round reuses the `arm-<id>-<px>` names. Read a frame of any width as a pick of its arm.

| Selection                                                         | Reading                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| One frame in `frames`, on the current round's page in `<project>` | The pick                                                 |
| One frame in `frames`, on an earlier round's page                 | A revert, so name the round back before acting           |
| An `element` inside a picked frame                                | A correction the loop carries by its `index` and `hash`  |
| Several entries in `frames`                                       | Ask which one rather than taking the first               |
| Empty `frames`, another project, or a page the run never made     | No answer, so ask again rather than guess                |
| `tabs: 0`, or a `server-not-running` refusal                      | No board is open, so hand the address over and ask again |

Pass the element's `hash` to `frameboard edit --hash` with its `index`. A frame rewritten since the operator picked refuses with `stale-address` rather than landing on another element, so ask for the pick again on that refusal.
