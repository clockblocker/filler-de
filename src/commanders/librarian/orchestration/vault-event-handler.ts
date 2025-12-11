import type { TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import { splitPathKey } from "../../../obsidian-vault-action-manager";
import type {
	CoreSplitPath,
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { fullPathFromSystemPath } from "../../../services/obsidian-services/atomic-services/pathfinder";
import { TextStatus } from "../../../types/common-interface/enums";
import type { ActionDispatcher } from "../action-dispatcher";
import {
	isInUntracked,
	isRootName,
	LIBRARY_ROOT,
	type RootName,
} from "../constants";
import { healFile } from "../filesystem/healing";
import { toNodeName, treePathToScrollBasename } from "../indexing/codecs";
import {
	canonicalizePath,
	computeCanonicalPath,
	decodeBasename,
} from "../invariants/path-canonicalizer";
import type { LibrarianState } from "../librarian-state";
import type { TreePath } from "../types";
import { createFolderActionsForPathParts } from "../utils/folder-actions";
import type { ManagerFsAdapter } from "../utils/manager-fs-adapter.ts";
import type { SelfEventTracker } from "../utils/self-event-tracker";
import type { FilesystemHealer } from "./filesystem-healer";
import type { TreeReconciler } from "./tree-reconciler";

const RENAME_DEBOUNCE_MS = 100;

export class VaultEventHandler {
	private pendingRenameRoots = new Set<RootName>();
	private renameDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly deps: {
			dispatcher: ActionDispatcher;
			filesystemHealer: FilesystemHealer;
			treeReconciler: TreeReconciler;
			state: LibrarianState;
			selfEventTracker: SelfEventTracker;
			regenerateAllCodexes: () => Promise<void>;
			generateUniqueSplitPath: (
				path: CoreSplitPath,
			) => Promise<CoreSplitPath>;
			backgroundFileService: ManagerFsAdapter;
		},
	) {}

	private async handleFileCreated(splitPath: CoreSplitPath): Promise<void> {
		const rootName = splitPath.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(splitPath.pathParts)) return;

		const healResult = healFile(splitPath, rootName);
		if (healResult.actions.length > 0) {
			this.deps.dispatcher.registerSelf(healResult.actions);
			this.deps.dispatcher.pushMany(healResult.actions);
			await this.deps.dispatcher.flushNow();
		}

		if (rootName !== LIBRARY_ROOT) return;
		if (!this.deps.state.tree) return;

		const canonical = canonicalizePath({ path: splitPath, rootName });
		if ("reason" in canonical) return;

		const parentPath = canonical.treePath.slice(0, -1);
		await this.deps.treeReconciler.reconcileSubtree(rootName, parentPath);
		await this.deps.regenerateAllCodexes();
	}

	async onFileCreated(file: TAbstractFile): Promise<void> {
		if (this.deps.selfEventTracker.pop(file.path)) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(fullPath.pathParts)) return;

		const splitPath: CoreSplitPath = {
			basename: toNodeName(fullPath.basename),
			pathParts: fullPath.pathParts,
		};

		await this.handleFileCreated(splitPath);
	}

	async onFileCreatedFromSplitPath(
		createdPath: SplitPathToFile | SplitPathToMdFile,
	): Promise<void> {
		await this.handleFileCreated(createdPath);
	}

	private async handleFileDeleted(targetPath: CoreSplitPath): Promise<void> {
		const rootName = targetPath.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(targetPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		if (!this.deps.state.tree) return;

		const canonical = canonicalizePath({ path: targetPath, rootName });
		if ("reason" in canonical) return;

		const parentPath = canonical.treePath.slice(0, -1);
		await this.deps.treeReconciler.reconcileSubtree(rootName, parentPath);
		await this.deps.regenerateAllCodexes();
	}

	async onFileRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
		const fromSelf = this.deps.selfEventTracker.pop(oldPath);
		const toSelf = this.deps.selfEventTracker.pop(file.path);
		if (fromSelf || toSelf) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const newFull = fullPathFromSystemPath(file.path);
		const oldFull = fullPathFromSystemPath(oldPath);
		const rootName = newFull.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(newFull.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		if (!this.deps.state.tree) return;

		const pathPartsChanged = !arePathPartsEqual(
			oldFull.pathParts,
			newFull.pathParts,
		);
		const basenameChanged = oldFull.basename !== newFull.basename;

		if (!basenameChanged && !pathPartsChanged) return;

		const newPath: CoreSplitPath = {
			basename: toNodeName(newFull.basename),
			pathParts: newFull.pathParts,
		};
		const oldPath: CoreSplitPath = {
			basename: toNodeName(oldFull.basename),
			pathParts: oldFull.pathParts,
		};

		const decoded = decodeBasename(newPath.basename);
		const wasPage = decoded?.kind === "page";

		if (decoded?.kind === "codex") {
			const revertAction: VaultAction = {
				payload: {
					from: newPath,
					to: oldPath,
				},
				type: VaultActionType.RenameMdFile,
			};
			this.deps.dispatcher.registerSelf([revertAction]);
			this.deps.dispatcher.push(revertAction);
			await this.deps.dispatcher.flushNow();
			return;
		}

		if (pathPartsChanged) {
			if (decoded?.kind === "page") {
				const decodedParent = decoded.treePath.slice(0, -1);
				const leafName = toNodeName(
					decodedParent[decodedParent.length - 1] ??
						decodedParent[0] ??
						"",
				);
				const targetTreePath: TreePath = [
					...newFull.pathParts.slice(1),
					leafName,
				];
				const targetPrettyPath: CoreSplitPath = {
					basename: treePathToScrollBasename.encode(targetTreePath),
					pathParts: [rootName, ...targetTreePath.slice(0, -1)],
				};

				let finalPrettyPath = targetPrettyPath;
				if (
					await this.deps.backgroundFileService.exists(
						finalPrettyPath,
					)
				) {
					finalPrettyPath =
						await this.deps.generateUniqueSplitPath(
							finalPrettyPath,
						);
				}

				const seenFolders = new Set<string>();
				const moveActions: VaultAction[] = [
					...createFolderActionsForPathParts(
						finalPrettyPath.pathParts,
						seenFolders,
					),
					{
						payload: {
							from: newPath,
							to: finalPrettyPath,
						},
						type: VaultActionType.RenameMdFile,
					},
				];

				this.deps.dispatcher.registerSelf(moveActions);
				this.deps.dispatcher.pushMany(moveActions);
				await this.deps.dispatcher.flushNow();

				this.pendingRenameRoots.add(rootName);
				this.scheduleRenameFlush();
				return;
			}

			const healResult = healFile(newPath, rootName);
			if (healResult.actions.length > 0) {
				this.deps.dispatcher.registerSelf(healResult.actions);
				this.deps.dispatcher.pushMany(healResult.actions);
				await this.deps.dispatcher.flushNow();
			}

			this.pendingRenameRoots.add(rootName);
			this.scheduleRenameFlush();
			return;
		}

		if (!decoded) {
			const healResult = healFile(newPath, rootName);
			if (healResult.actions.length > 0) {
				this.deps.dispatcher.registerSelf(healResult.actions);
				this.deps.dispatcher.pushMany(healResult.actions);
				await this.deps.dispatcher.flushNow();
			}
			this.pendingRenameRoots.add(rootName);
			this.scheduleRenameFlush();
			return;
		}

		const effectiveDecoded =
			decoded.kind === "page"
				? {
						kind: "scroll" as const,
						treePath: decoded.treePath.slice(0, -1),
					}
				: decoded;

		const canonical = computeCanonicalPath({
			authority: "basename",
			currentPath: newPath,
			decoded: effectiveDecoded,
			folderPath: [],
			rootName,
		});

		let targetPrettyPath = canonical.canonicalPath;

		if (await this.deps.backgroundFileService.exists(targetPrettyPath)) {
			targetPrettyPath =
				await this.deps.generateUniqueSplitPath(targetPrettyPath);
		}

		const seenFolders = new Set<string>();
		const moveActions: VaultAction[] = [
			...createFolderActionsForPathParts(
				targetPrettyPath.pathParts,
				seenFolders,
			),
			{
				payload: {
					from: newPath,
					to: targetPrettyPath,
				},
				type: VaultActionType.RenameMdFile,
			},
		];

		if (wasPage) {
			moveActions.push({
				payload: {
					coreSplitPath: targetPrettyPath,
					transform: (old) =>
						editOrAddMetaInfo(old, {
							fileType: "Scroll",
							status: TextStatus.NotStarted,
						}),
				},
				type: VaultActionType.ProcessMdFile,
			});
		}

		this.deps.dispatcher.registerSelf(moveActions);
		this.deps.dispatcher.pushMany(moveActions);
		await this.deps.dispatcher.flushNow();

		this.pendingRenameRoots.add(rootName);
		this.scheduleRenameFlush();
	}

	async onFileDeleted(file: TAbstractFile): Promise<void> {
		if (this.deps.selfEventTracker.pop(file.path)) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(fullPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		if (!this.deps.state.tree) return;

		const splitPath: CoreSplitPath = {
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		};

		await this.handleFileDeleted(splitPath);
	}

	async onFileDeletedFromSplitPath(targetPath: CoreSplitPath): Promise<void> {
		await this.handleFileDeleted(targetPath);
	}

	async onFileRenamedFromSplitPath(
		newPath: CoreSplitPath,
		oldPath: string,
	): Promise<void> {
		await this.onFileRenamed(
			{
				extension: "md",
				path: splitPathKey(newPath),
			} as unknown as TFile,
			oldPath,
		);
	}

	private scheduleRenameFlush(): void {
		if (this.renameDebounceTimer) {
			clearTimeout(this.renameDebounceTimer);
		}
		this.renameDebounceTimer = setTimeout(() => {
			this.renameDebounceTimer = null;
			void this.flushPendingRenames();
		}, RENAME_DEBOUNCE_MS);
	}

	private async flushPendingRenames(): Promise<void> {
		const roots = [...this.pendingRenameRoots];
		this.pendingRenameRoots.clear();

		for (const rootName of roots) {
			await this.deps.filesystemHealer.healRootFilesystem(rootName);
			await this.deps.treeReconciler.reconcileSubtree(rootName, []);
		}

		await this.deps.regenerateAllCodexes();
		await this.deps.dispatcher.flushNow();
	}
}

function arePathPartsEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((value, idx) => value === b[idx]);
}
