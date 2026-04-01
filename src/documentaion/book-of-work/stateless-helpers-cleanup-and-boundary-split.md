# Stateless Helpers Cleanup And Boundary Split

## Goal

Retire `src/stateless-helpers/` as a catch-all bucket and replace it with explicit ownership:

- package-shared helpers live in workspace packages
- app-only helpers live next to the feature/runtime that uses them
- package code no longer re-exports or duplicates app-root helpers

The target outcome is not "move everything into packages". The target outcome is "each helper lives at the boundary that owns its types, dependencies, and consumers".

## Problem Statement

`src/stateless-helpers/` currently mixes four different categories:

1. pure text helpers that are reused across boundaries
2. `SplitPath` helpers whose real owner is VAM
3. note metadata helpers consumed by both app-root code and package code
4. app-specific runtime/domain helpers that are not meaningfully shared

This creates three concrete problems:

- duplicated implementations now exist in `src/packages/`
- package code sometimes depends on app-root helpers indirectly or via re-export shims
- the folder name suggests low-level generic utilities, but several files encode product policy or runtime dependencies

## Current State

### Duplicated helpers

- `block-id.ts`
  - app-root copy: `src/stateless-helpers/block-id.ts`
  - package-local copy: `src/packages/composed/obsidian-event-layer/src/internal/block-id.ts`
- `multi-span.ts`
  - app-root copy: `src/stateless-helpers/multi-span.ts`
  - package-local copy: `src/packages/independent/lexical-generation/src/internal/shared/multi-span.ts`
- `split-path-comparison.ts`
  - app-root copy: `src/stateless-helpers/split-path-comparison.ts`
  - package-local equivalents:
    - `src/packages/composed/library-core/src/healing/split-path-equality.ts`
    - `src/packages/composed/obsidian-event-layer/src/internal/stringify-split-path.ts`

### Cross-boundary leak

`noteMetadataHelper` is still rooted in app code, but package code consumes it:

- `src/packages/composed/library-core/src/internal/root/note-metadata.ts` re-exports from `src/stateless-helpers/note-metadata`

That is a smell even if it currently works in this mono-repo layout.

### App-only helpers mixed into the same bucket

These files do not benefit from package extraction in their current form:

- `api-service.ts`
- `retry.ts`
- `library-files.ts`
- `morphology-relation.ts`
- `offset-mapper.ts`

They either depend on runtime APIs, app settings, or narrow feature semantics.

## Constraints

### Package boundary rules

- `independent/` packages cannot import sibling workspace packages
- `composed/` packages may depend on `independent/` packages
- package code should not reach into app-root `src/*`

### Ownership rules implied by current code

- VAM owns `SplitPath` and related codecs, so `splitPathsEqual()` and `stringifySplitPath()` belong with VAM, not in a generic app helper bucket
- `noteMetadataHelper` currently depends on global app settings via `getParsedUserSettings()`, so it cannot move into a package unchanged
- pure string/text utilities can be shared safely if they stay dependency-free

## Proposed Split

## 1. Move `SplitPath` helpers into VAM

### Scope

- move `splitPathsEqual()`
- move `stringifySplitPath()`

### Target

Add public helpers to `@textfresser/vault-action-manager`.

Possible homes:

- `src/packages/independent/vault-action-manager/src/helpers/split-path.ts`
- or `src/packages/independent/vault-action-manager/src/impl/common/split-path-display.ts`

The exact file name is less important than the ownership: VAM should expose these as part of the `SplitPath` toolbelt.

### Why

- the functions operate only on VAM-owned types
- package-local copies can then be deleted
- app code stops carrying a second unofficial `SplitPath` utility layer

## 2. Create one small independent package for pure note/text helpers

### Scope

- `block-id.ts`
- `markdown-strip.ts`
- `multi-span.ts`

### Proposed package

`src/packages/independent/note-text/`

Suggested public API:

- `blockIdHelper`
- `markdownHelper`
- `multiSpanHelper`

### Why this package

- all three are pure string-processing helpers
- they are reusable by both app-root code and workspace packages
- `block-id` and `multi-span` are already duplicated across boundaries
- `markdown-strip` is not duplicated yet, but it fits the same dependency profile and should move with the other pure text helpers

### Explicit non-members

Do not put `noteMetadataHelper` here.

`noteMetadataHelper` is not just text parsing. It encodes note storage format policy and currently depends on settings/runtime concerns.

## 3. Extract `noteMetadataHelper` into a composed package after dependency inversion

### Scope

- `src/stateless-helpers/note-metadata/**`

### Proposed package

`src/packages/composed/note-metadata/`

### Required API change

Remove the direct dependency on `getParsedUserSettings()`.

Instead of reading global state internally, expose one of these shapes:

```ts
type NoteMetadataMode = {
	hideMetadata: boolean;
};

function createNoteMetadataHelper(mode: NoteMetadataMode) {
	return {
		decompose,
		findSectionStart,
		read,
		strip,
		stripOnlyFrontmatter,
		toggleStatus,
		upsert,
	};
}
```

or:

```ts
upsert(metadata, { hideMetadata })
toggleStatus(checked, { hideMetadata })
```

The factory shape is preferable because it keeps call sites small and makes the policy injection explicit.

### Why composed, not independent

- it depends on VAM types (`Transform`)
- it represents note-format policy rather than a generic primitive
- `library-core` already consumes it, so it should become a first-class package boundary instead of an app-root re-export

## 4. Move app-only helpers out of the shared bucket and next to their owners

These files should stay in app-root `src/`, but not under a fake shared boundary:

### `api-service.ts` and `retry.ts`

Target:

- `src/commanders/textfresser/llm/api-service.ts`
- `src/commanders/textfresser/llm/internal/retry.ts`

Reason:

- OpenAI/Obsidian runtime integration
- prompt execution concern, not generic utility

### `library-files.ts`

Target:

- `src/commanders/librarian/runtime/get-md-files-in-library.ts`
- or `src/main/get-md-files-in-library.ts` if only bootstrap code needs it

Reason:

- depends on Obsidian `Vault`
- "library root" is app policy, not a shared package primitive

### `morphology-relation.ts`

Target:

- `src/commanders/textfresser/domain/morphology/morphology-relation.ts`

Reason:

- textfresser-specific domain vocabulary
- localized labels and relation markers are product/domain semantics

### `offset-mapper.ts`

Target:

- `src/commanders/librarian/pages/segmenter/offset-mapper.ts`

Reason:

- only used by the librarian segmenter flow
- not a shared boundary concern

## Resulting Ownership Map

| Current helper | Target home | Boundary |
|---|---|---|
| `split-path-comparison.ts` | VAM public helper(s) | `independent` existing package |
| `block-id.ts` | `note-text` | `independent` new package |
| `markdown-strip.ts` | `note-text` | `independent` new package |
| `multi-span.ts` | `note-text` | `independent` new package |
| `note-metadata/**` | `note-metadata` | `composed` new package |
| `api-service.ts` | textfresser LLM runtime | app-root local |
| `retry.ts` | textfresser LLM internal | app-root local |
| `library-files.ts` | librarian/bootstrap runtime | app-root local |
| `morphology-relation.ts` | textfresser domain | app-root local |
| `offset-mapper.ts` | librarian segmenter | app-root local |

## Migration Plan

## Phase 0. Freeze the old bucket

- declare `src/stateless-helpers/` deprecated
- do not add new imports to it
- any touched helper must either move or gain a clear owner decision

Exit condition:

- no new code lands in `src/stateless-helpers/`

## Phase 1. Move `SplitPath` helpers into VAM

- add `splitPathsEqual()` and `stringifySplitPath()` to VAM
- migrate:
  - app-root imports
  - `library-core` local duplicate
  - `obsidian-event-layer` local duplicate
- delete duplicate implementations

Exit condition:

- `SplitPath` helper logic exists in exactly one implementation owned by VAM

## Phase 2. Create `note-text`

- create `src/packages/independent/note-text/`
- move `block-id`, `markdown-strip`, `multi-span`
- migrate app-root imports
- migrate:
  - `obsidian-event-layer` off its internal `block-id`
  - `lexical-generation` off its internal `multi-span`
- delete package-local copies

Exit condition:

- pure note/text helper logic exists in exactly one shared implementation

## Phase 3. Extract `note-metadata`

- invert settings dependency with a factory or explicit options
- create `src/packages/composed/note-metadata/`
- migrate app-root users
- migrate `library-core`
- remove the app-root re-export shim

Exit condition:

- no package imports `noteMetadataHelper` from app-root code

## Phase 4. Localize app-only helpers

- move `api-service`, `retry`, `library-files`, `morphology-relation`, `offset-mapper`
- update imports
- verify no helper in the old bucket is pretending to be shared while serving only one feature

Exit condition:

- remaining helpers live next to their feature/runtime owners

## Phase 5. Delete `src/stateless-helpers/`

- remove the folder
- update docs that still refer to it
- add a lint guard if needed to prevent reintroduction

Exit condition:

- `src/stateless-helpers/` no longer exists

## Risks

### `noteMetadataHelper` behavior drift

This helper changes note serialization behavior depending on `hideMetadata`. The extraction must preserve:

- frontmatter vs JSON-section behavior
- merge semantics in `toggleStatus()`
- whitespace/position assumptions used by callers

This part deserves focused regression tests before and after migration.

### Public API churn in VAM

Adding `SplitPath` helpers to VAM is correct, but it expands the public surface. Keep the API narrow and obviously tied to `SplitPath`.

### Too many tiny packages

Do not create a package per helper. The split above intentionally uses:

- one new independent package for pure text helpers
- one new composed package for note metadata
- existing VAM package for `SplitPath` helpers

That is enough.

## Testing Strategy

- add unit coverage before moving any duplicated helper with subtle behavior
- require passing tests in the owning package after migration
- add at least one integration check for `noteMetadataHelper` consumers
- run `bun run typecheck:changed` after each migration slice

High-value migration tests:

- `block-id`: parse, numeric IDs, embed formatting
- `multi-span`: anchor matching, overlap rejection, existing wikilink skip behavior
- `note-metadata`: read/write parity for hidden vs visible metadata modes
- `SplitPath`: equality and stringify behavior round-tripped across representative file and folder shapes

## Acceptance Criteria

- no duplicated helper implementations remain across app-root and packages
- package code does not import or re-export app-root helpers
- `SplitPath` helpers are owned by VAM
- note text helpers are owned by a single dependency-free shared package
- note metadata logic is package-owned with explicit policy injection
- app-only helpers live with their feature/runtime owners
- `src/stateless-helpers/` is deleted

## Recommendation

Take the migration in this order:

1. VAM `SplitPath` helpers
2. `note-text`
3. `note-metadata`
4. app-local helper moves

That sequence removes the current duplication first, resolves the package-boundary leak second, and leaves the low-risk file moves for last.
