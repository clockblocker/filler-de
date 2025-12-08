import type { TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { fullPathFromSystemPath } from "../../../services/obsidian-services/atomic-services/pathfinder";
import {
	type VaultAction,
	VaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { TexfresserObsidianServices } from "../../../services/obsidian-services/interface";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { TextStatus } from "../../../types/common-interface/enums";
import type { ActionDispatcher } from "../action-dispatcher";
import { isInUntracked, isRootName, type RootName } from "../constants";
import { healFile } from "../filesystem/healing";
import { toNodeName, treePathToScrollBasename } from "../indexing/codecs";
import {
	canonicalizePrettyPath,
	computeCanonicalPath,
	decodeBasename,
} from "../invariants/path-canonicalizer";
import type { LibrarianState } from "../librarian-state";
import type { TreePath } from "../types";
import { createFolderActionsForPathParts } from "../utils/folder-actions";
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
			generateUniquePrettyPath: (
				prettyPath: PrettyPath,
			) => Promise<PrettyPath>;
		} & Pick<TexfresserObsidianServices, "backgroundFileService">,
	) {}

	async onFileCreated(file: TAbstractFile): Promise<void> {
		if (this.deps.selfEventTracker.pop(file.path)) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(fullPath.pathParts)) return;

		const prettyPath: PrettyPath = {
			basename: toNodeName(fullPath.basename),
			pathParts: fullPath.pathParts,
		};

		const healResult = healFile(prettyPath, rootName);
		if (healResult.actions.length > 0) {
			this.deps.dispatcher.registerSelf(healResult.actions);
			this.deps.dispatcher.pushMany(healResult.actions);
			await this.deps.dispatcher.flushNow();
		}

		if (!this.deps.state.trees[rootName]) return;

		const canonical = canonicalizePrettyPath({ prettyPath, rootName });
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
		if (!this.deps.state.trees[rootName]) return;

		const pathPartsChanged = !arePathPartsEqual(
			oldFull.pathParts,
			newFull.pathParts,
		);
		const basenameChanged = oldFull.basename !== newFull.basename;

		if (!basenameChanged && !pathPartsChanged) return;

		const prettyPath: PrettyPath = {
			basename: toNodeName(newFull.basename),
			pathParts: newFull.pathParts,
		};
		const oldPrettyPath: PrettyPath = {
			basename: toNodeName(oldFull.basename),
			pathParts: oldFull.pathParts,
		};

		const decoded = decodeBasename(prettyPath.basename);
		const wasPage = decoded?.kind === "page";

		if (decoded?.kind === "codex") {
			const revertAction: VaultAction = {
				payload: { from: prettyPath, to: oldPrettyPath },
				type: VaultActionType.RenameFile,
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
				const targetPrettyPath = {
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
						await this.deps.generateUniquePrettyPath(
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
						payload: { from: prettyPath, to: finalPrettyPath },
						type: VaultActionType.RenameFile,
					},
				];

				this.deps.dispatcher.registerSelf(moveActions);
				this.deps.dispatcher.pushMany(moveActions);
				await this.deps.dispatcher.flushNow();

				this.pendingRenameRoots.add(rootName);
				this.scheduleRenameFlush();
				return;
			}

			const healResult = healFile(prettyPath, rootName);
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
			const healResult = healFile(prettyPath, rootName);
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
			currentPrettyPath: prettyPath,
			decoded: effectiveDecoded,
			folderPath: [],
			rootName,
		});

		let targetPrettyPath = canonical.canonicalPrettyPath;

		if (await this.deps.backgroundFileService.exists(targetPrettyPath)) {
			targetPrettyPath =
				await this.deps.generateUniquePrettyPath(targetPrettyPath);
		}

		const seenFolders = new Set<string>();
		const moveActions: VaultAction[] = [
			...createFolderActionsForPathParts(
				targetPrettyPath.pathParts,
				seenFolders,
			),
			{
				payload: { from: prettyPath, to: targetPrettyPath },
				type: VaultActionType.RenameFile,
			},
		];

		if (wasPage) {
			moveActions.push({
				payload: {
					prettyPath: targetPrettyPath,
					transform: (old) =>
						editOrAddMetaInfo(old, {
							fileType: "Scroll",
							status: TextStatus.NotStarted,
						}),
				},
				type: VaultActionType.ProcessFile,
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
		if (!this.deps.state.trees[rootName]) return;

		const prettyPath: PrettyPath = {
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		};

		const canonical = canonicalizePrettyPath({ prettyPath, rootName });
		if ("reason" in canonical) return;

		const parentPath = canonical.treePath.slice(0, -1);
		await this.deps.treeReconciler.reconcileSubtree(rootName, parentPath);
		await this.deps.regenerateAllCodexes();
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
