---
name: load-project-context
description: Use at the start of work in an unfamiliar repository to read project guidance, status, recent history, and relevant structure without mutating Git state.
---

# Load Project Context

1. Locate and read project guidance such as `AGENTS.md`, `CLAUDE.md`, `README.md`, and `CODEBASE.md`.
2. Inspect `git status --short`, the current branch, and recent commits without changing them.
3. Identify the stack from manifests and map the relevant source, test, and configuration directories.
4. Check for running services only when useful to the request.
5. Summarize assumptions, risks, and the next safe step.

Never pull, checkout, create branches, merge, commit, push, deploy, or delete files unless the user explicitly requests that separate action.
