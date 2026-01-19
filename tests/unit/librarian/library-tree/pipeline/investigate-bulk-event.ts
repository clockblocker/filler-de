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
