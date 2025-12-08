import type { TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import { editOrAddMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import { fullPathFromSystemPath } from "../../services/obsidian-services/atomic-services/pathfinder";
import {
	type VaultAction,
	VaultActionType,
} from "../../services/obsidian-services/file-services/background/background-vault-actions";
import type { VaultActionQueue } from "../../services/obsidian-services/file-services/vault-action-queue";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import type { PrettyPath } from "../../types/common-interface/dtos";
import { TextStatus } from "../../types/common-interface/enums";
import { ActionDispatcher } from "./action-dispatcher";
import {
	isInUntracked,
	isRootName,
	LIBRARY_ROOTS,
	type RootName,
} from "./constants";
import type { NoteSnapshot } from "./diffing/note-differ";
import { regenerateCodexActions } from "./diffing/tree-diff-applier";
import { healFile } from "./filesystem/healing";
import { toNodeName, treePathToScrollBasename } from "./indexing/codecs";
import {
	canonicalizePrettyPath,
	computeCanonicalPath,
	decodeBasename,
} from "./invariants/path-canonicalizer";
import { LibrarianState } from "./librarian-state";
import type { LibraryTree } from "./library-tree/library-tree";
import { FilesystemHealer } from "./orchestration/filesystem-healer";
import { NoteOperations } from "./orchestration/note-operations";
import { TreeReconciler } from "./orchestration/tree-reconciler";
import type { NoteDto, TreePath } from "./types";
import { createFolderActionsForPathParts } from "./utils/folder-actions";
import { SelfEventTracker } from "./utils/self-event-tracker";

const RENAME_DEBOUNCE_MS = 100;

export class Librarian {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];
	trees: Record<RootName, LibraryTree>;

	private dispatcher: ActionDispatcher;
	private state: LibrarianState;
	private selfEventTracker = new SelfEventTracker();
	private filesystemHealer: FilesystemHealer;
	private treeReconciler: TreeReconciler;
	private noteOperations: NoteOperations;

	// Debounce state for rename events (folder moves trigger N events)
	private pendingRenameRoots = new Set<RootName>();
	private renameDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor({
		backgroundFileService,
		openedFileService,
		actionQueue,
	}: { actionQueue: VaultActionQueue } & Pick<
		TexfresserObsidianServices,
		"backgroundFileService" | "openedFileService"
	>) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;
		this.state = new LibrarianState();
		this.dispatcher = new ActionDispatcher(
			actionQueue,
			this.selfEventTracker,
		);
		this.filesystemHealer = new FilesystemHealer({
			backgroundFileService,
			dispatcher: this.dispatcher,
		});
		this.treeReconciler = new TreeReconciler({
			backgroundFileService,
			dispatcher: this.dispatcher,
			filesystemHealer: this.filesystemHealer,
			state: this.state,
		});
		this.noteOperations = new NoteOperations({
			backgroundFileService,
			dispatcher: this.dispatcher,
			generateUniquePrettyPath: (p) => this.generateUniquePrettyPath(p),
			openedFileService,
			regenerateAllCodexes: () => this.regenerateAllCodexes(),
			state: this.state,
			treeReconciler: this.treeReconciler,
		});
		this.trees = this.state.trees;
	}

	_setSkipReconciliation(skip: boolean): void {
		this.state.skipReconciliation = skip;
	}

	// ─── Tree Initialization ──────────────────────────────────────────

	async initTrees(): Promise<void> {
		await this.treeReconciler.initTrees();
		this.trees = this.state.trees;
		await this.regenerateAllCodexes();
	}

	// ─── Reconciliation (Layer 2) ─────────────────────────────────────

	private async reconcileSubtree(
		rootName: RootName,
		subtreePath: TreePath = [],
	): Promise<void> {
		await this.treeReconciler.reconcileSubtree(rootName, subtreePath);
	}

	// ─── Diff-Based Mutations (Layer 3) ───────────────────────────────

	private async withDiff<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
		affectedPaths: TreePath[],
	): Promise<{ actions: VaultAction[]; result: T }> {
		return this.treeReconciler.withDiff(rootName, mutation, affectedPaths);
	}

	private withDiffSync<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
	): { actions: VaultAction[]; result: T } {
		return this.treeReconciler.withDiffSync(rootName, mutation);
	}

	// ─── Vault Event Handlers ─────────────────────────────────────────

	async onFileCreated(file: TAbstractFile): Promise<void> {
		if (this.selfEventTracker.pop(file.path)) return;
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

		// Layer 1: Heal filesystem
		const healResult = healFile(prettyPath, rootName);
		if (healResult.actions.length > 0) {
			this.dispatcher.registerSelf(healResult.actions);
			this.dispatcher.pushMany(healResult.actions);
			await this.dispatcher.flushNow();
		}

		if (!this.trees[rootName]) return;

		// Layer 2: Reconcile tree
		const canonical = canonicalizePrettyPath({ prettyPath, rootName });
		if ("reason" in canonical) return;

		const parentPath = canonical.treePath.slice(0, -1);
		await this.reconcileSubtree(rootName, parentPath);

		// Layer 3: Update codexes
		await this.regenerateAllCodexes();
	}

	async onFileRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
		const fromSelf = this.selfEventTracker.pop(oldPath);
		const toSelf = this.selfEventTracker.pop(file.path);
		if (fromSelf || toSelf) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const newFull = fullPathFromSystemPath(file.path);
		const oldFull = fullPathFromSystemPath(oldPath);
		const rootName = newFull.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(newFull.pathParts)) return;
		if (!this.trees[rootName]) return;

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
			this.dispatcher.registerSelf([revertAction]);
			this.dispatcher.push(revertAction);
			await this.dispatcher.flushNow();
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
				if (await this.backgroundFileService.exists(finalPrettyPath)) {
					finalPrettyPath =
						await this.generateUniquePrettyPath(finalPrettyPath);
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

				this.dispatcher.registerSelf(moveActions);
				this.dispatcher.pushMany(moveActions);
				await this.dispatcher.flushNow();

				this.pendingRenameRoots.add(rootName);
				this.scheduleRenameFlush();
				return;
			}

			// Layer 1: Immediate per-file heal (fixes basename)
			const healResult = healFile(prettyPath, rootName);
			if (healResult.actions.length > 0) {
				this.dispatcher.registerSelf(healResult.actions);
				this.dispatcher.pushMany(healResult.actions);
				await this.dispatcher.flushNow();
			}

			this.pendingRenameRoots.add(rootName);
			this.scheduleRenameFlush();
			return;
		}

		// Basename-only branch: basename is authoritative
		if (!decoded) {
			const healResult = healFile(prettyPath, rootName);
			if (healResult.actions.length > 0) {
				this.dispatcher.registerSelf(healResult.actions);
				this.dispatcher.pushMany(healResult.actions);
				await this.dispatcher.flushNow();
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

		if (await this.backgroundFileService.exists(targetPrettyPath)) {
			targetPrettyPath =
				await this.generateUniquePrettyPath(targetPrettyPath);
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

		this.dispatcher.registerSelf(moveActions);
		this.dispatcher.pushMany(moveActions);
		await this.dispatcher.flushNow();

		this.pendingRenameRoots.add(rootName);
		this.scheduleRenameFlush();
	}

	/**
	 * Schedule debounced flush for pending renames.
	 * Folder moves trigger N rename events — we batch them.
	 */
	private scheduleRenameFlush(): void {
		if (this.renameDebounceTimer) {
			clearTimeout(this.renameDebounceTimer);
		}
		this.renameDebounceTimer = setTimeout(() => {
			this.renameDebounceTimer = null;
			void this.flushPendingRenames();
		}, RENAME_DEBOUNCE_MS);
	}

	/**
	 * Run full pipeline (heal → tree → codex) for all pending roots.
	 */
	private async flushPendingRenames(): Promise<void> {
		const roots = [...this.pendingRenameRoots];
		this.pendingRenameRoots.clear();

		for (const rootName of roots) {
			// Layer 1+2: Full filesystem heal + tree reconcile
			await this.filesystemHealer.healRootFilesystem(rootName);

			// Reconcile entire root (folder moves may affect multiple subtrees)
			await this.reconcileSubtree(rootName, []);
		}

		// Layer 3: Update all codexes
		await this.regenerateAllCodexes();
		await this.dispatcher.flushNow();
	}

	async onFileDeleted(file: TAbstractFile): Promise<void> {
		if (this.selfEventTracker.pop(file.path)) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(fullPath.pathParts)) return;
		if (!this.trees[rootName]) return;

		const prettyPath: PrettyPath = {
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		};

		const canonical = canonicalizePrettyPath({ prettyPath, rootName });
		if ("reason" in canonical) return;

		// Layer 2: Reconcile tree
		const parentPath = canonical.treePath.slice(0, -1);
		await this.reconcileSubtree(rootName, parentPath);

		// Layer 3: Update codexes
		await this.regenerateAllCodexes();
	}

	// ─── Business Operations ──────────────────────────────────────────

	async createNewNoteInCurrentFolder(): Promise<void> {
		await this.noteOperations.createNewNoteInCurrentFolder();
	}

	async makeNoteAText(): Promise<boolean> {
		return this.noteOperations.makeNoteAText();
	}

	isInLibraryFolder(file: TFile): boolean {
		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];
		return !!rootName && isRootName(rootName);
	}

	async setStatus(
		rootName: RootName,
		path: TreePath,
		status: "Done" | "NotStarted",
	): Promise<void> {
		await this.noteOperations.setStatus(rootName, path, status);
	}

	async addNotes(rootName: RootName, notes: NoteDto[]): Promise<void> {
		await this.noteOperations.addNotes(rootName, notes);
	}

	async deleteNotes(rootName: RootName, paths: TreePath[]): Promise<void> {
		await this.noteOperations.deleteNotes(rootName, paths);
	}

	getSnapshot(rootName: RootName): NoteSnapshot | null {
		return this.treeReconciler.getSnapshot(rootName);
	}

	async regenerateAllCodexes(): Promise<void> {
		for (const rootName of LIBRARY_ROOTS) {
			const tree = this.trees[rootName];
			if (!tree) continue;

			const getNode = (path: TreePath) => {
				const mbNode = tree.getMaybeNode({ path });
				return mbNode.error ? undefined : mbNode.data;
			};

			const sectionPaths = tree.getAllSectionPaths();
			const actions = regenerateCodexActions(
				sectionPaths,
				rootName,
				getNode,
			);

			if (actions.length > 0) {
				this.dispatcher.pushMany(actions);
			}
		}

		await this.dispatcher.flushNow();
	}

	// ─── Private Helpers ──────────────────────────────────────────────

	private async generateUniquePrettyPath(
		prettyPath: PrettyPath,
	): Promise<PrettyPath> {
		let candidate = prettyPath;
		let counter = 1;

		while (await this.backgroundFileService.exists(candidate)) {
			candidate = {
				...prettyPath,
				basename: `${prettyPath.basename}_${counter}`,
			};
			counter += 1;
		}

		return candidate;
	}
}

function arePathPartsEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((value, idx) => value === b[idx]);
}
