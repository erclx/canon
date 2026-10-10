---
title: Verbs absent from an older binary
description: What auto-ship Step 4 does when the installed canon binary carries no test-order subcommand
---

# When the verb is absent

Step 4 of `auto-ship`. The session reads this file when the installed binary answers the test-order verb with a missing subcommand, since the verb ships with the CLI and this body ships with the plugin.

## Step 4: test order

Report that the check did not run rather than reading a missing subcommand as clean, and continue to Step 5.
