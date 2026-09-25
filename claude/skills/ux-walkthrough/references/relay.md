# Relaying picks

Read when the operator calls a batch, and at the start of the walkthrough when a launch brief asks for collisions.

## Where the batch goes

- Send it to the controller where the session was dispatched by one, through `canon:session-relay`, which resolves the address and carries the send.
- Give it to the operator as one list in the conversation where no controller exists. The walkthrough file is the handoff either way.

## When

- Relay nothing per pick. Relay once when the operator calls the batch, covering every pick held since the last one.
- Put a finding with no visible choice in the same batch, as a proposed row.

## The message

- Open with one line saying what the batch holds and where the record is.
- Give each pick its finding, the arm, the numbers that decided it, the arms beaten, and the files it writes.
- Close with overlaps and order: files two picks share, picks that must follow another, and collisions with open pull requests or unmerged branches.
- Name anything the operator holds that is not a row, such as a repository setting.

## Collisions

- List open pull requests with their files, and unmerged remote branches with `git diff --stat origin/main...origin/<branch>`, and compare file sets rather than descriptions.
- Stamp an overlap with the commit it was measured against.
