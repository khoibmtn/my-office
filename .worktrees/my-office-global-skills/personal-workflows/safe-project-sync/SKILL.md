---
name: safe-project-sync
description: Use when the user asks to inspect project readiness for synchronization or deployment; report checks and planned mutations before any externally visible action.
---

# Safe Project Sync

Run read-only, project-appropriate checks first: status, type checks, lint, tests, build, dependency/security audit, and secret-pattern review. Report failures and the exact next commands.

Invocation authorizes diagnostics only. Staging, committing, merging, pushing, deploying, rollback, branch switching, pull, and history rewriting each require a separate user request that clearly names the action and target. Never infer blanket permission from this skill or from a request to “sync”.
