# Librarian Pieces

Detailed reference for librarian modules. For architecture overview see `librarian-architrecture.md`.

## Refactoring Infrastructure

New modules consolidating logic and error handling:

| Module | Location | Purpose |
|--------|----------|---------|
| **PathFinder** | `paths/path-finder.ts` | Single source for path/suffix computation: `computeCodexSuffix()`, `buildCodexSplitPath()`, `sectionChainToPathParts()`, `parseSectionChainToNodeNames()` |
| **HealingError** | `errors/healing-error.ts` | Discriminated union (8 kinds): ParseError, PathMismatchError, VaultOperationError, TreeInconsistencyError, NodeNotFoundError, InvalidChainError, CodexComputationError, ValidationError |
| **TreeReader/Writer/Facade** | `healer/library-tree/tree-interfaces.ts` | Interface separation. TreeReader=read-only, TreeWriter=mutations, TreeFacade=both |
| **HealingTransaction** | `healer/healing-transaction.ts` | Wraps healing ops, collects actions, tracks errors, logs audit. Use `executeHealingTransaction()` |
| **HealingAuditLog** | `healer/healing-audit-log.ts` | In-memory rolling log. Singleton: `getHealingAuditLog()`. Tracks success/fail rates, durations |
| **OrphanCodexScanner** | `healer/orphan-codex-scanner.ts` | Startup scan for codexes with wrong suffixes; generates cleanup actions |
| **ActionHelpers** | `vault-action-manager/helpers/action-helpers.ts` | Eliminates switch on VaultAction. Type guards: `isCreateAction()`, `isRenameAction()`. Extractors: `getActionPath()` |

All paths relative to `src/commanders/librarian-new/` except ActionHelpers (`src/managers/obsidian/`).

## Codex Module Structure

The codex module (`healer/library-tree/codex/`) handles codex file generation, backlink transforms, and impact computation.

### Key Files

| File | Purpose |
|------|---------|
| `codex-split-path.ts` | Wrapper for PathFinder.buildCodexSplitPath (throws on error) |
| `compute-codex-impact.ts` | Compute which sections need codex updates after TreeAction |
| `codex-impact-to-actions.ts` | Convert CodexImpact to healing actions |
| `generate-codex-content.ts` | Generate markdown content for codex files |
| `format-codex-line.ts` | Format individual lines (scrolls, sections, backlinks) |
| `tree-collectors.ts` | Tree traversal: `collectDescendantSectionChains()`, `collectDescendantScrolls()`, `collectTreeData()` |
| `section-chain-utils.ts` | Chain utilities: `dedupeByKey()`, `chainToKey()`, `dedupeChains()`, `expandToAncestors()` |

### Transforms Subdirectory

Located at `codex/transforms/`:

| File | Exports |
|------|---------|
| `codex-transforms.ts` | `makeCodexTransform()`, `makeCodexBacklinkTransform()`, `makeCodexContentTransform()` |
| `scroll-transforms.ts` | `makeScrollBacklinkTransform()`, `makeStripScrollBacklinkTransform()` |
| `transform-utils.ts` | `isBacklinkLine()`, `splitFirstLine()`, `splitFrontmatter()`, `ensureLeadingBlankLine()` |

### Import Patterns

```ts
// Prefer PathFinder for all path/suffix computation
import { computeCodexSuffix, sectionChainToPathParts } from "../../../paths/path-finder";

// Use dedupeByKey for generic deduplication
import { dedupeByKey, chainToKey } from "./section-chain-utils";

// Import transforms from subdirectory
import { makeCodexTransform } from "./transforms/codex-transforms";
```

### Backward Compatibility

- `backlink-transforms.ts` re-exports from `transforms/` for existing imports
- `codex-split-path.ts` wraps PathFinder with throwing behavior
