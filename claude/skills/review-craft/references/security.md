# Security classes

Read each class against the diff. A class the diff does not reach is skipped, not reported as clean. Name the input that reaches the sink and the path it takes, since a class named with no path is a suspicion rather than a finding.

## Classes to check

- **Shell and command injection.** A value from an argument, an environment variable, a file, or a network response reaching a shell: through `eval`, an unquoted expansion, a string built into a command, or a subprocess call that takes a single command string. Quoting the variable at the call site is the fix to look for.
- **Path traversal in a file write.** A path built from outside input and written without being resolved and checked against the directory it must stay inside. A `..` segment, an absolute path, and a symlink inside the target each escape a naive join.
- **Secrets and personal data leaving the process.** A token, a key, a password, or personal data reaching a log line, an error message, a session transcript, a published page, a pull request comment, or a sync to a remote. Check what a debug line prints and what a verbose flag adds.
- **Supply chain.** One-shot package execution of an unpinned version, which runs whatever the registry serves that day. A new dependency, and what its install scripts run. A lockfile that changes without a manifest change.
- **Time of check to time of use on a file write.** An existence or permission check followed by a write to the same path in a later step, and a predictable name in a shared temporary directory. Another process can swap the path in between.
- **Insecure defaults a consumer installs.** A config, a scaffold, or a seed that turns a check off, opens a port on every interface, grants a broad permission, or ships a placeholder secret. The consumer inherits the default without reading it.

## Excluded

Do not report these as security findings. Raise one as a correctness finding only when the diff shows a concrete failing case.

- Denial of service, rate limiting, and resource exhaustion
- Generic input validation with no proven impact
- Open redirects
- A theoretical attack needing access the attacker would already need to have
