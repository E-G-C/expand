---
name: "branch-pr-lifecycle"
description: "Use when creating, pushing, deleting, or cleaning up Git branches; when opening or closing pull requests; when a user asks to delete a local or remote branch; when deciding between a PR-based flow and a direct merge to the default branch; or when recovering commits from a deleted branch via reflog."
---

## Purpose

Prevent accidental loss of work by treating branch deletion as a destructive action whose safety depends on whether the branch's commits are reachable from somewhere other than the branch itself.

## Core Invariant

A commit is safe only if it is reachable from a long-lived ref:

- a branch (typically `main` / the default branch, or a release branch)
- a tag
- HEAD of an open, mergeable PR (and only as long as the PR's source branch still exists)

Once none of those hold, the commit is reachable only via:

- the local **reflog** (default 90 days, reset by `git gc --prune=now` or `git reflog expire`)
- on GitHub, the closed PR's hidden ref `refs/pull/N/head` (subject to GitHub's own GC policy, not present in normal clones)

Both are recovery surfaces, not durable storage.

## Hard Rules

1. **Never delete a branch (local or remote) while an unmerged PR points at it without explicit user confirmation.** Deleting the head ref of an open PR auto-closes the PR on GitHub and orphans the commits.
2. **Never delete a branch whose commits are not reachable from `main`, another branch, or a tag** without explicit user confirmation. "I just merged it locally" is only safe if that merge has been pushed.
3. **Do not run `git gc --prune=now`, `git reflog expire --expire=now --all`, or equivalent destructive history operations** while orphaned commits exist that the team may still need.
4. **Branch deletion is a hard-to-reverse action.** Treat a user instruction like "delete the branches" as requiring the same pre-check below, even when the user gave the instruction in a single sentence.

## Pre-Delete Check

Before deleting any branch, run this check (adapt commands to the local toolchain):

```bash
# Is there an open PR for this branch?
gh pr list --head <branch> --state open --json number,url,mergeable

# Is the tip commit reachable from main (or the default branch)?
git merge-base --is-ancestor <branch> main && echo "reachable from main" || echo "NOT reachable from main"
```

Decision matrix:

| Open PR? | Reachable from `main`? | Action |
|---|---|---|
| No | Yes | Safe to delete |
| No | No | Pause: confirm the user accepts losing the branch's unique commits |
| Yes | Yes | Pause: confirm the user wants to close the PR before deleting |
| Yes | No | Stop: do not delete without explicit confirmation. Offer the alternatives below. |

## Choosing The Workflow Up Front

Pick one of two flows per piece of work and stay in it. Mixing them is what causes the dangerous "open PR then delete branch" pattern.

### PR Flow

Use when review, CI gating, discussion, or a team merge policy is actually wanted.

1. Create a feature branch.
2. Push and open a PR.
3. Wait for review / CI / approval.
4. **Merge the PR.**
5. Then delete the branch (often automatic via the GitHub repo setting "Automatically delete head branches").

### Fast Path (Solo Or Trusted)

Use when the user is the sole reviewer and the PR ceremony adds no value.

1. Create a feature branch (or work directly on `main` if the project allows it).
2. Verify locally (tests, lint).
3. Merge or rebase to `main` locally.
4. Push `main`.
5. Tag if releasing.
6. Delete the local feature branch.

Do not open a PR you do not intend to merge through the PR UI. If a PR was opened by mistake and you decide to fast-path instead, **merge the PR's commits to `main` and push `main` before deleting the branch**, so the commits remain reachable from a long-lived ref.

## Recovery Procedure

If commits were orphaned by a premature branch deletion:

1. **Stop further git history operations immediately.** Do not run `gc`, `prune`, or `reflog expire`. Do not re-clone.
2. Locate the lost SHAs:
   - `git reflog --all | head -50`
   - `git fsck --lost-found`
   - For commits from a closed GitHub PR: `git fetch origin refs/pull/<N>/head:recovered-pr-<N>` (only works while GitHub still retains the ref)
3. Verify each SHA exists: `git cat-file -t <sha>`
4. Reattach the commits:
   - cherry-pick onto the current branch: `git cherry-pick <sha>`
   - or create a rescue branch at the SHA: `git branch rescue/<topic> <sha>`
5. Push the rescue branch or the updated `main` immediately so the commits become reachable from a remote ref.
6. Resolve any cherry-pick conflicts using the normal merge tooling. If a cherry-pick goes empty (because the change is already on `main`), use `git cherry-pick --skip` rather than `--abort`.

## Anti-Patterns

- "Clean up the branches" right after pushing PRs, without checking PR merge state.
- Deleting both the local and the remote copy of a branch in the same step before confirming reachability.
- Treating a closed-without-merge PR as proof that the work landed.
- Opening PRs on a solo project out of habit, then never merging them through the UI.
- Running `git gc` "to clean up" while a recovery is in progress.

## Coordination Notes

- The coordinator should pause and prompt the user before executing any deletion that fails the pre-delete check, even if the user already said "delete the branches".
- The prompt should offer concrete alternatives: (a) merge the PR first, (b) close the PR intentionally, (c) merge to `main` locally and push before deleting.
- For solo repos, recommend the fast path explicitly so the user does not feel obligated to open PRs they will not merge.
