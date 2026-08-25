# Global Development Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install a safe, Codex-native, comprehensive development skill library globally on macOS and provide a Vietnamese usage guide.

**Architecture:** Stage source packs from `/Users/buiminhkhoi/Documents/Antigravity/tool` into an atomic managed tree under `/Users/buiminhkhoi/.codex/skill-packs`. Expose selected skill directories through `/Users/buiminhkhoi/.agents/skills`; preserve `.system` and the existing UI UX Pro Max installation unless a deterministic comparison proves an upgrade is warranted. Keep a manifest, backups, and safe context workflows separate from third-party source content.

**Tech Stack:** Markdown Agent Skills (`SKILL.md`), POSIX shell utilities, Python 3 for static validation/search smoke tests, Codex native discovery via `~/.agents/skills`.

---

## Implementation Artifacts and Manifest Schema

Create these reproducible artifacts in the repository, then run them against the user's global paths:

- `config/global-skills.json`: source-to-destination mappings and ownership.
- `scripts/global-skills.py`: `compare-uiux`, `validate`, `stage`, `install`, `uninstall`, `rollback`, and `probe-discovery` subcommands; dry-run by default for destructive subcommands unless `--apply` is supplied.
- `tests/test_global_skills.py`: temporary-home tests for mapping, validation, idempotency, atomic activation, uninstall scope, and rollback.
- `docs/superpowers/plans/2026-08-25-global-development-skills-installation.md`: generated runbook is not required; runtime evidence lives under `~/.codex/skill-packs/`.

Each manifest entry has this shape:

```json
{
  "id": "react-best-practices",
  "source": "/Users/buiminhkhoi/Documents/Antigravity/tool/antigravity-kit-main/.agent/skills/nextjs-react-expert",
  "destination": "react-best-practices",
  "owner": "ag-kit-domain",
  "activation": "automatic",
  "dependencies": [],
  "adaptation": "codex-tool-names-and-paths",
  "include": ["SKILL.md", "*.md", "references/**", "scripts/**"],
  "exclude": ["hooks/**", ".git/**"]
}
```

The manifest must explicitly enumerate every mapping in the approved spec, including the source rename `nextjs-react-expert → react-best-practices` and the game-development child skills. The installed manifest adds `sha256`, `source_revision`, and `installed_version` fields.

### Task 1: Inspect runtime and current global installation

**Files:**
- Read: `/Users/buiminhkhoi/.codex/skills`
- Read: `/Users/buiminhkhoi/.agents/skills`
- Read: `/Users/buiminhkhoi/Documents/Antigravity/tool`

- [ ] **Step 1: Capture runtime capabilities**

Run:

```bash
uname -s
command -v codex || true
command -v python3 || true
command -v node || true
find /Users/buiminhkhoi/.agents/skills -maxdepth 2 -type l -print 2>/dev/null || true
```

Expected: macOS, available Codex/Python paths where installed, and existing links listed without modifying anything.

- [ ] **Step 2: Implement the temporary-home fixture**

Create `tests/test_global_skills.py` fixtures that redirect `CODEX_SKILLS_HOME`, `CODEX_PACK_HOME`, and `CODEX_SOURCE_ROOT` to temporary directories.

Expected: tests never write to the real home during validation.

- [ ] **Step 3: Inventory name collisions**

Run a script that extracts `name:` from every current and candidate `SKILL.md`, then report duplicate names and duplicate process owners.

Expected: existing `ui-ux-pro-max` is identified as a collision candidate; system skills are marked protected.

- [ ] **Step 4: Commit the inspection manifest**

Create `config/global-skills.json` with all source-to-destination mappings before staging. The installer writes the machine-readable installed manifest at `/Users/buiminhkhoi/.codex/skill-packs/manifest.json`; retain inspection output in the install log rather than the project repository.

- [ ] **Step 5: Make the UI UX Pro Max decision deterministic**

Run `python3 scripts/global-skills.py compare-uiux --current /Users/buiminhkhoi/.codex/skills/ui-ux-pro-max --candidate /Users/buiminhkhoi/Documents/Antigravity/tool/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max --config config/global-skills.json`. Compare declared version, SHA-256, feature counts in `SKILL.md`, required local scripts/data, and validation results in that order. Write the winner and evidence into the `ui-ux-pro-max` entry in `config/global-skills.json`; never replace the current copy on a tie or failed candidate validation. The later `install --apply` step creates the backup and appends its actual backup ID to the installed manifest.

Expected: exactly one owner is selected, `stage` consumes the winner recorded in config, and the current global copy remains unchanged unless the candidate is demonstrably newer/more complete.

### Task 2: Build the selected, namespaced source tree

**Files:**
- Create: `/Users/buiminhkhoi/.codex/skill-packs/superpowers/`
- Create: `/Users/buiminhkhoi/.codex/skill-packs/ag-kit/`
- Create: `/Users/buiminhkhoi/.codex/skill-packs/stitch/`
- Create: `/Users/buiminhkhoi/.codex/skill-packs/personal-workflows/`
- Create: `/Users/buiminhkhoi/.codex/skill-packs/manifest.json`
- Create: `/Users/buiminhkhoi/.codex/skill-packs/LICENSES/`

- [ ] **Step 1: Stage selected skills in a temporary directory**

Run `python3 scripts/global-skills.py stage --config config/global-skills.json --output <tmp-stage>`. Copy only manifest entries. Exclude duplicate lifecycle skills, Antigravity-only agents/workflows, hooks, plugin metadata, `.git`, and executable install hooks.

Expected: a complete staged tree with no active global links changed.

- [ ] **Step 2: Preserve provenance**

Copy source LICENSE files and create a provenance note recording source path, source revision/hash, destination, and adaptation decisions.

Expected: every third-party pack has an attribution record.

- [ ] **Step 3: Add hashes and ownership**

Record SHA-256 hashes, trigger owner, dependency gates, and adaptation status for every installed skill in `manifest.json`.

Expected: each installed skill maps to exactly one lifecycle or domain owner.

### Task 3: Adapt content to Codex and safety constraints

**Files:**
- Modify: staged `SKILL.md` files containing non-Codex tool names or unsafe instructions
- Create: `/Users/buiminhkhoi/.codex/skill-packs/personal-workflows/load-project-context/SKILL.md`
- Create: `/Users/buiminhkhoi/.codex/skill-packs/personal-workflows/save-project-context/SKILL.md`
- Create: `/Users/buiminhkhoi/.codex/skill-packs/personal-workflows/safe-project-sync/SKILL.md`

- [ ] **Step 1: Rewrite incompatible tool references**

Replace unsupported `Read`, `Glob`, `Grep`, `Agent`, Antigravity workflow syntax, and missing script claims with Codex-compatible instructions or explicit fallbacks. Keep references relative to the installed skill directory.

Expected: no skill claims unavailable tools or files.

- [ ] **Step 2: Apply mutation and security guards**

Remove or gate automatic `git add -A`, commit, merge, push, branch switching, pull, deploy, deletion, hook execution, and offensive-security actions. Require explicit user authorization and scoped targets.

Expected: static scan finds no unconditional forbidden command behavior.

- [ ] **Step 3: Write safe context workflows**

Implement read-only `load-project-context`, user-requested documentation-only `save-project-context`, and diagnostics-first `safe-project-sync` with separate authorization requirements for every external mutation.

Expected: workflows work from any project path and never infer push/deploy permission from invocation.

### Task 4: Install atomically and preserve rollback

**Files:**
- Create: `/Users/buiminhkhoi/.codex/skill-packs/backups/`
- Create/modify: `/Users/buiminhkhoi/.agents/skills/` links owned by the manifest
- Create: `/Users/buiminhkhoi/.codex/skill-packs/install.log`

- [ ] **Step 1: Validate staged tree before activation**

Run `python3 scripts/global-skills.py validate --root <tmp-stage> --manifest <tmp-stage>/manifest.json`. Check frontmatter, local references, duplicate names, prohibited commands, dependency contracts, license records, and manifest hashes.

Expected: validation exits zero; activation is skipped on failure.

- [ ] **Step 2: Back up managed state**

Move only manifest-owned prior links/tree into a timestamped backup. Leave `.system`, unrelated user skills, and existing non-managed content untouched.

Expected: backup is recoverable and recorded in the log.

- [ ] **Step 3: Activate links**

`install --apply` copies the validated stage to `~/.codex/skill-packs/versions/<timestamp>-<hash>`, writes a temporary `current.new` symlink, atomically renames it to `current`, and then creates/updates only manifest-owned links in `~/.agents/skills`. If any link operation fails, restore the previous `current` link and owned links from the backup. First test whether a pack symlink is recursively discovered; if not, create individual skill-directory links. Do not overwrite an existing unrelated destination.

Expected: all manifest-owned links resolve and are idempotent on a second run.

- [ ] **Step 4: Implement lifecycle commands**

Implement `uninstall --apply` to remove only manifest-owned links and managed versions, and `rollback --apply [backup-id]` to atomically restore the selected backup. Both commands must support `--dry-run` and refuse paths outside the managed roots.

Expected: unrelated `.system` and user skills remain byte-for-byte unchanged.

### Task 5: Run static and behavioral verification

**Files:**
- Read: `/Users/buiminhkhoi/.codex/skill-packs/manifest.json`
- Create: `/Users/buiminhkhoi/.codex/skill-packs/verification-report.md`

- [ ] **Step 1: Validate from outside the repository**

Run `python3 /Users/buiminhkhoi/Documents/Antigravity/Claude/my-office/scripts/global-skills.py validate --root /Users/buiminhkhoi/.codex/skill-packs/current` from a temporary directory under `/tmp`, and verify every link, frontmatter field, reference, and hash.

Expected: no check depends on the current project checkout.

- [ ] **Step 2: Test trigger routing**

Run `python3 scripts/global-skills.py probe-discovery --outside /tmp/codex-skill-probe --expect brainstorming architecture ui-ux-pro-max mobile-design enhance-prompt`, then start a new Codex session from that directory and record the exact command/output in `verification-report.md`. Use fresh-session prompts for planning, architecture, UI design, mobile design, Stitch prompt enhancement, debugging, and explicit security audit.

Expected: expected skills activate; ordinary bug-fix wording does not activate red-team/vulnerability skills.

- [ ] **Step 3: Test dependency fallbacks**

Run the test harness with `CODEX_CAP_STITCH=0 CODEX_CAP_BROWSER=0 CODEX_CAP_MCP=0` and a temporary PATH containing no optional CLIs. Verify the skills explain the limitation and provide a text/manual fallback. Restore the original environment after the subprocess exits.

Expected: no fabricated external result and no destructive command.

- [ ] **Step 4: Test idempotency and rollback**

Run `python3 scripts/global-skills.py install --dry-run`, then `install --apply` twice and compare manifests/hashes; run `rollback --apply` in a disposable test path.

Expected: second run makes no semantic changes; rollback restores the prior managed state.

### Task 6: Produce and verify the Vietnamese usage guide

**Files:**
- Create: `/Users/buiminhkhoi/.codex/skill-packs/USAGE-vi.md`

- [ ] **Step 1: Document automatic activation**

Explain that Codex activates skills from task context after a new session starts, with examples for plan, backend, testing, UI/UX, mobile, and security.

- [ ] **Step 2: Document explicit usage**

Provide prompts naming skills directly, plus Stitch dependency requirements and safe context workflow examples.

- [ ] **Step 3: Document maintenance**

Explain update, manifest inspection, uninstall, rollback, and the need to start a new Codex session after installation changes.

- [ ] **Step 4: Verify guide examples**

Check every example against the installed destination names and the safety policy.

Expected: no example references a missing skill or implies automatic Git/deployment permission.

### Task 7: Commit implementation evidence in the project

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-global-development-skills.md` (checklist updates only)

- [ ] **Step 1: Run final repository checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the intended plan/spec changes are present.

- [ ] **Step 2: Commit plan evidence**

```bash
git add docs/superpowers/plans/2026-08-25-global-development-skills.md
git commit -m "docs: plan global development skills installation"
```

Expected: commit succeeds without staging unrelated files.
