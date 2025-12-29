import type { VaultEvent } from "../../../../..";
import type { PossibleRootVaultEvent } from "./helpers";

export type BulkVaultEvent = {
	/**
	 * Minimally collapsed vault events that were triggered by the user during this bulk operation.
	 */
	events: VaultEvent[];

	/**
	 * Minimal set of "root" vault events that semantically imply the rest
	 * of the events in this bulk operation.
	 *
	 * `roots` is always a subset of `events` and is derived by collapsing
	 * redundant descendant events (most importantly for folder renames).
	 *
	 * ## Example: folder move with many descendant renames
	 *
	 * Obsidian emits:
	 *
	 * ```
	 * Library/parent            → Library/archived/parent
	 * Library/parent/a.md       → Library/archived/parent/a.md
	 * Library/parent/b/c.md     → Library/archived/parent/b/c.md
	 * Library/parent/sub        → Library/archived/parent/sub
	 * Library/parent/sub/x.md   → Library/archived/parent/sub/x.md
	 * ```
	 *
	 * `events` contains all of these as individual `FolderRenamed` / `FileRenamed` events.
	 *
	 * `roots` contains **only**:
	 *
	 * ```ts
	 * [
	 *   {
	 *     type: VaultEventType.FolderRenamed,
	 *     from: { type: "Folder", pathParts: ["Library"], basename: "parent" },
	 *     to:   { type: "Folder", pathParts: ["Library","archived"], basename: "parent" },
	 *   }
	 * ]
	 * ```
	 *
	 * This root event asserts that **all descendants were moved accordingly** and
	 * that all file/folder rename events under this subtree are derived noise.
	 *
	 * ## Example: mixed folder move + independent file rename
	 *
	 * ```
	 * Library/parent            → Library/archived/parent
	 * Library/parent/a.md       → Library/archived/parent/a.md
	 * Library/misc/todo.md      → Library/misc/tasks.md
	 * ```
	 *
	 * `roots` becomes:
	 *
	 * ```ts
	 * [
	 *   {
	 *     type: VaultEventType.FolderRenamed,
	 *     from: Library/parent,
	 *     to:   Library/archived/parent,
	 *   },
	 *   {
	 *     type: VaultEventType.FileRenamed,
	 *     from: Library/misc/todo.md,
	 *     to:   Library/misc/tasks.md,
	 *   }
	 * ]
	 * ```
	 *
	 * ## Semantics
	 * - A `FolderRenamed` root implies that all descendant paths were renamed.
	 * - Descendant rename events MUST NOT be treated as independent user intent.
	 * - `FileRenamed` roots represent standalone renames not covered by any folder root.
	 * - `FileDeleted` / `FolderDeleted` roots (if present) represent top-level deletions.
	 *
	 * Downstream consumers (e.g. LibraryTree) should base their logic on `roots`,
	 * not on the full `events` list.
	 */
	roots: Array<PossibleRootVaultEvent>;

	/**
	 * Diagnostic metadata describing how raw vault events were normalized
	 * and reduced into semantic roots.
	 *
	 * This information is for debugging, observability, and sanity-checking
	 * bulk operations. It does NOT affect semantics.
	 */
	debug: {
		/**
		 * Timestamp (ms since epoch) when the first event of this bulk window was received.
		 */
		startedAt: number;

		/**
		 * Timestamp (ms since epoch) when the bulk window was finalized.
		 */
		endedAt: number;

		/**
		 * Counts of events as originally emitted by Obsidian and accepted
		 * into this bulk window (after basic filtering, but before any collapsing).
		 *
		 * Example:
		 * - Dragging a folder with many files may produce hundreds of rename events.
		 */
		trueCount: {
			renames: number;
			creates: number;
			trashes: number;
		};

		/**
		 * Counts after collapsing mechanically redundant events.
		 *
		 * Collapsing includes:
		 * - rename chains (A → B, B → C ⇒ A → C)
		 * - exact duplicate events
		 *
		 * This stage preserves all semantic intent, but removes noise caused
		 * by intermediate or repeated operations.
		 */
		collapsedCount: {
			renames: number;
			creates: number;
			deletes: number;
		};

		/**
		 * Counts of semantic root events after reduction.
		 *
		 * Reduction removes events that are fully implied by a higher-level root,
		 * most importantly:
		 * - descendant file/folder renames covered by a parent folder rename
		 *
		 * Example:
		 * - 200 file renames under a moved folder may reduce to 1 root folder rename.
		 */
		reduced: {
			/**
			 * Number of rename root events (FileRenamed / FolderRenamed)
			 * that represent independent user intent.
			 */
			rootRenames: number;

			/**
			 * Number of delete root events (FileDeleted / FolderDeleted)
			 * that represent top-level deletions not implied by another root.
			 */
			rootDeletes: number;
		};
	};
};
