---
name: load-context
description: Load project context at session start. Reads CLAUDE.md, recent changes, and project state for quick onboarding. Creates a new temp branch.
---

# /load-context - Load Session Context

## Purpose

Quickly load the project context at the start of a new AI session. Reads key documentation, recent git history, project state, and optionally creates a new working branch from `main`.

## Steps to execute when user runs /load-context

### 1. Pull latest from main (skip if you don't want to switch branch)
```bash
git checkout main && git pull origin main 2>&1
```

### 2. Create new working branch
```bash
git checkout -b "$(date +%Y%m%d-%H%M)-temp"
```

### 3. Read Context Files
Use your `view_file` tool to read:
- `CLAUDE.md`
- `CONTEXT.md`
- `STATE.md` (Session Notes)

### 4. Check recent git history
```bash
git log --oneline -10
git branch --show-current && git status --short
```

### 5. Respond to user
```markdown
## 🧠 Context Loaded

- **Branch:** <current_branch>
- **Recent Commits:** <list 3 recent commits>
- **Current State:** <brief summary from STATE.md>

Ready to work! What would you like to do?
```
