import type { TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { fullPathFromSystemPathLegacy } from "../../../services/obsidian-services/atomic-services/pathfinder";
import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { TexfresserObsidianServices } from "../../../services/obsidian-services/interface";
import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";
import { TextStatusLegacy } from "../../../types/common-interface/enums";
import type { ActionDispatcherLegacy } from "../action-dispatcher";
import {
	isInUntrackedLegacy,
	isRootNameLegacy,
	LIBRARY_ROOTSLegacy,
	type RootNameLegacy,
} from "../constants";
import { healFileLegacy } from "../filesystem/healing";
import { toNodeNameLegacy, treePathToScrollBasename } from "../indexing/codecs";
import {
	canonicalizePrettyPathLegacy,
	computeCanonicalPath,
	decodeBasenameLegacy,
} from "../invariants/path-canonicalizer";
import type { LibrarianLegacyStateLegacy } from "../librarian-state";
import type { TreePathLegacyLegacy } from "../types";
import { createFolderActionsForPathParts } from "../utils/folder-actions";
import type { SelfEventTrackerLegacy } from "../utils/self-event-tracker";
import type { FilesystemHealerLegacy } from "./filesystem-healer";
import type { TreeReconcilerLegacy } from "./tree-reconciler";

const RENAME_DEBOUNCE_MS = 100;

export class VaultEventHandlerLegacy {
	private pendingRenameRoots = new Set<RootNameLegacy>();
	private renameDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly deps: {
			dispatcher: ActionDispatcherLegacy;
			filesystemHealer: FilesystemHealerLegacy;
			treeReconciler: TreeReconcilerLegacy;
			state: LibrarianLegacyStateLegacy;
			selfEventTracker: SelfEventTrackerLegacy;
			regenerateAllCodexes: () => Promise<void>;
			generateUniquePrettyPathLegacy: (
				prettyPath: PrettyPathLegacy,
			) => Promise<PrettyPathLegacy>;
		} & Pick<TexfresserObsidianServices, "backgroundFileService">,
	) {}

	async onFileCreated(file: TAbstractFile): Promise<void> {
		if (this.deps.selfEventTracker.pop(file.path)) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const fullPath = fullPathFromSystemPathLegacy(file.path);
		const rootName = fullPath.pathParts[0];

		if (!rootName || !isRootNameLegacy(rootName)) return;
		if (isInUntrackedLegacy(fullPath.pathParts)) return;

		const prettyPath: PrettyPathLegacy = {
			basename: toNodeNameLegacy(fullPath.basename),
			pathParts: fullPath.pathParts,
		};

		const healResult = healFileLegacy(prettyPath, rootName);
		if (healResult.actions.length > 0) {
			this.deps.dispatcher.registerSelf(healResult.actions);
			this.deps.dispatcher.pushMany(healResult.actions);
			await this.deps.dispatcher.flushNow();
		}

		if (rootName !== LIBRARY_ROOTSLegacy[0]) return;
		if (!this.deps.state.tree) return;

		const canonical = canonicalizePrettyPathLegacy({
			prettyPath,
			rootName,
		});
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

		const newFull = fullPathFromSystemPathLegacy(file.path);
		const oldFull = fullPathFromSystemPathLegacy(oldPath);
		const rootName = newFull.pathParts[0];

		if (!rootName || !isRootNameLegacy(rootName)) return;
		if (isInUntrackedLegacy(newFull.pathParts)) return;
		if (rootName !== LIBRARY_ROOTSLegacy[0]) return;
		if (!this.deps.state.tree) return;

		const pathPartsChanged = !arePathPartsEqual(
			oldFull.pathParts,
			newFull.pathParts,
		);
		const basenameChanged = oldFull.basename !== newFull.basename;

		if (!basenameChanged && !pathPartsChanged) return;

		const prettyPath: PrettyPathLegacy = {
			basename: toNodeNameLegacy(newFull.basename),
			pathParts: newFull.pathParts,
		};
		const oldPrettyPathLegacy: PrettyPathLegacy = {
			basename: toNodeNameLegacy(oldFull.basename),
			pathParts: oldFull.pathParts,
		};

		const decoded = decodeBasenameLegacy(prettyPath.basename);
		const wasPage = decoded?.kind === "page";

		if (decoded?.kind === "codex") {
			const revertAction: LegacyVaultAction = {
				payload: { from: prettyPath, to: oldPrettyPathLegacy },
				type: LegacyVaultActionType.RenameFile,
			};
			this.deps.dispatcher.registerSelf([revertAction]);
			this.deps.dispatcher.push(revertAction);
			await this.deps.dispatcher.flushNow();
			return;
		}

		if (pathPartsChanged) {
			if (decoded?.kind === "page") {
				const decodedParent = decoded.treePath.slice(0, -1);
				const leafName = toNodeNameLegacy(
					decodedParent[decodedParent.length - 1] ??
						decodedParent[0] ??
						"",
				);
				const targetTreePathLegacyLegacy: TreePathLegacyLegacy = [
					...newFull.pathParts.slice(1),
					leafName,
				];
				const targetPrettyPathLegacy = {
					basename: treePathToScrollBasename.encode(
						targetTreePathLegacyLegacy,
					),
					pathParts: [
						rootName,
						...targetTreePathLegacyLegacy.slice(0, -1),
					],
				};

				let finalPrettyPathLegacy = targetPrettyPathLegacy;
				if (
					await this.deps.backgroundFileService.exists(
						finalPrettyPathLegacy,
					)
				) {
					finalPrettyPathLegacy =
						await this.deps.generateUniquePrettyPathLegacy(
							finalPrettyPathLegacy,
						);
				}

				const seenFolders = new Set<string>();
				const moveActions: LegacyVaultAction[] = [
					...createFolderActionsForPathParts(
						finalPrettyPathLegacy.pathParts,
						seenFolders,
					),
					{
						payload: {
							from: prettyPath,
							to: finalPrettyPathLegacy,
						},
						type: LegacyVaultActionType.RenameFile,
					},
				];

				this.deps.dispatcher.registerSelf(moveActions);
				this.deps.dispatcher.pushMany(moveActions);
				await this.deps.dispatcher.flushNow();

				this.pendingRenameRoots.add(rootName);
				this.scheduleRenameFlush();
				return;
			}

			const healResult = healFileLegacy(prettyPath, rootName);
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
			const healResult = healFileLegacy(prettyPath, rootName);
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
			currentPrettyPathLegacy: prettyPath,
			decoded: effectiveDecoded,
			folderPath: [],
			rootName,
		});

		let targetPrettyPathLegacy = canonical.canonicalPrettyPathLegacy;

		if (
			await this.deps.backgroundFileService.exists(targetPrettyPathLegacy)
		) {
			targetPrettyPathLegacy =
				await this.deps.generateUniquePrettyPathLegacy(
					targetPrettyPathLegacy,
				);
		}

		const seenFolders = new Set<string>();
		const moveActions: LegacyVaultAction[] = [
			...createFolderActionsForPathParts(
				targetPrettyPathLegacy.pathParts,
				seenFolders,
			),
			{
				payload: { from: prettyPath, to: targetPrettyPathLegacy },
				type: LegacyVaultActionType.RenameFile,
			},
		];

		if (wasPage) {
			moveActions.push({
				payload: {
					prettyPath: targetPrettyPathLegacy,
					transform: (old) =>
						editOrAddMetaInfo(old, {
							fileType: "Scroll",
							status: TextStatusLegacy.NotStarted,
						}),
				},
				type: LegacyVaultActionType.ProcessFile,
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

		const fullPath = fullPathFromSystemPathLegacy(file.path);
		const rootName = fullPath.pathParts[0];

		if (!rootName || !isRootNameLegacy(rootName)) return;
		if (isInUntrackedLegacy(fullPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOTSLegacy[0]) return;
		if (!this.deps.state.tree) return;

		const prettyPath: PrettyPathLegacy = {
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		};

		const canonical = canonicalizePrettyPathLegacy({
			prettyPath,
			rootName,
		});
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
