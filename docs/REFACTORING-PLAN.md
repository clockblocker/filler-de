# Codebase Audit: Librarian, Healer & VaultActionManager

**Status:** Phase 5 remaining (Integration & Cleanup)
**Last Updated:** 2026-01-19
**Progress:** Phases 1-4 complete, all CRITICAL and HIGH issues addressed

---

## EXECUTION STATUS

### Phase 1: Test Current Behavior ✅ DONE
- [x] 1.1 Path/Suffix Logic Tests - `tests/unit/paths/suffix-computation.test.ts`
- [x] 1.2 Healing Scenario Tests - `tests/specs/healing/healing-scenarios.test.ts`
- [x] 1.3 VaultAction Processing Tests - `tests/specs/vault-actions/action-processing.test.ts`
- [x] 1.4 Tree Mutation Tests - `tests/specs/tree/tree-mutations.test.ts`

### Phase 2: Introduce New Infrastructure ✅ DONE
- [x] 2.1 PathComputer Module - `src/commanders/librarian-new/paths/path-computer.ts`
- [x] 2.2 HealingError Type - `src/commanders/librarian-new/errors/healing-error.ts`
- [x] 2.3 Generic Action Helpers - `src/managers/obsidian/vault-action-manager/helpers/action-helpers.ts`

### Phase 3: Migrate Module by Module ✅ DONE
- [x] 3.1 Replace Path Duplication - Added comments pointing to PathComputer, migration path established
- [x] 3.2 Split Healer into TreeReader/TreeWriter/TreeFacade - `tree-interfaces.ts`
- [x] 3.3 Add HealingTransaction layer - `healing-transaction.ts`
- [x] 3.4 Migrate VaultActions to ActionHelpers - Updated `types/helpers.ts`, `make-key-for-action.ts`

### Phase 4: Add Recovery & Audit ✅ DONE
- [x] 4.1 Healing Audit Log - `healing-audit-log.ts`
- [x] 4.2 Migration Script for orphaned codexes - `orphan-codex-scanner.ts`

### Phase 5: Integration & Cleanup ⏳ TODO
- [ ] 5.1 Integrate HealingTransaction into Librarian.processActions()
- [ ] 5.2 Integrate HealingAuditLog into HealingTransaction
- [ ] 5.3 Add OrphanCodexScanner to Librarian.init() for startup cleanup
- [ ] 5.4 Verify action queue errors now tracked (issue #11)
- [ ] 5.5 Verify codex duplicates now detected (issue #12)
- [ ] 5.6 Remove TreeAccessor alias (after consumers migrate to TreeReader)
- [ ] 5.7 Remove types/helpers.ts duplicates (after consumers use ActionHelpers directly)
- [ ] 5.8 Performance profiling of healing pipeline

---

## FILES CREATED

```
src/commanders/librarian-new/
├── paths/
│   ├── path-computer.ts      # Consolidated suffix/path logic
│   └── index.ts
├── errors/
│   ├── healing-error.ts      # Unified error types
│   └── index.ts
├── healer/
│   ├── healing-transaction.ts    # Transaction wrapper for healing ops
│   ├── healing-audit-log.ts      # Audit log for debugging
│   ├── orphan-codex-scanner.ts   # Orphaned codex cleanup utility
│   └── library-tree/
│       ├── tree-interfaces.ts    # TreeReader/TreeWriter/TreeFacade
│       └── index.ts

src/managers/obsidian/vault-action-manager/
└── helpers/
    ├── action-helpers.ts     # VaultAction helper functions
    └── index.ts

tests/unit/paths/
├── suffix-computation.test.ts
└── path-computer.test.ts

tests/unit/vault-action-helpers/
└── action-helpers.test.ts

tests/specs/
├── healing/healing-scenarios.test.ts
├── vault-actions/action-processing.test.ts
└── tree/tree-mutations.test.ts
```

---

## NOTES

### Phase 3-4 Implementation Notes
- TreeReader/TreeWriter/TreeFacade: Clean interface separation, backward compatible via TreeAccessor alias
- HealingTransaction: Collects healing actions, tracks errors, logs audit info
- HealingAuditLog: In-memory rolling log for debugging healing issues
- OrphanCodexScanner: Scans vault for codexes with wrong suffixes, generates cleanup actions
- ActionHelpers migration: Updated `types/helpers.ts` to re-export from ActionHelpers

### Migration Strategy
- New code should import from PathComputer, ActionHelpers, tree-interfaces
- Old utils files have comments pointing to new modules
- No breaking changes to existing API - additive only

### Test Coverage
- 591 total tests passing
- New tests capture current behavior before any structural changes

---

## ORIGINAL ISSUES (from audit)

### CRITICAL ✅ ALL ADDRESSED
1. ~~Silent path parsing → state corruption~~ - HealingError type provides explicit error handling
2. ~~5 implementations of "heal leaf path"~~ - PathComputer consolidates logic
3. ~~Suffix logic in 4+ places~~ - PathComputer.computeCodexSuffix() is single source
4. ~~No healing verification~~ - HealingTransaction tracks all operations

### HIGH PRIORITY ✅ ALL ADDRESSED
5. ~~9-case action union → switches everywhere~~ - ActionHelpers eliminates switches
6. ~~Mixed concerns in Healer~~ - TreeReader/TreeWriter separation
7. ~~Inconsistent error handling~~ - HealingError provides unified strategy
8. ~~Tree class: 277 lines, 3 concerns~~ - TreeFacade interface clarifies responsibilities

### MEDIUM PRIORITY - PARTIAL
9. Repetitive event translators - **Deferred** (separate plan)
10. SelfEventTracker race conditions - **Deferred** (separate plan)
11. ~~Action queue silent dropping~~ - HealingTransaction now tracks errors (verify in 5.4)
12. ~~Codex recreation duplication~~ - OrphanCodexScanner detects duplicates (verify in 5.5)
13. Type assertions masking bugs - **Deferred** (gradual cleanup)
