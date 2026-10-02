# Security classes

Read each class against the diff. A class the diff does not reach is skipped, not reported as clean. Name the input that reaches the sink and the path it takes, since a class named with no path is a suspicion rather than a finding.

## Open with the threat model

Before the classes, name from the diff who supplies each input and what the code can reach with it: a file, a process, a network, a credential. Skip a class that model rules out, and say which one and why, so the skip reads as a decision rather than an oversight.

## Classes to check

- **Shell and command injection.** A value from an argument, an environment variable, a file, or a network response reaching a shell: through `eval`, an unquoted expansion, a string built into a command, or a subprocess call that takes a single command string. Quoting the variable at the call site is the fix to look for.
- **Path traversal in a file write.** A path built from outside input and written without being resolved and checked against the directory it must stay inside. A `..` segment, an absolute path, and a symlink inside the target each escape a naive join.
- **Destructive operation on a derived path.** A delete, overwrite, move, or clean whose path is built from a variable, a config value, or a listing. Look for the empty or unset value that collapses it to a root, a glob or a symlink that carries it outside the folder it was meant for, no check that the resolved path sits at least one level below an expected root, and no read of what is there, owned by this tool or not, before the call. The fix to look for is resolve, require the root, then act. A write escaping its folder is path traversal. When a finding fits both, name the class whose fix applies.
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
