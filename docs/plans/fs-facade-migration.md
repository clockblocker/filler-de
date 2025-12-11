# FS facade migration plan (staged)

## Goal
- Remove PrettyPath/prettyFile usage; standardize on manager SplitPath types.
- Route all FS operations through ObsidianVaultActionManager (no direct OpenedFileService/BackgroundFileService outside manager).

## Current gaps
- Manager FS adapter landed; callers now using SplitPath, but continue sweeping for stragglers.
- PrettyPath references largely removed; ensure tests/docs stay aligned.
- Legacy background executor/actions removed; rely solely on manager actions.
- SplitPath variants were tightened; keep collapsing to Folder/File/MdFile + CoreSplitPath.

## Staged execution (preferred order)
1) Adapter + types
   - Add `manager-fs-adapter` that wraps `ObsidianVaultActionManager` read/write/list/exists/pwd/rename/trash/create/process using SplitPath types.
   - Introduce SplitPath-to-manager reader type (`ManagerFsReader`) for library adapters; remove PrettyPath helper imports.
   - Define or delete PrettyPath types; add shims only where decoding legacy data is unavoidable.
   - Collapse SplitPath flavors to discriminated Folder/File/MdFile + CoreSplitPath; drop bespoke guards that existed for loose PrettyPath.

2) Librarian conversion to manager
   - Swap dispatcher/action builders to use manager VaultAction types and SplitPath; stop importing legacy background-vault-actions.
   - Update filesystem-healer, vault-event-handler, note-operations, tree-reconciler to consume manager adapter methods and SplitPath.
   - Replace direct LegacyOpenedFileService calls with manager `isInActiveView` and adapter read/write where needed; keep only UI-open navigation on legacy until manager provides open/cd.
   - Remove decode/encode helpers that only compensate for PrettyPath laxness; prefer manager split-path keying.

3) Test rewrites
   - Update unit tests to build SplitPath fixtures; drop PrettyPath expectations.
   - Switch mocks to manager adapter interfaces; remove legacy executor mocks.
   - E2E: rewire background/opened service exposure to go through manager testing API.

4) Cleanup
   - Remove PrettyPath/prettyFile helpers and legacy background executor/types not used.
   - Remove testing globals that expose raw opened/background services; expose manager and adapter only.
   - Docs: align migration/spec files to SplitPath-only guidance.

## Risks / watchpoints
- Path normalization parity: ensure SplitPath encodes exactly what legacy PrettyPath expected (root handling, md extension).
- Active-view routing: manager `isInActiveView` must match legacy `isFileActive` semantics before deleting legacy service hooks.
- Missing adapter impl may break librarian until Stage 1 lands; plan a short-lived shim commit if needed.

## Success criteria
- No PrettyPath/prettyFile imports in src/tests; only SplitPath types.
- All FS ops outside manager go through `ObsidianVaultActionManager` or its adapter; no direct OpenedFileService/BackgroundFileService usage.
- Tests updated and passing with manager-driven APIs.
