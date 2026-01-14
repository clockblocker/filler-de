/**
 * Unit tests for real Obsidian scenarios:
 * - Duplicate folder creation
 * - Folder rename
 * - Folder move
 *
 * Uses actual BulkVaultEvent data from Obsidian logs.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { CreateTreeLeafAction } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/tree-action";
import { TreeActionType } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/tree-action";
import type { BulkVaultEvent } from "../../../../../src/managers/obsidian/vault-action-manager";
import { SplitPathKind } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type {
	FileCreatedVaultEvent,
	FileRenamedVaultEvent,
	FolderCreatedVaultEvent,
	FolderRenamedVaultEvent,
	VaultEvent,
} from "../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { VaultEventKind } from "../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";
import {
	createPipelineFromCreateActions,
	processBulkEvent,
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

const spMdFile = (
	pathParts: string[],
	basename: string,
): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.MdFile; extension: "md" } => ({
	basename,
	extension: "md",
	kind: SplitPathKind.MdFile,
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
): FolderCreatedVaultEvent => ({
	kind: VaultEventKind.FolderCreated,
	splitPath: sp,
});

const evFileCreated = (
	sp: ReturnType<typeof spMdFile>,
): FileCreatedVaultEvent => ({
	kind: VaultEventKind.FileCreated,
	splitPath: sp,
});

const evFileRenamed = (
	from: ReturnType<typeof spMdFile>,
	to: ReturnType<typeof spMdFile>,
): FileRenamedVaultEvent => ({
	from,
	kind: VaultEventKind.FileRenamed,
	to,
});

const bulk = ({
	events,
	roots,
}: {
	events?: VaultEvent[];
	roots?: VaultEvent[];
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

describe("Real Obsidian Scenarios", () => {
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
	});
});
