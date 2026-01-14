/**
 * Unit tests for the full pipeline:
 * BulkVaultEvent → TreeActions → Healer → CodexImpact → Deletions → HealingActions
 *
 * Focus: Folder moves and codex deletion actions
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { CreateTreeLeafAction } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/tree-action";
import { TreeActionType } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/tree-action";
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
	createPipelineFromCreateActions,
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

const evFolderCreated = (
	sp: ReturnType<typeof spFolder>,
): Extract<VaultEvent, { kind: typeof VaultEventKind.FolderCreated }> => ({
	kind: VaultEventKind.FolderCreated,
	splitPath: sp,
});

const evFileCreated = (
	sp: ReturnType<typeof spMdFile>,
): Extract<VaultEvent, { kind: typeof VaultEventKind.FileCreated }> => ({
	kind: VaultEventKind.FileCreated,
	splitPath: sp,
});

const evFileRenamed = (
	from: ReturnType<typeof spMdFile>,
	to: ReturnType<typeof spMdFile>,
): Extract<VaultEvent, { kind: typeof VaultEventKind.FileRenamed }> => ({
	from,
	kind: VaultEventKind.FileRenamed,
	to,
});

const spMdFile = (
	pathParts: string[],
	basename: string,
): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.MdFile; extension: "md" } => ({
	basename,
	extension: "md",
	kind: SplitPathKind.MdFile,
	pathParts,
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

	describe("Real Obsidian Data", () => {
		it("initializes from logged createActions and processes bulk events", () => {
			// Real data from Obsidian init log
			const createActions: CreateTreeLeafAction[] = [
				{
					actionType: "Create",
					observedSplitPath: {
						basename: "ReName-kid1-mommy-parents",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "mommy", "kid1"],
					},
					targetLocator: {
						segmentId: "ReName﹘Scroll﹘md",
						segmentIdChainToParent: [
							"Library﹘Section﹘",
							"parents﹘Section﹘",
							"mommy﹘Section﹘",
							"kid1﹘Section﹘",
						],
						targetKind: "Scroll",
					},
				},
				{
					actionType: "Create",
					observedSplitPath: {
						basename: "Name-kid8-daddy-parents",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "daddy", "kid8"],
					},
					targetLocator: {
						segmentId: "Name﹘Scroll﹘md",
						segmentIdChainToParent: [
							"Library﹘Section﹘",
							"parents﹘Section﹘",
							"daddy﹘Section﹘",
							"kid8﹘Section﹘",
						],
						targetKind: "Scroll",
					},
				},
			] as CreateTreeLeafAction[];

			// Initialize pipeline from real createActions
			const state = createPipelineFromCreateActions(createActions);

			// Verify initial state was created
			expect(state.healer).toBeDefined();
			expect(state.history.length).toBe(0);

			// Now ready to process bulk events on this real tree state
			// Example: move mommy folder
			const bulkEvent = bulk({
				events: [],
				roots: [
					evFolderRenamed(
						spFolder(["Library", "parents"], "mommy"),
						spFolder(["Library", "parents"], "mommy2"),
					),
				],
			});

			const result = processBulkEvent(state, bulkEvent);

			// Verify event was processed
			expect(result.treeActions.length).toBeGreaterThanOrEqual(1);
			expect(state.history.length).toBe(1);
		});

		it("handles duplicate folder creation then rename (real Obsidian scenario)", () => {
			// Initial state from Obsidian
			const createActions: CreateTreeLeafAction[] = [
				{
					actionType: "Create",
					observedSplitPath: {
						basename: "ReName-kid1-mommy-parents",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "mommy", "kid1"],
					},
					targetLocator: {
						segmentId: "ReName﹘Scroll﹘md",
						segmentIdChainToParent: [
							"Library﹘Section﹘",
							"parents﹘Section﹘",
							"mommy﹘Section﹘",
							"kid1﹘Section﹘",
						],
						targetKind: "Scroll",
					},
				},
			] as CreateTreeLeafAction[];

			const state = createPipelineFromCreateActions(createActions);

			// Event 1: Duplicate folder creation (kid1 1)
			const duplicateBulk: BulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 3, deletes: 0, renames: 0 },
					endedAt: 1768365709338,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 1768365709085,
					trueCount: { creates: 3, deletes: 0, renames: 0 },
				},
				events: [
					evFolderCreated(
						spFolder(["Library", "parents", "mommy"], "kid1 1"),
					),
					evFileCreated(
						spMdFile(
							["Library", "parents", "mommy", "kid1 1"],
							"ReName-kid1-mommy-parents",
						),
					),
					evFileCreated(
						spMdFile(
							["Library", "parents", "mommy", "kid1 1"],
							"__-kid1-mommy-parents",
						),
					),
				],
				roots: [],
			};

			const result1 = processBulkEvent(state, duplicateBulk);
			expect(result1.treeActions.length).toBeGreaterThan(0);
			expect(state.history.length).toBe(1);

			// Event 2: Rename duplicate folder (kid1 1 → kid2)
			const renameBulk: BulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 4 },
					endedAt: 1768365731626,
					reduced: { rootDeletes: 0, rootRenames: 1 },
					startedAt: 1768365731372,
					trueCount: { creates: 0, deletes: 0, renames: 4 },
				},
				events: [
					evFileRenamed(
						spMdFile(
							["Library", "parents", "mommy", "kid1 1"],
							"__-kid1-mommy-parents",
						),
						spMdFile(
							["Library", "parents", "mommy", "kid2"],
							"__-kid1-mommy-parents",
						),
					),
					evFileRenamed(
						spMdFile(
							["Library", "parents", "mommy", "kid1 1"],
							"ReName-kid1 1-mommy-parents",
						),
						spMdFile(
							["Library", "parents", "mommy", "kid2"],
							"ReName-kid1 1-mommy-parents",
						),
					),
					evFileRenamed(
						spMdFile(
							["Library", "parents", "mommy", "kid1 1"],
							"__-kid1 1-mommy-parents",
						),
						spMdFile(
							["Library", "parents", "mommy", "kid2"],
							"__-kid1 1-mommy-parents",
						),
					),
					evFolderRenamed(
						spFolder(["Library", "parents", "mommy"], "kid1 1"),
						spFolder(["Library", "parents", "mommy"], "kid2"),
					),
				],
				roots: [
					evFolderRenamed(
						spFolder(["Library", "parents", "mommy"], "kid1 1"),
						spFolder(["Library", "parents", "mommy"], "kid2"),
					),
				],
			};

			const result2 = processBulkEvent(state, renameBulk);
			
			// Verify rename was processed
			expect(result2.treeActions.length).toBeGreaterThanOrEqual(1);
			expect(state.history.length).toBe(2);

			// Verify codex deletion actions for moved codex
			// The codex at new location (kid2) with old suffix should be deleted
			const codexDeletions = result2.deletionActions.filter(
				(a) => a.kind === "DeleteMdFile",
			);
			expect(codexDeletions.length).toBeGreaterThanOrEqual(1);
		});

		it("handles folder move from mommy to daddy (real Obsidian scenario)", () => {
			// Initial state: kid2 folder exists under mommy (from previous rename)
			// We'll simulate the state after the rename by creating the folder
			const createActions: CreateTreeLeafAction[] = [
				{
					actionType: "Create",
					observedSplitPath: {
						basename: "ReName-kid2-mommy-parents",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "mommy", "kid2"],
					},
					targetLocator: {
						segmentId: "ReName﹘Scroll﹘md",
						segmentIdChainToParent: [
							"Library﹘Section﹘",
							"parents﹘Section﹘",
							"mommy﹘Section﹘",
							"kid2﹘Section﹘",
						],
						targetKind: "Scroll",
					},
				},
			] as CreateTreeLeafAction[];

			const state = createPipelineFromCreateActions(createActions);

			// Move event: kid2 folder from mommy to daddy
			const moveBulk: BulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 4 },
					endedAt: 1768365814676,
					reduced: { rootDeletes: 0, rootRenames: 1 },
					startedAt: 1768365814423,
					trueCount: { creates: 0, deletes: 0, renames: 4 },
				},
				events: [
					evFileRenamed(
						spMdFile(
							["Library", "parents", "mommy", "kid2"],
							"__-kid1-mommy-parents",
						),
						spMdFile(
							["Library", "parents", "daddy", "kid2"],
							"__-kid1-mommy-parents",
						),
					),
					evFileRenamed(
						spMdFile(
							["Library", "parents", "mommy", "kid2"],
							"ReName-kid2-mommy-parents",
						),
						spMdFile(
							["Library", "parents", "daddy", "kid2"],
							"ReName-kid2-mommy-parents",
						),
					),
					evFileRenamed(
						spMdFile(
							["Library", "parents", "mommy", "kid2"],
							"__-kid2-mommy-parents",
						),
						spMdFile(
							["Library", "parents", "daddy", "kid2"],
							"__-kid2-mommy-parents",
						),
					),
					evFolderRenamed(
						spFolder(["Library", "parents", "mommy"], "kid2"),
						spFolder(["Library", "parents", "daddy"], "kid2"),
					),
				],
				roots: [
					evFolderRenamed(
						spFolder(["Library", "parents", "mommy"], "kid2"),
						spFolder(["Library", "parents", "daddy"], "kid2"),
					),
				],
			};

			const result = processBulkEvent(state, moveBulk);

			// Verify move was processed
			expect(result.treeActions.length).toBeGreaterThanOrEqual(1);
			const moveAction = result.treeActions.find(
				(a) => a.actionType === TreeActionType.Move,
			);
			expect(moveAction).toBeDefined();

			// Verify CodexImpact has renamed entry
			expect(result.mergedCodexImpact.renamed.length).toBeGreaterThanOrEqual(1);
			const renamed = result.mergedCodexImpact.renamed.find(
				(r) =>
					r.oldChain.includes("mommy﹘Section﹘") &&
					r.newChain.includes("daddy﹘Section﹘"),
			);
			expect(renamed).toBeDefined();

			// Verify codex deletion actions for moved codexes
			// Codexes at new location (daddy/kid2) with old suffix (mommy-parents) should be deleted
			const codexDeletions = result.deletionActions.filter(
				(a) => a.kind === "DeleteMdFile",
			);
			expect(codexDeletions.length).toBeGreaterThanOrEqual(1);

			// Verify at least one deletion targets the new location with old suffix
			const hasCorrectDeletion = codexDeletions.some((del) => {
				if (del.kind === "DeleteMdFile") {
					const path = del.payload.splitPath.pathParts;
					const basename = del.payload.splitPath.basename;
					return (
						path.includes("daddy") &&
						path.includes("kid2") &&
						basename.includes("mommy")
					);
				}
				return false;
			});
			expect(hasCorrectDeletion).toBe(true);
		});
	});
});
