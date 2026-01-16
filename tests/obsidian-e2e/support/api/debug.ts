/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import * as fs from "fs";

/**
 * Debug info gathered from the plugin for test diagnostics.
 */
export type PluginDebugInfo = {
	error?: string;
	vaultFolders: Array<{ path: string; isFolder: boolean }>;
	hasLibrarian?: boolean;
	hasHealer?: boolean;
	hasTree?: boolean;
	treeRootName?: string | null;
	fullTree?: any;
	selfTracker?: { trackedPaths: string[]; trackedPrefixes: string[] };
	lastBulkEvent?: any;
	lastTreeActions?: any[];
	lastHealingActions?: any[];
	lastVaultActions?: any[];
	dispatcherErrors?: any[];
	executionTrace?: any[];
	rawRenameEvents?: any[];
	batchCounter?: number;
	allBatches?: any[];
};

export type GatherDebugInfoOptions = {
	/** Folder path prefix to filter vault files (e.g., "Library/Recipe") */
	folderFilter?: string;
	/** Path to write debug log file (e.g., "/tmp/debug.log") */
	logPath?: string;
	/** Delay in ms before gathering (default: 3000 for healing to complete) */
	delayMs?: number;
};

/**
 * Gather debug info from the plugin for test diagnostics.
 * Useful for debugging test failures by inspecting internal state.
 */
export async function gatherPluginDebugInfo(
	options: GatherDebugInfoOptions = {},
): Promise<PluginDebugInfo> {
	const { folderFilter, logPath, delayMs = 3000 } = options;

	// Wait for bulk event accumulator to flush and healing actions to complete
	if (delayMs > 0) {
		await new Promise((r) => setTimeout(r, delayMs));
	}

	try {
		const debugInfo = await browser.executeObsidian(
			async ({ app }, filterPrefix: string | undefined) => {
				// Get filtered vault files
				const allFiles = app.vault.getAllLoadedFiles();
				const vaultFolders = filterPrefix
					? allFiles
							.filter((f: any) => f.path?.startsWith(filterPrefix))
							.map((f: any) => ({ isFolder: !f.extension, path: f.path }))
					: allFiles.map((f: any) => ({
							isFolder: !f.extension,
							path: f.path,
						}));

				// Check plugin state
				// @ts-ignore - accessing internal plugin registry
				const plugin = app.plugins?.plugins?.["cbcr-text-eater-de"];
				if (!plugin) {
					return { error: "Plugin not found", vaultFolders };
				}

				const librarian = plugin.librarian;
				if (!librarian) {
					return { error: "Librarian not found", vaultFolders };
				}

				const healer = librarian.getHealer();
				if (!healer) {
					return { error: "Healer not found", vaultFolders };
				}

				// Get tree info
				const tree = healer.tree;
				const root = tree?.getRoot?.();

				// Helper to serialize tree nodes
				const serializeNode = (node: any): any => {
					if (!node) return null;
					const result: any = {
						kind: node.kind,
						nodeName: node.nodeName,
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
				const selfTrackerState = vam?._getDebugSelfTrackerState?.() ?? {
					trackedPaths: [],
					trackedPrefixes: [],
				};

				// Get last bulk event and tree actions from librarian
				const lastBulkEvent = librarian._debugLastBulkEvent;
				const lastTreeActions = librarian._debugLastTreeActions ?? [];
				const lastHealingActions = librarian._debugLastHealingActions ?? [];
				const lastVaultActions = librarian._debugLastVaultActions ?? [];

				// Serialize bulk event for debugging
				const serializeBulkEvent = (bulk: any) => {
					if (!bulk) return null;
					return {
						events:
							bulk.events?.map((e: any) => ({
								from: e.from
									? {
											basename: e.from.basename,
											kind: e.from.kind,
											pathParts: e.from.pathParts,
										}
									: undefined,
								kind: e.kind,
								splitPath: e.splitPath
									? {
											basename: e.splitPath.basename,
											kind: e.splitPath.kind,
											pathParts: e.splitPath.pathParts,
										}
									: undefined,
								to: e.to
									? {
											basename: e.to.basename,
											kind: e.to.kind,
											pathParts: e.to.pathParts,
										}
									: undefined,
							})) ?? [],
						eventsCount: bulk.events?.length ?? 0,
						roots:
							bulk.roots?.map((r: any) => ({
								from: r.from
									? {
											basename: r.from.basename,
											kind: r.from.kind,
											pathParts: r.from.pathParts,
										}
									: undefined,
								kind: r.kind,
								splitPath: r.splitPath
									? {
											basename: r.splitPath.basename,
											kind: r.splitPath.kind,
											pathParts: r.splitPath.pathParts,
										}
									: undefined,
								to: r.to
									? {
											basename: r.to.basename,
											kind: r.to.kind,
											pathParts: r.to.pathParts,
										}
									: undefined,
							})) ?? [],
						rootsCount: bulk.roots?.length ?? 0,
					};
				};

				// Get raw events from BulkEventEmmiter
				const rawEvents = vam?._getDebugAllRawEvents?.() ?? [];

				// Get dispatcher debug state (formalized API)
				const debugState = vam?.getDebugState?.() ?? {
					allSortedActions: [],
					batchCounter: 0,
					executionTrace: [],
					lastErrors: [],
				};

				return {
					allBatches: debugState.allSortedActions.map(
						(batch: any[], batchIdx: number) => ({
							actionCount: batch.length,
							actions: batch.map((a: any) => ({
								from: a.payload?.from?.basename,
								kind: a.kind,
								pathParts:
									a.payload?.to?.pathParts || a.payload?.splitPath?.pathParts,
								to: a.payload?.to?.basename || a.payload?.splitPath?.basename,
							})),
							batchNumber: batchIdx + 1,
						}),
					),
					batchCounter: debugState.batchCounter,
					dispatcherErrors: debugState.lastErrors.map((e: any) => ({
						error: e.error,
						kind: e.action?.kind,
					})),
					executionTrace: debugState.executionTrace,
					fullTree: serializeNode(root),
					hasHealer: true,
					hasLibrarian: true,
					hasTree: !!tree,
					lastBulkEvent: serializeBulkEvent(lastBulkEvent),
					lastHealingActions: lastHealingActions.map((h: any) => ({
						kind: h.kind,
						payload: h.payload,
					})),
					lastTreeActions: lastTreeActions.map((a: any) => ({
						actionType: a.actionType,
						newNodeName: a.newNodeName,
						newParentLocator: a.newParentLocator,
						targetLocator: a.targetLocator,
					})),
					lastVaultActions: lastVaultActions.map((v: any) => ({
						kind: v.kind,
						payload: v.payload,
					})),
					rawRenameEvents: rawEvents.filter((e: any) =>
						e.event?.includes("onRename"),
					),
					selfTracker: selfTrackerState,
					treeRootName: root?.nodeName ?? null,
					vaultFolders,
				};
			},
			folderFilter,
		);

		// Write to log file if requested
		if (logPath) {
			fs.writeFileSync(
				logPath,
				`Debug info: ${JSON.stringify(debugInfo, null, 2)}`,
			);
		}

		return debugInfo;
	} catch (e) {
		const errorInfo: PluginDebugInfo = {
			error: String(e),
			vaultFolders: [],
		};

		if (logPath) {
			fs.writeFileSync(logPath, `Error: ${e}`);
		}

		return errorInfo;
	}
}
