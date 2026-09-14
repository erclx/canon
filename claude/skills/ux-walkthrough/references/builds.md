# Builds and servers

Read when bringing the app up at the start of a walkthrough, and whenever a measurement returns nothing it should.

## Bring up

- Run the live build and whatever service it calls from the checkout the session started in, and record the commit, ports and any state that changes a reading as the walkthrough file's conditions.
- Build the artifact the deploy ships in a scratch folder outside the tracked tree, so a build never touches the project.
- Serve that artifact the way the host resolves it. A plain file server can answer a clean route the host rewrites with a 404, such as `/about` for `about.html`.
- Rebuild from the current main whenever main moves mid-walkthrough, and say so in the record. Measuring a stale build reports on code that no longer ships.

## Traps

- Restart a server after rebuilding what it serves. A server started inside an output folder the rebuild replaced keeps serving a deleted directory, and every selector comes back empty.
- Note what a build cannot show, such as live timing a recorded build does not carry or recompile pauses a dev server adds. Neither is a finding.
