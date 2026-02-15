import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import logToFile from "../../../../tracing/functions/write-log-to-file";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";
import {
	createPipelineFromCreateActions,
	type PipelineResult,
	processBulkEvent,
} from "./helpers";
import { createActions } from "./observed-bulks/001-create";
import { bulkEvent as duplicateBulk } from "./observed-bulks/002-duplicate";
import { bulkEvent as renameBulk } from "./observed-bulks/003-rename";
import { bulkEvent as moveBulk } from "./observed-bulks/004-move";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

function formatPipelineResult(
	stepName: string,
	result: PipelineResult,
): string {
	const lines: string[] = [];
	lines.push("=".repeat(80));
	lines.push(`STEP: ${stepName}`);
	lines.push("=".repeat(80));
	lines.push("");

	// Tree Actions
	lines.push("📋 TREE ACTIONS");
	lines.push("-".repeat(80));
	if (result.treeActions.length === 0) {
		lines.push("  (none)");
	} else {
		for (const action of result.treeActions) {
			const formatted = formatTreeAction(action);
			lines.push(`  ${action.actionType}: ${formatted}`);
		}
	}
	lines.push("");

	// Codex Impacts
	lines.push("🔍 CODEX IMPACTS");
	lines.push("-".repeat(80));
	lines.push(`  Individual impacts: ${result.codexImpacts.length}`);
	lines.push(`  Merged impact:`);
	lines.push(`    - Deleted: ${result.mergedCodexImpact.deleted.length} sections`);
	lines.push(`    - Renamed: ${result.mergedCodexImpact.renamed.length} sections`);
	lines.push(`    - Content changed: ${result.mergedCodexImpact.contentChanged.length} sections`);
	lines.push(`    - Descendants changed: ${result.mergedCodexImpact.descendantsChanged.length} sections`);
	
	if (result.mergedCodexImpact.deleted.length > 0) {
		lines.push(`    Deleted chains:`);
		for (const chain of result.mergedCodexImpact.deleted) {
			lines.push(`      - ${chain.map((s) => s.replace(/﹘.*$/, "")).join("/")}`);
		}
	}
	
	if (result.mergedCodexImpact.renamed.length > 0) {
		lines.push(`    Renamed chains:`);
		for (const { oldChain, newChain } of result.mergedCodexImpact.renamed) {
			const old = oldChain.map((s) => s.replace(/﹘.*$/, "")).join("/");
			const new_ = newChain.map((s) => s.replace(/﹘.*$/, "")).join("/");
			lines.push(`      - ${old} → ${new_}`);
		}
	}
	lines.push("");

	// Deletions
	lines.push("🗑️  CODEX DELETIONS");
	lines.push("-".repeat(80));
	if (result.deletionActions.length === 0) {
		lines.push("  (none)");
	} else {
		for (const action of result.deletionActions) {
			if (action.kind === "DeleteMdFile") {
				const path = action.payload.splitPath.pathParts.join("/");
				lines.push(`  Delete: ${path}`);
			}
		}
	}
	lines.push("");

	// Recreations
	lines.push("✨ CODEX RECREATIONS");
	lines.push("-".repeat(80));
	if (result.recreationActions.length === 0) {
		lines.push("  (none)");
	} else {
		const upserts = result.recreationActions.filter((a) => a.kind === "UpsertCodex");
		const statusWrites = result.recreationActions.filter((a) => a.kind === "WriteScrollStatus");
		
		if (upserts.length > 0) {
			lines.push(`  UpsertCodex (${upserts.length}):`);
			for (const action of upserts) {
				const path = action.payload.splitPath.pathParts.join("/");
				const chain = action.payload.sectionChain
					.map((s) => s.replace(/﹘.*$/, ""))
					.join("/");
				lines.push(`    - ${path} (section: ${chain})`);
			}
		}
		
		if (statusWrites.length > 0) {
			lines.push(`  WriteScrollStatus (${statusWrites.length}):`);
			for (const action of statusWrites) {
				const path = action.payload.splitPath.pathParts.join("/");
				lines.push(`    - ${path} → ${action.payload.status}`);
			}
		}
	}
	lines.push("");

	// Other Healing Actions
	const otherActions = result.healingActions.filter((a) => a.kind !== "DeleteMdFile");
	if (otherActions.length > 0) {
		lines.push("🔧 OTHER HEALING ACTIONS");
		lines.push("-".repeat(80));
		for (const action of otherActions) {
			lines.push(`  ${action.kind}: ${formatHealingAction(action)}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

function formatTreeAction(action: PipelineResult["treeActions"][0]): string {
	switch (action.actionType) {
		case "Create":
			return `${action.targetLocator.targetKind} at ${action.observedSplitPath.pathParts.join("/")}`;
		case "Delete":
			return `${action.targetLocator.targetKind} (by locator)`;
		case "Rename":
			return `${action.targetLocator.targetKind} → ${action.newNodeName}`;
		case "Move": {
			const moveAction = action as Extract<typeof action, { actionType: "Move" }>;
			return `${moveAction.targetLocator.targetKind} → ${moveAction.newNodeName} (to ${moveAction.newParentLocator.segmentIdChainToParent.join("/")})`;
		}
		case "ChangeStatus": {
			const statusAction = action as Extract<typeof action, { actionType: "ChangeStatus" }>;
			return `${statusAction.targetLocator.targetKind} → ${statusAction.newStatus}`;
		}
	}
}

function formatHealingAction(action: PipelineResult["healingActions"][0]): string {
	switch (action.kind) {
		case "CreateFolder":
			return action.payload.splitPath.pathParts.join("/");
		case "DeleteMdFile":
			return action.payload.splitPath.pathParts.join("/");
		default:
			return JSON.stringify(action.payload);
	}
}

describe("Observed Bulk Events Pipeline", () => {
	it("processes all 4 bulk events sequentially on persistent state", () => {
		// Step 1: Initialize state from create actions
		const state = createPipelineFromCreateActions(createActions);
		expect(state.healer).toBeDefined();
		expect(state.history.length).toBe(0);

		// Step 2: Apply duplicate bulk (002)
		const duplicateResult = processBulkEvent(state, duplicateBulk);
		expect(duplicateResult.treeActions.length).toBeGreaterThan(0);
		expect(duplicateResult.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(1);
		
		// Verify deletion for wrong-suffix codex from duplicate
		// Observed: __-kid1-mommy-parents.md at Library/parents/mommy/kid1 1
		// Expected: __-kid1 1-mommy-parents.md (suffix mismatch)
		const wrongCodexDeletion = duplicateResult.deletionActions.find(
			(action) =>
				action.kind === "DeleteMdFile" &&
				action.payload.splitPath.pathParts.join("/") === "Library/parents/mommy/kid1 1" &&
				action.payload.splitPath.basename === "__-kid1-mommy-parents",
		);
		expect(wrongCodexDeletion).toBeDefined();
		expect(wrongCodexDeletion?.kind).toBe("DeleteMdFile");
		
		logToFile("observed-bulks-002-duplicate.log", formatPipelineResult("002-duplicate", duplicateResult));

		// Step 3: Apply rename bulk (003) - state preserved from step 2
		const renameResult = processBulkEvent(state, renameBulk);
		expect(renameResult.treeActions.length).toBeGreaterThan(0);
		expect(renameResult.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(2);
		logToFile("observed-bulks-003-rename.log", formatPipelineResult("003-rename", renameResult));

		// Step 4: Apply move bulk (004) - state preserved from step 3
		const moveResult = processBulkEvent(state, moveBulk);
		expect(moveResult.treeActions.length).toBeGreaterThan(0);
		expect(moveResult.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(3);
		logToFile("observed-bulks-004-move.log", formatPipelineResult("004-move", moveResult));

		// Verify all steps captured recreations
		expect(duplicateResult.recreationActions.length).toBeGreaterThan(0);
		expect(renameResult.recreationActions.length).toBeGreaterThan(0);
		expect(moveResult.recreationActions.length).toBeGreaterThan(0);
	});
});
