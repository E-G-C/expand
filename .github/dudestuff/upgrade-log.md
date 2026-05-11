# Upgrade Log

Append-only history of `@dude upgrade` events, conflict resolutions, and rollbacks. Maintained by the `dude-bundle-upgrade` skill. Newest entries at the bottom.

## Entry shape

```
## <YYYY-MM-DD HH:MM:SS> — <upgrade|rollback>
- from: <sha>
- to:   <sha>
- ref:  <branch|tag|sha>
- replaced: N
- added:    N
- removed:  N
- conflicts: N (resolved: <keep-mine=a, take-new=b, merged=c, deferred=d>)
- preserved: <count> project files
- safety tag: dude-pre-upgrade-<ts>
- lint: [OK|FAIL]
- notes: <free-form>
```

## History

(no upgrades recorded yet)

## 2026-05-11T00:32:05.668Z

- from: c706b0b2a1e0caf69bba31e4bf4517808ad682a3
- to: 266f891036a7342643763ff32926f552fdf937ce
- safety_tag: dude-pre-upgrade-20260510-203204
- upgrade_branch: chore/dude-upgrade-266f8910
- replaced: 3
- added: 0
- removed: 0
- conflicts:
  - .github/skills/dude-bundle-upgrade/SKILL.md => keep mine
- deferred: 0
- preserved:
  - .github/dudestuff/ (except bundle-manifest.md and upgrade-log.md)
  - brainstorm/, specs/, and repository source files
