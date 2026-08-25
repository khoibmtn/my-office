# Global Development Skills Design

## Goal

Create a Codex-native, globally discoverable skill library for all software projects. The library should cover discovery, ideation, planning, implementation, verification, and UI/UX while avoiding conflicting triggers and unsafe automatic Git or deployment actions.

## Sources

The source root is `/Users/buiminhkhoi/Documents/Antigravity/tool`.

- `/Users/buiminhkhoi/Documents/Antigravity/tool/superpowers`: process discipline for brainstorming, planning, TDD, debugging, review, verification, and branch completion.
- `/Users/buiminhkhoi/Documents/Antigravity/tool/antigravity-kit-main`: broad technical knowledge for architecture, application types, platforms, testing, security, and delivery.
- `/Users/buiminhkhoi/Documents/Antigravity/tool/stitch-skills-main`: UI prompt enhancement, design-system extraction, React conversion, shadcn/ui, and iterative Stitch workflows.
- `/Users/buiminhkhoi/Documents/Antigravity/tool/ui-ux-pro-max-skill`: UI/UX intelligence, design systems, responsive styling, accessibility, and product-specific visual guidance.
- `/Users/buiminhkhoi/Documents/Antigravity/tool/standard-workflows`: session context patterns. Destructive Git and deployment behavior will not be imported.

## Installation Architecture

Store managed source copies under `~/.codex/skill-packs/`. Expose each pack to Codex through links under `~/.agents/skills/`, the global native skill-discovery location. Do not link directly to the user-provided `tool` directory, because it may be renamed or moved.

Use namespaced pack directories to preserve provenance and prevent collisions:

- `superpowers/`
- `ag-kit/`
- `stitch/`
- `personal-workflows/`

Keep the existing `~/.codex/skills/ui-ux-pro-max` installation when it is newer or more complete than the copy in `tool`. Compare versions/content before deciding whether to replace it.

Codex discovers skills at session startup, so installation verification must include a fresh-session discovery check. The current session may not reload the catalog immediately.

Before installation, verify whether the installed Codex build recursively discovers skills through a pack-directory symlink. If it does not, create one link per skill directory instead. Identical skill names may not coexist: the install manifest must identify one owner, rename a genuinely distinct skill, or omit the duplicate.

The supported target is the user's current macOS Codex environment. Unix home paths and symbolic links are not presented as a portable Windows installation; a platform migration requires a platform-specific link strategy and a new discovery check.

## Skill Layers

### 1. Development Lifecycle

Use Superpowers as the authoritative process layer:

- `using-superpowers`
- `brainstorming`
- `writing-plans`
- `executing-plans`
- `test-driven-development`
- `systematic-debugging`
- `requesting-code-review`
- `receiving-code-review`
- `verification-before-completion`
- `finishing-a-development-branch`
- optional multi-agent skills when the runtime supports them

Do not install Antigravity Kit's overlapping `brainstorming`, `plan-writing`, `systematic-debugging`, `tdd-workflow`, or `parallel-agents` as independently triggering duplicates. Preserve unique useful material only if it can be merged safely into a supplemental reference.

Superpowers is also third-party input, not a trusted exception. Audit every selected Superpowers skill for tool-name compatibility, precedence claims, forced commits, branch/worktree mutations, delegation assumptions, and conflicts with active Codex instructions. Adapt or omit a skill that cannot comply safely.

### 2. General Engineering

Install the non-overlapping Antigravity Kit skills for:

- application scaffolding and architecture
- API and database design
- clean code and code review
- documentation and localization
- Node.js, Python, Rust, Bash, and PowerShell
- React/Next.js performance
- testing, linting, profiling, security, server management, and deployment principles
- web, mobile, desktop, CLI, extension, MCP, SEO, GEO, and game-development domains

Adapt tool names and references that assume Claude Code, Gemini, Antigravity agents, or missing scripts. A skill must not claim that a script or agent exists unless it is included and verified.

Security and red-team skills remain available but activate only for explicit authorized security requests. Their descriptions must not route ordinary debugging or code review into offensive workflows.

### 3. UI/UX

Use the existing global `ui-ux-pro-max` as the primary product-design intelligence layer. Add complementary skills where they provide distinct value:

- `frontend-design`: design reasoning, visual hierarchy, typography, color, motion, and UX psychology.
- `mobile-design`: platform conventions, touch ergonomics, mobile performance, and offline behavior.
- `tailwind-patterns`: Tailwind-specific implementation guidance.
- `web-design-guidelines`: accessibility and interface audit workflow.
- `shadcn-ui`: component discovery, integration, customization, and accessibility.
- `design-md`: synthesize a semantic design system from Stitch projects.
- `enhance-prompt`: turn vague UI requirements into structured generation prompts.
- `react-components`: convert Stitch outputs when its external dependencies are available.
- `stitch-loop`: iterative Stitch site construction when explicitly requested.

Do not install the older duplicate copy of `ui-ux-pro-max` without confirming it improves on the current global version. Brand, banner, slide, and general graphic-design skills are optional adjuncts; they should not trigger during ordinary application UI work.

## Initial Install Manifest

The implementation plan must turn this list into a machine-checkable manifest containing source, destination name, trigger owner, dependencies, adaptation status, and content hash.

### Authoritative Lifecycle Owners

- Superpowers: `using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `finishing-a-development-branch`, and `using-git-worktrees`.
- Conditional Superpowers: `dispatching-parallel-agents` and `subagent-driven-development` only when runtime policy allows delegation.
- Omit overlapping Antigravity Kit lifecycle skills named above.

### Antigravity Kit Domain Skills

- Build/design: `app-builder`, `architecture`, `api-patterns`, `database-design`, `documentation-templates`, and `clean-code`.
- Languages/platforms: `bash-linux`, `powershell-windows`, `python-patterns`, `rust-pro`, `nodejs-best-practices`, `react-best-practices`, and `mcp-builder`.
- Quality/operations: `code-review-checklist` as a checklist reference rather than lifecycle owner, `lint-and-validate`, `testing-patterns`, `webapp-testing`, `performance-profiling`, `deployment-procedures`, and `server-management`.
- Product surfaces: `frontend-design`, `mobile-design`, `tailwind-patterns`, `web-design-guidelines`, `i18n-localization`, `seo-fundamentals`, `geo-fundamentals`, and the game-development hierarchy.
- Explicit-only security: `vulnerability-scanner`, `red-team-tactics`, and any offensive-security agent material. Each requires an explicitly authorized and clearly scoped target.
- Omit `behavioral-modes`, `intelligent-routing`, `parallel-agents`, `brainstorming`, `plan-writing`, `systematic-debugging`, and `tdd-workflow` because another layer owns their triggers.

### Stitch Skills

- Install `enhance-prompt`, `design-md`, and `shadcn-ui` as normal domain skills.
- Install `react-components` and `stitch-loop` with explicit dependency gates.
- Keep `remotion` as an optional explicit video-generation skill, not an automatic UI skill.

### UI UX Pro Max

- Keep one `ui-ux-pro-max` owner.
- Compare candidate copies using declared version when available, then content hash, feature inventory, required scripts/data, and validation results.
- Record the decision in the manifest. Back up the replaced copy before an upgrade and provide a one-command rollback path.

The trigger matrix must distinguish lifecycle review from `code-review-checklist`, product design from `frontend-design`, implementation styling from `ui-styling` or `tailwind-patterns`, UI audit from `web-design-guidelines`, and general product intelligence from `ui-ux-pro-max`.

### 4. Safe Personal Workflows

Create Codex-native skills inspired by the standard workflows:

- `load-project-context`: read repository guidance, status, recent history, architecture, and relevant files. It must not pull, checkout, or create a branch without an explicit user request.
- `save-project-context`: update project-owned context documents only when asked. It must not stage, commit, push, merge, or deploy unless separately authorized.
- `safe-project-sync`: optional explicit workflow that first reports checks and planned Git/deployment actions, then requires the user's direct request for externally mutating steps.

Calling `safe-project-sync` authorizes diagnostics only. Staging, committing, merging, pushing, deploying, rollback, and history modification each require authorization in the user's request that clearly covers that action; the skill may not treat its own invocation as blanket permission.

## Trigger and Conflict Policy

- One authoritative skill per process concern.
- Domain skills should have narrow, observable trigger conditions.
- Orchestrator skills may route to domain knowledge but may not override the lifecycle gates.
- Skills must not contain unconditional rules that conflict with higher-priority user or system instructions.
- Multi-agent skills activate only when the user or runtime policy permits delegation.
- Skills that depend on Stitch, image generation, browsers, MCP servers, or external CLIs must detect availability and provide a fallback.

Dependency detection must use a read-only capability check appropriate to the dependency, such as tool-catalog presence, `command -v`, or existence/version inspection. The degraded fallback must explain the missing capability and still provide a text-only plan, prompt, or manual implementation path without fabricating external results.

## Safety Policy

No globally installed skill may automatically:

- run `git add -A`
- commit, merge, push, or rewrite Git history
- switch branches or pull remote changes
- deploy applications or cloud functions
- delete data or overwrite broad directories
- run penetration or red-team actions without explicit authorization and scope

Read-only inspection and normal in-scope implementation checks remain allowed. Mutating actions must follow the active Codex authorization rules and the user's request.

Preserve third-party licenses and provenance notices. Audit imported hooks, scripts, embedded prompts, executable references, network calls, and install commands before exposing them globally. Do not install session-start hooks or automatically execute third-party scripts merely because they exist in a source pack.

## Installation Workflow

1. Inventory current global skills and resolve names/version conflicts.
2. Generate the explicit manifest and trigger-owner/conflict matrix.
3. Stage selected and adapted content in a new temporary directory; do not modify active links yet.
4. Audit licenses, prompts, hooks, scripts, network behavior, and executable references.
5. Adapt incompatible metadata, tool names, references, and missing dependencies.
6. Create the three safe personal workflow skills.
7. Validate every staged `SKILL.md`, reference, trigger, and dependency contract.
8. Back up the current managed installation and atomically activate the staged pack under `~/.codex/skill-packs/`.
9. Link pack or individual skill directories into `~/.agents/skills/` without replacing system or unrelated user skills.
10. Verify links, run skill validation, and run behavior smoke tests.
11. Confirm discovery in a new Codex session launched from a temporary directory outside this repository.
12. Produce a Vietnamese usage guide covering automatic activation, explicit invocation, lifecycle examples, UI/UX examples, maintenance, uninstall, and rollback.

The installer must be idempotent. Re-running it with unchanged sources produces no semantic changes. A failed validation leaves the previous active pack intact. Uninstall removes only manifest-owned links and managed pack data. Upgrade and rollback use recorded hashes and backups rather than deleting unrelated global content.

## Verification Criteria

- All selected skills have valid `SKILL.md` files and reachable references.
- The manifest records every installed skill's source, destination, owner, dependencies, adaptation status, and hash.
- No duplicate authoritative lifecycle skill is globally discoverable.
- The existing UI UX Pro Max installation is preserved or upgraded intentionally.
- No imported workflow contains automatic push, merge, deploy, or broad staging behavior.
- Security skills have explicit authorization triggers.
- Global links resolve from outside the current project.
- A fresh Codex session launched from a temporary directory outside this repository lists a defined sample from each installed group, including `brainstorming`, `architecture`, `ui-ux-pro-max`, `mobile-design`, and `enhance-prompt`. Preserve the command and output as installation evidence.
- Smoke prompts confirm explicit and automatic activation for planning, debugging, UI design, and mobile design; ordinary bug fixing does not activate red-team skills.
- Removing or hiding optional Stitch, browser, or MCP dependencies produces the documented safe fallback rather than a fabricated success.
- A static audit and behavioral dry run confirm that no global workflow automatically performs forbidden Git or deployment actions.
- Re-running installation is idempotent, and the documented rollback restores the prior managed installation.
- The usage guide includes concrete prompts for planning, execution, debugging, review, UI design, mobile design, and project context.
