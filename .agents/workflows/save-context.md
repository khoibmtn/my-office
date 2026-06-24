---
name: save-context
description: Save current session context for future conversations. Updates CONTEXT.md and STATE.md, then commits.
---

# /save-context - Save Session Context

## Purpose

Persist the current working context (decisions, recent changes, known issues) so that future AI sessions can quickly resume. Can optionally trigger `/sync`.

## Steps to execute when user runs /save-context

### 1. Update CONTEXT.md

Use `multi_replace_file_content` or `replace_file_content` to update `CONTEXT.md` at the project root with the latest high-level architectural or business logic changes.

### 2. Update STATE.md (Session Notes)

Update `STATE.md` with:
- What was done in this session
- Decisions made
- Pending items / TODOs
- Key files modified

### 3. Check git history & status
```bash
git log --oneline -5
git status --short
```

### 4. Execute /sync
After saving context, automatically proceed to the `/sync` steps (check types, build, commit, and push).

### 5. Respond to user
```markdown
## 💾 Context Saved & Synced

- **CONTEXT.md** — Updated project overview + architecture
- **STATE.md** — Session changes logged
- **Git** — Changes have been committed and pushed to main!
```
