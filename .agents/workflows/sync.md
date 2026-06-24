---
name: sync
description: Sync local changes to GitHub and deploy. Runs type checks, lint checks, commits, and pushes to main.
---

# /sync - Sync & Deploy

## Purpose

Run comprehensive quality checks, commit all local changes, and push to GitHub `main` branch (which will trigger Vercel auto-deploy).

## Steps to execute when user runs /sync

### 1. Pre-Flight Checks

Run the following checks sequentially. If any fail, stop and ask the user if they want to fix it or skip.
```bash
npx tsc --noEmit 2>&1 | tail -20
npm run build 2>&1 | tail -20
```

### 2. Check for hardcoded secrets
Use your grep_search tool to look for hardcoded secrets or API keys in the `.ts` and `.tsx` files.

### 3. Stage and Commit
```bash
git status --short
git add -A
git commit -m "docs: sync changes" # Adjust message based on what was changed
```

### 4. Push to main
```bash
git push origin main 2>&1
```

### 5. Respond to user
```markdown
## ✅ Sync & Deploy Complete

### Pre-Flight
- ✅ TypeScript: Passed
- ✅ Build: Passed

### Git
- **Commit:** `<commit_message>`
- **Branch:** main
- **Status:** Pushed successfully. Vercel deployment has been triggered!
```
