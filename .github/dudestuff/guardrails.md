# Dude Guardrails

Durable project rules and preferences that Dude should follow.

Entries prefixed with `[bundle]` are shipped defaults. When no project-specific guardrails exist yet, Dude may infer candidate guardrails from the repo, current definition work, and remembered context, but only user-accepted guardrails become durable project rules here.

## Entries

- `[bundle]` Once execution work is imported, Beads is the only live tracker for pending and completed work.
- `[bundle]` Keep intent separate from implementation: `spec.md` stays technology-agnostic, while `plan.md` carries technical design.
- `[bundle]` Optional disciplines such as worktrees and TDD are opt-in unless the user explicitly adopts them for the project.
- Branch deletion is governed by `.github/skills/branch-pr-lifecycle/SKILL.md`. Do not delete a branch (local or remote) when an unmerged PR points at it, or when its tip is not reachable from `main` or another long-lived ref, without explicit user confirmation — even if the user requested the deletion in a single instruction.
- For solo work on this repo, prefer the fast path (merge locally to `main` → push → tag) over opening PRs that will not be reviewed. Only open PRs when review or CI gating is actually wanted.
