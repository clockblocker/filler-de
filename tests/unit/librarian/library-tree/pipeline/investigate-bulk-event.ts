/**
 * Investigation script for processing observed bulk events.
 * 
 * Usage:
 *   bun run tests/unit/librarian/library-tree/pipeline/investigate-bulk-event.ts <path-to-json>
 * 
 * Or import and use programmatically:
 *   import { investigateBulkEvent } from "./investigate-bulk-event";
 *   const result = investigateBulkEvent(createActions, bulkEvent);
 */

import type { CodexImpact } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/compute-codex-impact";
import type { CodexAction } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/types/codex-action";
import type { CreateTreeLeafAction, TreeAction } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/tree-action";
import type { HealingAction } from "../../../../../src/commanders/librarian-new/healer/library-tree/types/healing-action";
import type { BulkVaultEvent } from "../../../../../src/managers/obsidian/vault-action-manager";
import {
	createPipelineFromCreateActions,
	type PipelineResult,
	processBulkEvent,
} from "./helpers";

// ─── Main Investigation Function ───

export function investigateBulkEvent(
	createActions: CreateTreeLeafAction[],
	bulkEvent: BulkVaultEvent,
): PipelineResult {
	// Initialize pipeline from createActions
	const state = createPipelineFromCreateActions(createActions);

	// Process bulk event
	const result = processBulkEvent(state, bulkEvent);

	// Log all healing actions
	logInvestigation(result);

	return result;
}

// ─── Logging ───

function logInvestigation(result: PipelineResult): void {
	console.log("\n" + "=".repeat(80));
	console.log("BULK EVENT INVESTIGATION");
	console.log("=".repeat(80) + "\n");

	logTreeActions(result.treeActions);
	logCodexImpacts(result.codexImpacts, result.mergedCodexImpact);
	logDeletions(result.deletionActions);
	logRecreations(result.recreationActions);
	logOtherHealingActions(result.healingActions);

	console.log("\n" + "=".repeat(80) + "\n");
}

function logTreeActions(actions: TreeAction[]): void {
	console.log("📋 TREE ACTIONS");
	console.log("-".repeat(80));
	if (actions.length === 0) {
		console.log("  (none)");
	} else {
		for (const action of actions) {
			console.log(`  ${action.actionType}:`, formatTreeAction(action));
		}
	}
	console.log();
}

function formatTreeAction(action: TreeAction): string {
	switch (action.actionType) {
		case "Create":
			return `${action.targetLocator.targetKind} at ${action.observedSplitPath.pathParts.join("/")}`;
		case "Delete":
			return `${action.targetLocator.targetKind} (deleted)`;
		case "Rename":
			return `${action.targetLocator.targetKind}: ${action.newNodeName}`;
		case "Move":
			return `${action.targetLocator.targetKind}: moved to ${action.observedSplitPath.pathParts.join("/")}`;
		case "ChangeStatus":
			return `${action.targetLocator.targetKind}: status changed`;
	}
}

function logCodexImpacts(
	impacts: CodexImpact[],
	merged: CodexImpact,
): void {
	console.log("🔍 CODEX IMPACTS");
	console.log("-".repeat(80));
	console.log(`  Individual impacts: ${impacts.length}`);
	console.log(`  Merged impact:`);
	console.log(`    - Deleted: ${merged.deleted.length} sections`);
	console.log(`    - Renamed: ${merged.renamed.length} sections`);
	console.log(`    - Content changed: ${merged.contentChanged.length} sections`);
	console.log(`    - Descendants changed: ${merged.descendantsChanged.length} sections`);
	
	if (merged.deleted.length > 0) {
		console.log(`    Deleted chains:`);
		for (const chain of merged.deleted) {
			console.log(`      - ${chain.map((s) => s.replace(/﹘.*$/, "")).join("/")}`);
		}
	}
	
	if (merged.renamed.length > 0) {
		console.log(`    Renamed chains:`);
		for (const { oldChain, newChain } of merged.renamed) {
			const old = oldChain.map((s) => s.replace(/﹘.*$/, "")).join("/");
			const new_ = newChain.map((s) => s.replace(/﹘.*$/, "")).join("/");
			console.log(`      - ${old} → ${new_}`);
		}
	}
	
	console.log();
}

function logDeletions(actions: HealingAction[]): void {
	console.log("🗑️  CODEX DELETIONS");
	console.log("-".repeat(80));
	if (actions.length === 0) {
		console.log("  (none)");
	} else {
		for (const action of actions) {
			if (action.kind === "DeleteMdFile") {
				const path = action.payload.splitPath.pathParts.join("/");
				console.log(`  Delete: ${path}`);
			}
		}
	}
	console.log();
}

function logRecreations(actions: CodexAction[]): void {
	console.log("✨ CODEX RECREATIONS");
	console.log("-".repeat(80));
	if (actions.length === 0) {
		console.log("  (none)");
	} else {
		const upserts = actions.filter((a) => a.kind === "UpsertCodex");
		const statusWrites = actions.filter((a) => a.kind === "WriteScrollStatus");
		
		if (upserts.length > 0) {
			console.log(`  UpsertCodex (${upserts.length}):`);
			for (const action of upserts) {
				const path = action.payload.splitPath.pathParts.join("/");
				const chain = action.payload.sectionChain
					.map((s) => s.replace(/﹘.*$/, ""))
					.join("/");
				console.log(`    - ${path} (section: ${chain})`);
			}
		}
		
		if (statusWrites.length > 0) {
			console.log(`  WriteScrollStatus (${statusWrites.length}):`);
			for (const action of statusWrites) {
				const path = action.payload.splitPath.pathParts.join("/");
				console.log(`    - ${path} → ${action.payload.status}`);
			}
		}
	}
	console.log();
}

function logOtherHealingActions(actions: HealingAction[]): void {
	const otherActions = actions.filter((a) => a.kind !== "DeleteMdFile");
	if (otherActions.length === 0) {
		return;
	}
	
	console.log("🔧 OTHER HEALING ACTIONS");
	console.log("-".repeat(80));
	for (const action of otherActions) {
		console.log(`  ${action.kind}:`, formatHealingAction(action));
	}
	console.log();
}

function formatHealingAction(action: HealingAction): string {
	switch (action.kind) {
		case "CreateFolder":
			return action.payload.splitPath.pathParts.join("/");
		case "DeleteMdFile":
			return action.payload.splitPath.pathParts.join("/");
		default:
			return JSON.stringify(action.payload);
	}
}

// ─── CLI Entry Point ───

if (import.meta.main) {
	const filePath = process.argv[2];
	if (!filePath) {
		console.error("Usage: bun run investigate-bulk-event.ts <path-to-json>");
		console.error("\nJSON file should contain:");
		console.error("  {");
		console.error("    \"createActions\": [...],");
		console.error("    \"bulkEvent\": {...}");
		console.error("  }");
		process.exit(1);
	}

	const data = JSON.parse(
		await Bun.file(filePath).text(),
	) as {
		createActions: CreateTreeLeafAction[];
		bulkEvent: BulkVaultEvent;
	};

	investigateBulkEvent(data.createActions, data.bulkEvent);
}

// ─── Unit Tests: extractInvalidCodexesFromBulk Expectations ───
// Step 0: Define expectations before implementation

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { Codecs } from "../../../../../src/commanders/librarian-new/codecs";
import type { TreeAccessor } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";
import { createActions } from "./observed-bulks/001-create";
import { bulkEvent as duplicateBulk } from "./observed-bulks/002-duplicate";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

/**
 * Placeholder for extractInvalidCodexesFromBulk function.
 * TODO: Implement in codex-impact-to-actions.ts
 */
function extractInvalidCodexesFromBulk(
	bulkEvent: BulkVaultEvent,
	healer: TreeAccessor,
	codecs: Codecs,
): HealingAction[] {
	// TODO: Implement according to plan
	// - Extract FileCreated and FileRenamed events for codex files
	// - Validate each codex's suffix against current tree state
	// - Return deletion actions for wrong-suffix codexes
	throw new Error("extractInvalidCodexesFromBulk not yet implemented");
}

describe("extractInvalidCodexesFromBulk (Step 0: Expectations)", () => {
	it("detects wrong-suffix codex from duplicate folder (002-duplicate)", () => {
		const state = createPipelineFromCreateActions(createActions);
		
		// Process duplicate bulk event to update tree state
		processBulkEvent(state, duplicateBulk);
		
		// Extract invalid codexes from bulk event
		const invalidCodexDeletions = extractInvalidCodexesFromBulk(
			duplicateBulk,
			state.healer,
			state.codecs,
		);
		
		// Expect deletion for wrong-suffix codex
		// Observed: __-kid1-mommy-parents.md at Library/parents/mommy/kid1 1
		// Expected: __-kid1 1-mommy-parents.md (suffix mismatch)
		const wrongCodexPath = "Library/parents/mommy/kid1 1/__-kid1-mommy-parents.md";
		const deletion = invalidCodexDeletions.find(
			(action) =>
				action.kind === "DeleteMdFile" &&
				action.payload.splitPath.pathParts.join("/") === wrongCodexPath,
		);
		
		expect(deletion).toBeDefined();
		expect(deletion?.kind).toBe("DeleteMdFile");
	});

	it("handles FileCreated events for codex files", () => {
		const state = createPipelineFromCreateActions(createActions);
		processBulkEvent(state, duplicateBulk);
		
		const invalidCodexDeletions = extractInvalidCodexesFromBulk(
			duplicateBulk,
			state.healer,
			state.codecs,
		);
		
		// Should process FileCreated event for codex
		expect(invalidCodexDeletions.length).toBeGreaterThan(0);
	});

	it("handles FileRenamed events for codex files with wrong suffixes", () => {
		const state = createPipelineFromCreateActions(createActions);
		
		// Create a bulk event with FileRenamed for codex
		const renameBulk: BulkVaultEvent = {
			debug: {
				collapsedCount: { creates: 0, deletes: 0, renames: 1 },
				endedAt: 0,
				reduced: { rootDeletes: 0, rootRenames: 0 },
				startedAt: 0,
				trueCount: { creates: 0, deletes: 0, renames: 1 },
			},
			events: [
				{
					from: {
						basename: "__-kid1-mommy-parents",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "mommy", "kid1"],
					},
					kind: "FileRenamed",
					to: {
						basename: "__-kid1-mommy-parents", // old suffix at new location
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "mommy", "kid1 1"], // moved
					},
				},
			],
			roots: [],
		};
		
		processBulkEvent(state, renameBulk);
		
		const invalidCodexDeletions = extractInvalidCodexesFromBulk(
			renameBulk,
			state.healer,
			state.codecs,
		);
		
		// Should detect wrong suffix at new location
		expect(invalidCodexDeletions.length).toBeGreaterThan(0);
	});

	it("does not delete valid codexes with correct suffixes", () => {
		const state = createPipelineFromCreateActions(createActions);
		
		// Create bulk event with valid codex (correct suffix)
		const validCodexBulk: BulkVaultEvent = {
			debug: {
				collapsedCount: { creates: 1, deletes: 0, renames: 0 },
				endedAt: 0,
				reduced: { rootDeletes: 0, rootRenames: 0 },
				startedAt: 0,
				trueCount: { creates: 1, deletes: 0, renames: 0 },
			},
			events: [
				{
					kind: "FileCreated",
					splitPath: {
						basename: "__-kid1-mommy-parents", // correct for Library/parents/mommy/kid1
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "mommy", "kid1"],
					},
				},
			],
			roots: [],
		};
		
		processBulkEvent(state, validCodexBulk);
		
		const invalidCodexDeletions = extractInvalidCodexesFromBulk(
			validCodexBulk,
			state.healer,
			state.codecs,
		);
		
		// Should not delete valid codex
		const validCodexPath = "Library/parents/mommy/kid1/__-kid1-mommy-parents.md";
		const deletion = invalidCodexDeletions.find(
			(action) =>
				action.kind === "DeleteMdFile" &&
				action.payload.splitPath.pathParts.join("/") === validCodexPath,
		);
		
		expect(deletion).toBeUndefined();
	});

	it("validates codex suffix against current tree state after actions applied", () => {
		const state = createPipelineFromCreateActions(createActions);
		
		// Process duplicate to update tree (creates "kid1 1" section)
		processBulkEvent(state, duplicateBulk);
		
		const invalidCodexDeletions = extractInvalidCodexesFromBulk(
			duplicateBulk,
			state.healer, // tree state after "kid1 1" section created
			state.codecs,
		);
		
		// Should use updated tree state to compute expected suffix
		// Expected for "kid1 1" section: __-kid1 1-mommy-parents
		// Observed: __-kid1-mommy-parents → mismatch detected
		expect(invalidCodexDeletions.length).toBeGreaterThan(0);
	});

	it("handles nested folder duplicates with multiple codexes", () => {
		const state = createPipelineFromCreateActions(createActions);
		
		// Nested duplicate scenario
		const nestedDuplicateBulk: BulkVaultEvent = {
			debug: {
				collapsedCount: { creates: 4, deletes: 0, renames: 0 },
				endedAt: 0,
				reduced: { rootDeletes: 0, rootRenames: 0 },
				startedAt: 0,
				trueCount: { creates: 4, deletes: 0, renames: 0 },
			},
			events: [
				{
					kind: "FolderCreated",
					splitPath: {
						basename: "mommy 1",
						kind: "Folder",
						pathParts: ["Library", "parents"],
					},
				},
				{
					kind: "FolderCreated",
					splitPath: {
						basename: "kid1 1",
						kind: "Folder",
						pathParts: ["Library", "parents", "mommy 1"],
					},
				},
				{
					kind: "FileCreated",
					splitPath: {
						basename: "__-mommy-parents", // wrong: should be __-mommy 1-parents
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "mommy 1"],
					},
				},
				{
					kind: "FileCreated",
					splitPath: {
						basename: "__-kid1-mommy-parents", // wrong: should be __-kid1 1-mommy 1-parents
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "parents", "mommy 1", "kid1 1"],
					},
				},
			],
			roots: [],
		};
		
		processBulkEvent(state, nestedDuplicateBulk);
		
		const invalidCodexDeletions = extractInvalidCodexesFromBulk(
			nestedDuplicateBulk,
			state.healer,
			state.codecs,
		);
		
		// Should detect both wrong-suffix codexes
		expect(invalidCodexDeletions.length).toBeGreaterThanOrEqual(2);
	});
});
