# Claude Code — Voltrix

**IMPORTANT**: Before doing any work in this repo, read every file in [`.agent/rules/`](.agent/rules/). These are not auto-loaded by Claude Code — you must read them explicitly at the start of each session and treat their contents as binding instructions.

## Required reading (read in order)

1. [`.agent/rules/philosophy.md`](.agent/rules/philosophy.md) — Internal mental process before, during, and after writing code
2. [`.agent/rules/project.md`](.agent/rules/project.md) — Architecture, performance, and testing guidelines specific to Voltrix
3. [`.agent/rules/writing.md`](.agent/rules/writing.md) — Code change protocol: trace, justify, minimize, verify
4. [`.agent/rules/environment.md`](.agent/rules/environment.md) — Shell, uWS, import, and benchmark gotchas

Read them with the Read tool in parallel. Do not skip any. If a rule conflicts with a default behavior, the rule wins.

## When to re-read

- At the start of every new session
- Before any non-trivial code change
- Whenever you feel unsure about architecture, performance constraints, or project conventions
