/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import * as fs from "fs";
import * as path from "path";
import { expectFilesToExist } from "../../../../support/api";
import { VAULT_EXPECTATIONS_002 } from "./vault-expectations";

// Helper to recursively serialize tree structure
function serializeTree(node: any, depth = 0): any {
	if (!node) return null;
	const result: any = {
		nodeName: node.nodeName,
		kind: node.kind,
	};
	if (node.status !== undefined) {
		result.status = node.status;
	}
	if (node.extension !== undefined) {
		result.extension = node.extension;
	}
	if (node.children && typeof node.children === "object") {
		result.children = {};
		for (const [key, child] of Object.entries(node.children)) {
			result.children[key] = serializeTree(child, depth + 1);
		}
	}
	return result;
}

export async function testPostHealing002(): Promise<void> {
	// Wait for bulk event accumulator to flush (250ms quiet window + margin)
	// AND for all healing actions to complete
	await new Promise(r => setTimeout(r, 3000));

	// Get debug info from plugin via browser.execute
	try {
		const debugInfo = await browser.executeObsidian(async ({ app }) => {
			// Get all folders in Library/Recipe
			const allFiles = app.vault.getAllLoadedFiles();
			const libraryFolders = allFiles
				.filter((f: any) => f.path?.startsWith("Library/Recipe"))
				.map((f: any) => ({ path: f.path, isFolder: !f.extension }));

			// Check plugin state
			// @ts-ignore
			const plugin = app.plugins?.plugins?.["cbcr-text-eater-de"];
			if (!plugin) {
				return { error: "Plugin not found", vaultFolders: libraryFolders };
			}
			const librarian = plugin.librarian;
			if (!librarian) {
				return { error: "Librarian not found", vaultFolders: libraryFolders };
			}
			const healer = librarian.getHealer();
			if (!healer) {
				return { error: "Healer not found", vaultFolders: libraryFolders };
			}
			// Get tree info
			const tree = healer.tree;
			const root = tree?.getRoot?.();

			// Helper to serialize tree
			const serializeNode = (node: any): any => {
				if (!node) return null;
				const result: any = {
					nodeName: node.nodeName,
					kind: node.kind,
				};
				if (node.status !== undefined) result.status = node.status;
				if (node.extension !== undefined) result.extension = node.extension;
				if (node.children) {
					result.children = {};
					for (const [key, child] of Object.entries(node.children)) {
						result.children[key] = serializeNode(child);
					}
				}
				return result;
			};

			// Get VaultActionManager debug info
			const vam = plugin.vaultActionManager;
			const selfTrackerState = vam?._getDebugSelfTrackerState?.() ?? { trackedPaths: [], trackedPrefixes: [] };

			// Get last bulk event and tree actions from librarian
			const lastBulkEvent = librarian._debugLastBulkEvent;
			const lastTreeActions = librarian._debugLastTreeActions ?? [];
			const lastHealingActions = librarian._debugLastHealingActions ?? [];
			const lastVaultActions = librarian._debugLastVaultActions ?? [];

			// Serialize bulk event for debugging
			const serializeBulkEvent = (bulk: any) => {
				if (!bulk) return null;
				return {
					eventsCount: bulk.events?.length ?? 0,
					rootsCount: bulk.roots?.length ?? 0,
					events: bulk.events?.map((e: any) => ({
						kind: e.kind,
						from: e.from ? { basename: e.from.basename, pathParts: e.from.pathParts, kind: e.from.kind } : undefined,
						to: e.to ? { basename: e.to.basename, pathParts: e.to.pathParts, kind: e.to.kind } : undefined,
						splitPath: e.splitPath ? { basename: e.splitPath.basename, pathParts: e.splitPath.pathParts, kind: e.splitPath.kind } : undefined,
					})) ?? [],
					roots: bulk.roots?.map((r: any) => ({
						kind: r.kind,
						from: r.from ? { basename: r.from.basename, pathParts: r.from.pathParts, kind: r.from.kind } : undefined,
						to: r.to ? { basename: r.to.basename, pathParts: r.to.pathParts, kind: r.to.kind } : undefined,
						splitPath: r.splitPath ? { basename: r.splitPath.basename, pathParts: r.splitPath.pathParts, kind: r.splitPath.kind } : undefined,
					})) ?? [],
				};
			};

			// Get raw events from BulkEventEmmiter
			const rawEvents = vam?._getDebugAllRawEvents?.() ?? [];

			// Get dispatcher debug info
			const sortedActions = vam?._getDebugDispatcherSortedActions?.() ?? [];
			const dispatchErrors = vam?._getDebugDispatcherErrors?.() ?? [];
			const executionTrace = vam?._getDebugExecutionTrace?.() ?? [];
			const batchInfo = vam?._getDebugBatchInfo?.() ?? { batchCounter: 0, allSortedActions: [] };

			return {
				hasLibrarian: true,
				hasHealer: true,
				hasTree: !!tree,
				treeRootName: root?.nodeName ?? null,
				fullTree: serializeNode(root),
				vaultFolders: libraryFolders,
				selfTracker: selfTrackerState,
				lastBulkEvent: serializeBulkEvent(lastBulkEvent),
				lastTreeActions: lastTreeActions.map((a: any) => ({
					actionType: a.actionType,
					targetLocator: a.targetLocator,
					newNodeName: a.newNodeName,
					newParentLocator: a.newParentLocator,
				})),
				lastHealingActions: lastHealingActions.map((h: any) => ({
					kind: h.kind,
					payload: h.payload,
				})),
				lastVaultActions: lastVaultActions.map((v: any) => ({
					kind: v.kind,
					payload: v.payload,
				})),
				dispatcherSortedActions: sortedActions.map((a: any) => ({
					kind: a.kind,
					from: a.payload?.from?.basename,
					to: a.payload?.to?.basename || a.payload?.splitPath?.basename,
					pathParts: a.payload?.to?.pathParts || a.payload?.splitPath?.pathParts,
				})),
				dispatcherErrors: dispatchErrors.map((e: any) => ({
					kind: e.action?.kind,
					error: e.error,
				})),
				executionTrace: executionTrace,
				rawRenameEvents: rawEvents.filter((e: any) => e.event?.includes('onRename')),
				batchCounter: batchInfo.batchCounter,
				allBatches: batchInfo.allSortedActions.map((batch: any[], batchIdx: number) => ({
					batchNumber: batchIdx + 1,
					actionCount: batch.length,
					actions: batch.map((a: any) => ({
						kind: a.kind,
						from: a.payload?.from?.basename,
						to: a.payload?.to?.basename || a.payload?.splitPath?.basename,
						pathParts: a.payload?.to?.pathParts || a.payload?.splitPath?.pathParts,
					})),
				})),
			};
		});

		const logPath = "/tmp/debug-002-rename.log";
		fs.writeFileSync(logPath, `Debug info: ${JSON.stringify(debugInfo, null, 2)}`);
	} catch (e) {
		const logPath = "/tmp/debug-002-rename.log";
		fs.writeFileSync(logPath, `Error: ${e}`);
	}

	await expectFilesToExist(
		[
			...VAULT_EXPECTATIONS_002.postHealing.codexes,
			...VAULT_EXPECTATIONS_002.postHealing.files,
		],
		{
			callerContext: "[testPostHealing002]",
			intervalMs: 200,
			timeoutMs: 15000,
			logFolderOnFail: "Library/Recipe",
		},
	);
}
