/**
 * Unit tests for the full pipeline:
 * BulkVaultEvent → TreeActions → Healer → CodexImpact → Deletions → HealingActions
 *
 * Focus: Folder moves and codex deletion actions
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { TreeActionType } from "../../../../../src/commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import type { BulkVaultEvent } from "../../../../../src/managers/obsidian/vault-action-manager";
import type { PossibleRootVaultEvent } from "../../../../../src/managers/obsidian/vault-action-manager/impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
import { SplitPathKind } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type {
	FolderRenamedVaultEvent,
	VaultEvent,
} from "../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { VaultEventKind } from "../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";
import type { TreeShape } from "../tree-test-helpers";
import {
	createPersistentPipeline,
	processBulkEvent,
	runPipeline,
} from "./helpers";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

// ─── Event Builders ───

const spFolder = (
	pathParts: string[],
	basename: string,
): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.Folder } => ({
	basename,
	kind: SplitPathKind.Folder,
	pathParts,
});

const evFolderRenamed = (
	from: ReturnType<typeof spFolder>,
	to: ReturnType<typeof spFolder>,
): FolderRenamedVaultEvent => ({
	from,
	kind: VaultEventKind.FolderRenamed,
	to,
});

const bulk = ({
	events,
	roots,
}: {
	events?: VaultEvent[];
	roots?: PossibleRootVaultEvent[];
}): BulkVaultEvent => {
	return {
		debug: {
			collapsedCount: { creates: 0, deletes: 0, renames: 0 },
			endedAt: 0,
			reduced: { rootDeletes: 0, rootRenames: 0 },
			startedAt: 0,
			trueCount: { creates: 0, deletes: 0, renames: 0 },
		},
		events: events ?? [],
		roots: roots ?? [],
	};
};

// ─── Tests ───

describe("Folder Move → Codex Deletion Pipeline", () => {
	describe("Simple Folder Move", () => {
		it("Library/A → Library/B/A generates correct deletion actions", () => {
			// Initial tree: Library with section A
			const initialTree: TreeShape = {
				children: {
					A: {},
				},
				libraryRoot: "Library",
			};

			// Use persistent pipeline (single instance)
			const state = createPersistentPipeline(initialTree);

			// Folder move event (folder renames go in roots, not events)
			const bulkEvent = bulk({
				events: [],
				roots: [
					evFolderRenamed(
						spFolder(["Library"], "A"),
						spFolder(["Library", "B"], "A"),
					),
				],
			});

			// Process event
			const result = processBulkEvent(state, bulkEvent);

			// Basic assertions
			expect(result.treeActions.length).toBe(1);
			const moveAction = result.treeActions[0];
			expect(moveAction?.actionType).toBe(TreeActionType.Move);

			// Verify CodexImpact has renamed entry
			expect(result.mergedCodexImpact.renamed.length).toBe(1);
			const renamed = result.mergedCodexImpact.renamed[0];
			expect(renamed?.oldChain).toEqual([
				"Library﹘Section﹘",
				"A﹘Section﹘",
			]);
			expect(renamed?.newChain).toEqual([
				"Library﹘Section﹘",
				"B﹘Section﹘",
				"A﹘Section﹘",
			]);

			// Verify deletion action: new location with old suffix
			expect(result.deletionActions.length).toBe(1);
			const deleteAction = result.deletionActions[0];
			expect(deleteAction?.kind).toBe("DeleteMdFile");
			if (deleteAction?.kind === "DeleteMdFile") {
				expect(deleteAction.payload.splitPath.pathParts).toEqual([
					"Library",
					"B",
					"A",
				]);
				expect(deleteAction.payload.splitPath.basename).toBe("__-A");
			}
		});
	});

	describe("Folder Move with Descendants", () => {
		it("Library/A (with Child) → Library/B/A generates deletions for both", () => {
			// Initial tree: Library with section A containing Child
			const initialTree: TreeShape = {
				children: {
					A: {
						children: {
							Child: {},
						},
					},
				},
				libraryRoot: "Library",
			};

			const state = createPersistentPipeline(initialTree);

			const bulkEvent = bulk({
				events: [],
				roots: [
					evFolderRenamed(
						spFolder(["Library"], "A"),
						spFolder(["Library", "B"], "A"),
					),
				],
			});

			const result = processBulkEvent(state, bulkEvent);

			// Should have deletion for moved section A and its descendant Child
			expect(result.deletionActions.length).toBeGreaterThanOrEqual(2);

			// Verify parent deletion
			const parentDelete = result.deletionActions.find(
				(a) =>
					a.kind === "DeleteMdFile" &&
					a.payload.splitPath.basename === "__-A",
			);
			expect(parentDelete).toBeDefined();

			// Verify descendant deletion (new location, old suffix)
			const childDelete = result.deletionActions.find(
				(a) =>
					a.kind === "DeleteMdFile" &&
					a.payload.splitPath.basename.includes("Child") &&
					a.payload.splitPath.basename.includes("A"),
			);
			expect(childDelete).toBeDefined();

			// Verify exact paths
			if (childDelete?.kind === "DeleteMdFile") {
				expect(childDelete.payload.splitPath.pathParts).toEqual([
					"Library",
					"B",
					"A",
					"Child",
				]);
				expect(childDelete.payload.splitPath.basename).toBe("__-Child-A");
			}
		});
	});

	describe("Nested Folder Move", () => {
		it("Library/A/B → Library/C/B generates deletion for B with old suffix", () => {
			// Initial tree: Library with nested sections A/B
			const initialTree: TreeShape = {
				children: {
					A: {
						children: {
							B: {},
						},
					},
				},
				libraryRoot: "Library",
			};

			const state = createPersistentPipeline(initialTree);

			// Move B from A to C
			const bulkEvent = bulk({
				events: [],
				roots: [
					evFolderRenamed(
						spFolder(["Library", "A"], "B"),
						spFolder(["Library", "C"], "B"),
					),
				],
			});

			const result = processBulkEvent(state, bulkEvent);

			// Should have deletion for moved section B (new location, old suffix)
			expect(result.deletionActions.length).toBeGreaterThanOrEqual(1);
			const bDelete = result.deletionActions.find(
				(a) =>
					a.kind === "DeleteMdFile" &&
					a.payload.splitPath.pathParts.includes("C") &&
					a.payload.splitPath.pathParts.includes("B"),
			);
			expect(bDelete).toBeDefined();

			// Verify it's at new location with old suffix
			if (bDelete?.kind === "DeleteMdFile") {
				expect(bDelete.payload.splitPath.pathParts).toEqual([
					"Library",
					"C",
					"B",
				]);
				// Old suffix should include A (parent chain)
				expect(bDelete.payload.splitPath.basename).toBe("__-B-A");
			}
		});
	});

	describe("Sequential Events (Resilience)", () => {
		it("handles multiple folder moves on same tree instance", () => {
			// Initial tree: Library with sections A and B
			const initialTree: TreeShape = {
				children: {
					A: {
						children: {
							Child: {},
						},
					},
					B: {},
				},
				libraryRoot: "Library",
			};

			// Create persistent pipeline (single healer instance)
			const state = createPersistentPipeline(initialTree);

			// Event 1: Move A → C/A
			const result1 = processBulkEvent(
				state,
				bulk({
					roots: [
						evFolderRenamed(
							spFolder(["Library"], "A"),
							spFolder(["Library", "C"], "A"),
						),
					],
				}),
			);

			// Verify first move
			expect(result1.treeActions.length).toBe(1);
			expect(result1.mergedCodexImpact.renamed.length).toBe(1);
			expect(result1.deletionActions.length).toBeGreaterThanOrEqual(2); // A + Child

			// Event 2: Move B → D/B (on already-mutated tree)
			const result2 = processBulkEvent(
				state,
				bulk({
					roots: [
						evFolderRenamed(
							spFolder(["Library"], "B"),
							spFolder(["Library", "D"], "B"),
						),
					],
				}),
			);

			// Verify second move (tree state should reflect first move)
			expect(result2.treeActions.length).toBe(1);
			expect(result2.mergedCodexImpact.renamed.length).toBe(1);
			expect(result2.deletionActions.length).toBeGreaterThanOrEqual(1); // B

			// Event 3: Move C/A → E/A (move already-moved folder)
			const result3 = processBulkEvent(
				state,
				bulk({
					roots: [
						evFolderRenamed(
							spFolder(["Library", "C"], "A"),
							spFolder(["Library", "E"], "A"),
						),
					],
				}),
			);

			// Verify third move (should handle already-moved folder correctly)
			expect(result3.treeActions.length).toBe(1);
			expect(result3.mergedCodexImpact.renamed.length).toBe(1);
			// Should delete codex at new location (E/A) with old suffix (from C/A)
			expect(result3.deletionActions.length).toBeGreaterThanOrEqual(2); // A + Child

			// Verify all events were recorded
			expect(state.history.length).toBe(3);
		});

		it("handles move then rename on same folder", () => {
			const initialTree: TreeShape = {
				children: {
					A: {},
				},
				libraryRoot: "Library",
			};

			const state = createPersistentPipeline(initialTree);

			// Event 1: Move A → B/A
			const result1 = processBulkEvent(
				state,
				bulk({
					roots: [
						evFolderRenamed(
							spFolder(["Library"], "A"),
							spFolder(["Library", "B"], "A"),
						),
					],
				}),
			);

			expect(result1.treeActions.length).toBe(1);
			expect(result1.treeActions[0]?.actionType).toBe(TreeActionType.Move);

			// Event 2: Rename B/A → B/NewName (rename after move)
			const result2 = processBulkEvent(
				state,
				bulk({
					roots: [
						evFolderRenamed(
							spFolder(["Library", "B"], "A"),
							spFolder(["Library", "B"], "NewName"),
						),
					],
				}),
			);

			// Should handle rename after move correctly
			expect(result2.treeActions.length).toBeGreaterThanOrEqual(1);
			expect(state.history.length).toBe(2);
		});
	});

});
