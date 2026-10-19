---
name: rr
description: Manages Runrun.it cards — /rr plan|list|break|brief [argument]
---

Arguments received: `$ARGUMENTS`

The first token is the subcommand (`plan`, `list`, `break`, or `brief`); the rest is
that subcommand's free-form argument (context for `plan`, criteria for `list`, task-id
for `break`/`brief`).

If the first token isn't one of these four subcommands, ask the user which of the four
they want — in Portuguese (pt-BR), per the `rr` skill's output-language rule below —
don't try to guess.

Don't implement `plan`/`list`/`break`/`brief` logic here. Invoke the `rr` skill,
passing the subcommand and the rest of the argument — all the logic (including when to
ask before creating/changing anything in Runrun.it, and the rule to always reply to the
user in Portuguese) lives in `skills/rr/SKILL.md`. This command exists only to allow
explicit invocation via `/rr ...`; the skill can also be triggered automatically by
relevance when the user asks for something similar without using `/rr`.
