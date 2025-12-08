import type { TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from "../../services/dto-services/meta-info-manager/interface";
import type { FullPath } from "../../services/obsidian-services/atomic-services/pathfinder";
import { fullPathFromSystemPath } from "../../services/obsidian-services/atomic-services/pathfinder";
import {
	type VaultAction,
	VaultActionType,
} from "../../services/obsidian-services/file-services/background/background-vault-actions";
import type { VaultActionQueue } from "../../services/obsidian-services/file-services/vault-action-queue";
import { logWarning } from "../../services/obsidian-services/helpers/issue-handlers";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import type { PrettyPath } from "../../types/common-interface/dtos";
import { TextStatus } from "../../types/common-interface/enums";
import {
	isInUntracked,
	isRootName,
	LIBRARY_ROOTS,
	type RootName,
} from "./constants";
import { type NoteSnapshot, noteDiffer } from "./diffing/note-differ";
import {
	mapDiffToActions,
	regenerateCodexActions,
} from "./diffing/tree-diff-applier";
import { healFile } from "./filesystem/healing";
import { readNoteDtos } from "./filesystem/library-reader";
import {
	pageNumberFromInt,
	toNodeName,
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "./indexing/codecs";
import {
	canonicalizePrettyPath,
	computeCanonicalPath,
	decodeBasename,
} from "./invariants/path-canonicalizer";
import { LibraryTree } from "./library-tree/library-tree";
import { splitTextIntoPages } from "./text-splitter/text-splitter";
import type { NoteDto, TreePath } from "./types";
import { createFolderActionsForPathParts } from "./utils/folder-actions";
import { SelfEventTracker } from "./utils/self-event-tracker";

const RENAME_DEBOUNCE_MS = 100;

export class Librarian {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];
	trees: Record<RootName, LibraryTree>;

	private actionQueue: VaultActionQueue;
	private _skipReconciliation = false;
	private selfEventTracker = new SelfEventTracker();

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
		this.actionQueue = actionQueue;
	}

	_setSkipReconciliation(skip: boolean): void {
		this._skipReconciliation = skip;
	}

	// ─── Filesystem Healing (Layer 1) ────────────────────────────────────

	private async healRootFilesystem(rootName: RootName): Promise<void> {
		const fileReaders =
			await this.backgroundFileService.getReadersToAllMdFilesInFolder({
				basename: rootName,
				pathParts: [],
				type: "folder",
			});

		const actions: VaultAction[] = [];
		const seenFolders = new Set<string>();

		// Layer 1: Heal file paths
		for (const reader of fileReaders) {
			const prettyPath: PrettyPath = {
				basename: reader.basename,
				pathParts: reader.pathParts,
			};
			if (isInUntracked(prettyPath.pathParts)) continue;
			const healResult = healFile(prettyPath, rootName, seenFolders);
			actions.push(...healResult.actions);
		}

		// Initialize meta-info for files missing it
		const metaActions = await this.initializeMetaInfo(
			fileReaders,
			rootName,
		);
		actions.push(...metaActions);

		// Cleanup orphan folders
		const cleanupActions = this.cleanupOrphanFolders(fileReaders, rootName);
		actions.push(...cleanupActions);

		if (actions.length === 0) return;

		this.selfEventTracker.register(actions);
		this.actionQueue.pushMany(actions);
		await this.actionQueue.flushNow();
	}

	/**
	 * Initialize meta-info for notes missing it.
	 * Async — needs to read file contents.
	 */
	private async initializeMetaInfo(
		fileReaders: Array<PrettyPath & { readContent: () => Promise<string> }>,
		rootName: RootName,
	): Promise<VaultAction[]> {
		const actions: VaultAction[] = [];

		for (const reader of fileReaders) {
			const prettyPath: PrettyPath = {
				basename: reader.basename,
				pathParts: reader.pathParts,
			};
			if (isInUntracked(prettyPath.pathParts)) continue;

			const canonical = canonicalizePrettyPath({ prettyPath, rootName });
			if ("reason" in canonical) continue;

			const kind = canonical.kind;
			if (kind === "codex") continue;

			const content = await reader.readContent();
			const meta = extractMetaInfo(content);
			if (meta === null) {
				if (kind === "scroll") {
					actions.push({
						payload: {
							prettyPath,
							transform: (old) =>
								editOrAddMetaInfo(old, {
									fileType: "Scroll",
									status: TextStatus.NotStarted,
								}),
						},
						type: VaultActionType.ProcessFile,
					});
				} else if (kind === "page") {
					const pageStr =
						canonical.treePath[canonical.treePath.length - 1] ??
						"0";
					const idx = Number(pageStr);
					actions.push({
						payload: {
							prettyPath,
							transform: (old) =>
								editOrAddMetaInfo(old, {
									fileType: "Page",
									index: Number.isFinite(idx) ? idx : 0,
									status: TextStatus.NotStarted,
								}),
						},
						type: VaultActionType.ProcessFile,
					});
				}
			} else if (kind !== "page" && meta.fileType === "Page") {
				actions.push({
					payload: {
						prettyPath,
						transform: (old) =>
							editOrAddMetaInfo(old, {
								fileType: "Scroll",
								status: meta.status ?? TextStatus.NotStarted,
							}),
					},
					type: VaultActionType.ProcessFile,
				});
			}
		}

		return actions;
	}

	/**
	 * Cleanup orphan folders (folders with only codex, no notes).
	 * Pure — no async, operates on file list.
	 */
	private cleanupOrphanFolders(
		fileReaders: Array<PrettyPath>,
		rootName: RootName,
	): VaultAction[] {
		// Build folder contents map
		const folderContents = new Map<
			string,
			{ hasCodex: boolean; hasNote: boolean; codexPaths: PrettyPath[] }
		>();

		for (const reader of fileReaders) {
			const prettyPath: PrettyPath = {
				basename: reader.basename,
				pathParts: reader.pathParts,
			};

			if (isInUntracked(prettyPath.pathParts)) continue;

			const canonical = canonicalizePrettyPath({ prettyPath, rootName });
			const targetPath =
				"reason" in canonical
					? canonical.destination
					: canonical.canonicalPrettyPath;

			const folderKey = targetPath.pathParts.join("/");
			const entry = folderContents.get(folderKey) ?? {
				codexPaths: [],
				hasCodex: false,
				hasNote: false,
			};

			const isCodex = targetPath.basename.startsWith("__");
			if (isCodex) {
				entry.hasCodex = true;
				entry.codexPaths.push(targetPath);
			} else {
				entry.hasNote = true;
			}
			folderContents.set(folderKey, entry);
		}

		// Propagate note presence to ancestor folders
		for (const [folderKey, info] of folderContents.entries()) {
			if (!info.hasNote) continue;
			const parts = folderKey.split("/").filter(Boolean);
			for (let i = 1; i <= parts.length; i++) {
				const ancestorKey = parts.slice(0, i).join("/");
				const ancestorEntry = folderContents.get(ancestorKey) ?? {
					codexPaths: [],
					hasCodex: false,
					hasNote: false,
				};
				ancestorEntry.hasNote = true;
				folderContents.set(ancestorKey, ancestorEntry);
			}
		}

		// Generate cleanup actions
		const actions: VaultAction[] = [];

		for (const [folderKey, info] of folderContents.entries()) {
			if (folderKey === rootName) continue;
			if (info.hasNote) continue;

			const parts = folderKey.split("/").filter(Boolean);
			if (parts.length === 0) continue;
			if (isInUntracked(parts)) continue;

			const basename = parts[parts.length - 1] ?? "";
			const pathParts = parts.slice(0, -1);

			for (const codexPath of info.codexPaths) {
				actions.push({
					payload: { prettyPath: codexPath },
					type: VaultActionType.TrashFile,
				});
			}

			actions.push({
				payload: { prettyPath: { basename, pathParts } },
				type: VaultActionType.TrashFolder,
			});
		}

		return actions;
	}

	// ─── Tree Initialization ──────────────────────────────────────────

	async initTrees(): Promise<void> {
		this.trees = {} as Record<RootName, LibraryTree>;
		for (const rootName of LIBRARY_ROOTS) {
			await this.healRootFilesystem(rootName);
			const notes = await readNoteDtos(
				this.backgroundFileService,
				rootName,
			);
			this.trees[rootName] = new LibraryTree(notes, rootName);
		}

		await this.regenerateAllCodexes();
	}

	// ─── Reconciliation (Layer 2) ─────────────────────────────────────

	private async reconcileSubtree(
		rootName: RootName,
		subtreePath: TreePath = [],
	): Promise<void> {
		const tree = this.trees[rootName];
		if (!tree) return;

		const filesystemNotes = await readNoteDtos(
			this.backgroundFileService,
			rootName,
			subtreePath,
		);

		const currentNotes = tree.getNotes(subtreePath);

		// Delete notes not in filesystem
		const fsNoteKeys = new Set(
			filesystemNotes.map((n) => n.path.join("/")),
		);
		const notesToDelete = currentNotes.filter(
			(n) => !fsNoteKeys.has(n.path.join("/")),
		);
		if (notesToDelete.length > 0) {
			tree.deleteNotes(notesToDelete.map((n) => n.path));
		}

		// Add/update notes from filesystem
		const currentNoteMap = new Map(
			currentNotes.map((n) => [n.path.join("/"), n]),
		);
		const notesToAdd = filesystemNotes.filter((n) => {
			const existing = currentNoteMap.get(n.path.join("/"));
			return !existing || existing.status !== n.status;
		});
		if (notesToAdd.length > 0) {
			tree.addNotes(notesToAdd);
		}
	}

	// ─── Diff-Based Mutations (Layer 3) ───────────────────────────────

	private async withDiff<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
		affectedPaths?: TreePath[],
	): Promise<{ actions: VaultAction[]; result: T }> {
		if (
			!this._skipReconciliation &&
			affectedPaths &&
			affectedPaths.length > 0
		) {
			for (const path of affectedPaths) {
				await this.reconcileSubtree(rootName, path);
			}
		}

		return this.withDiffSync(rootName, mutation);
	}

	private withDiffSync<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
	): { actions: VaultAction[]; result: T } {
		const tree = this.trees[rootName];
		if (!tree) {
			throw new Error(`Tree not found for root: ${rootName}`);
		}

		const before = tree.snapshot();
		const result = mutation(tree);
		const after = tree.snapshot();

		const diff = noteDiffer.diff(before, after);

		const getNode = (path: TreePath) => {
			const mbNode = tree.getMaybeNode({ path });
			return mbNode.error ? undefined : mbNode.data;
		};

		const actions = mapDiffToActions(diff, rootName, getNode);

		if (actions.length > 0) {
			this.actionQueue.pushMany(actions);
		}

		return { actions, result };
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
			this.selfEventTracker.register(healResult.actions);
			this.actionQueue.pushMany(healResult.actions);
			await this.actionQueue.flushNow();
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
			this.selfEventTracker.register([revertAction]);
			this.actionQueue.push(revertAction);
			await this.actionQueue.flushNow();
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

				this.selfEventTracker.register(moveActions);
				this.actionQueue.pushMany(moveActions);
				await this.actionQueue.flushNow();

				this.pendingRenameRoots.add(rootName);
				this.scheduleRenameFlush();
				return;
			}

			// Layer 1: Immediate per-file heal (fixes basename)
			const healResult = healFile(prettyPath, rootName);
			if (healResult.actions.length > 0) {
				this.selfEventTracker.register(healResult.actions);
				this.actionQueue.pushMany(healResult.actions);
				await this.actionQueue.flushNow();
			}

			this.pendingRenameRoots.add(rootName);
			this.scheduleRenameFlush();
			return;
		}

		// Basename-only branch: basename is authoritative
		if (!decoded) {
			const healResult = healFile(prettyPath, rootName);
			if (healResult.actions.length > 0) {
				this.selfEventTracker.register(healResult.actions);
				this.actionQueue.pushMany(healResult.actions);
				await this.actionQueue.flushNow();
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

		this.selfEventTracker.register(moveActions);
		this.actionQueue.pushMany(moveActions);
		await this.actionQueue.flushNow();

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
			await this.healRootFilesystem(rootName);

			// Reconcile entire root (folder moves may affect multiple subtrees)
			await this.reconcileSubtree(rootName, []);
		}

		// Layer 3: Update all codexes
		await this.regenerateAllCodexes();
		await this.actionQueue.flushNow();
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
		const pwd = await this.openedFileService.pwd();

		if (Object.keys(this.trees).length === 0) {
			await this.initTrees();
		}

		const treePathToPwd = treePathFromFullPath(pwd);
		const rootName = pwd.pathParts[0] as RootName | undefined;
		const affectedTree = this.getAffectedTree(pwd);

		if (!affectedTree || !rootName) return;

		const nearestSection = affectedTree.getNearestSection(treePathToPwd);
		const newNoteName = this.generateUniqueNoteName(nearestSection);
		const sectionPath = this.getPathFromSection(
			nearestSection,
			affectedTree,
		);
		const notePath: TreePath = [...sectionPath, newNoteName];

		await this.withDiff(
			rootName,
			(tree) =>
				tree.addNotes([
					{ path: notePath, status: TextStatus.NotStarted },
				]),
			[sectionPath],
		);

		await this.actionQueue.flushNow();

		await this.openedFileService.cd({
			basename: treePathToScrollBasename.encode(notePath),
			pathParts: [rootName, ...sectionPath],
		});
	}

	async makeNoteAText(): Promise<boolean> {
		const app = this.openedFileService.getApp();
		const currentFile = app.workspace.getActiveFile();

		if (!currentFile) {
			logWarning({
				description: "No file is currently open.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		const fullPath = fullPathFromSystemPath(currentFile.path);
		const rootName = fullPath.pathParts[0];

		if (!rootName || !isRootName(rootName)) {
			logWarning({
				description: `File must be in a Library folder. Found: ${rootName}`,
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		if (!this.trees[rootName]) {
			logWarning({
				description: "Tree not initialized for this root.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		// 1) Read content
		const originalPrettyPath: PrettyPath = {
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		};
		const content =
			await this.backgroundFileService.readContent(originalPrettyPath);

		if (!content.trim()) {
			logWarning({
				description: "File is empty.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		// Parse text name from basename
		const rawTextName = toNodeName(fullPath.basename);
		const sectionPath = fullPath.pathParts.slice(1);
		const lastFolder = sectionPath[sectionPath.length - 1];
		const textName =
			lastFolder && rawTextName.endsWith(`-${lastFolder}`)
				? rawTextName.slice(
						0,
						rawTextName.length - lastFolder.length - 1,
					)
				: rawTextName;

		// Split text into pages
		const { pages, isBook } = splitTextIntoPages(content, textName);

		const seenFolders = new Set<string>();
		let destinationPrettyPath: PrettyPath;

		if (!isBook) {
			// Single page → scroll
			// Phase 1: Move original to Unmarked_FILE
			const unmarkedBasename = `Unmarked_${fullPath.basename}`;
			let unmarkedPrettyPath: PrettyPath = {
				basename: unmarkedBasename,
				pathParts: originalPrettyPath.pathParts,
			};
			if (await this.backgroundFileService.exists(unmarkedPrettyPath)) {
				unmarkedPrettyPath =
					await this.generateUniquePrettyPath(unmarkedPrettyPath);
			}

			const renameAction: VaultAction = {
				payload: { from: originalPrettyPath, to: unmarkedPrettyPath },
				type: VaultActionType.RenameFile,
			};
			this.selfEventTracker.register([renameAction]);
			this.actionQueue.push(renameAction);
			await this.actionQueue.flushNow();

			// Phase 2: Create new scroll with content
			const scrollTreePath: TreePath = [...sectionPath, textName];
			const scrollPrettyPath: PrettyPath = {
				basename: treePathToScrollBasename.encode(scrollTreePath),
				pathParts: [rootName, ...sectionPath],
			};

			const createActions: VaultAction[] = [
				...createFolderActionsForPathParts(
					scrollPrettyPath.pathParts,
					seenFolders,
				),
				{
					payload: {
						content: editOrAddMetaInfo(pages[0] ?? "", {
							fileType: "Scroll",
							status: TextStatus.NotStarted,
						}),
						prettyPath: scrollPrettyPath,
					},
					type: VaultActionType.UpdateOrCreateFile,
				},
			];

			this.selfEventTracker.register(createActions);
			this.actionQueue.pushMany(createActions);
			await this.actionQueue.flushNow();

			// Update tree state
			this.trees[rootName]?.addNotes([
				{ path: scrollTreePath, status: TextStatus.NotStarted },
			]);

			// Regenerate codexes for scroll case
			await this.regenerateAllCodexes();

			destinationPrettyPath = scrollPrettyPath;
		} else {
			// Multiple pages → book
			// Phase 1: Create folder + move original to FILE/Unmarked-FILE
			const bookFolderPathParts = [rootName, ...sectionPath, textName];

			const phase1Actions: VaultAction[] = [
				...createFolderActionsForPathParts(
					bookFolderPathParts,
					seenFolders,
				),
			];

			const unmarkedBasename = `Unmarked-${fullPath.basename}`;
			let unmarkedPrettyPath: PrettyPath = {
				basename: unmarkedBasename,
				pathParts: bookFolderPathParts,
			};
			if (await this.backgroundFileService.exists(unmarkedPrettyPath)) {
				unmarkedPrettyPath =
					await this.generateUniquePrettyPath(unmarkedPrettyPath);
			}

			phase1Actions.push({
				payload: { from: originalPrettyPath, to: unmarkedPrettyPath },
				type: VaultActionType.RenameFile,
			});

			this.selfEventTracker.register(phase1Actions);
			this.actionQueue.pushMany(phase1Actions);
			await this.actionQueue.flushNow();

			// Phase 2: Create page files directly with content+meta
			const phase2Actions: VaultAction[] = [];

			for (let i = 0; i < pages.length; i++) {
				const pageTreePath: TreePath = [
					...sectionPath,
					textName,
					pageNumberFromInt.encode(i),
				];
				const pagePrettyPath: PrettyPath = {
					basename: treePathToPageBasename.encode(pageTreePath),
					pathParts: bookFolderPathParts,
				};

				phase2Actions.push({
					payload: {
						content: editOrAddMetaInfo(pages[i] ?? "", {
							fileType: "Page",
							index: i,
							status: TextStatus.NotStarted,
						}),
						prettyPath: pagePrettyPath,
					},
					type: VaultActionType.UpdateOrCreateFile,
				});
			}

			this.selfEventTracker.register(phase2Actions);
			this.actionQueue.pushMany(phase2Actions);
			await this.actionQueue.flushNow();

			// CD to codex
			const bookSectionPath: TreePath = [...sectionPath, textName];
			destinationPrettyPath = {
				basename: treePathToCodexBasename.encode(bookSectionPath),
				pathParts: bookFolderPathParts,
			};

			// Reconcile tree from filesystem to pick up new pages
			await this.reconcileSubtree(rootName, bookSectionPath);

			// Generate codex for the new book section
			const tree = this.trees[rootName];
			if (tree) {
				const getNode = (path: TreePath) => {
					const mbNode = tree.getMaybeNode({ path });
					return mbNode.error ? undefined : mbNode.data;
				};
				const codexActions = regenerateCodexActions(
					[bookSectionPath],
					rootName,
					getNode,
				);
				this.selfEventTracker.register(codexActions);
				this.actionQueue.pushMany(codexActions);
				await this.actionQueue.flushNow();
			}
		}

		// CD to destination
		await this.openedFileService.cd(destinationPrettyPath);

		return true;
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
		const parentPath = path.slice(0, -1);

		await this.withDiff(
			rootName,
			(tree) => tree.setStatus({ path, status }),
			parentPath.length > 0 ? [parentPath] : [],
		);
	}

	async addNotes(rootName: RootName, notes: NoteDto[]): Promise<void> {
		const parentPaths = [
			...new Set(notes.map((n) => n.path.slice(0, -1).join("/"))),
		]
			.map((p) => (p ? (p.split("/") as TreePath) : []))
			.filter((p) => p.length > 0);

		await this.withDiff(
			rootName,
			(tree) => tree.addNotes(notes),
			parentPaths,
		);
	}

	async deleteNotes(rootName: RootName, paths: TreePath[]): Promise<void> {
		const parentPaths = [
			...new Set(paths.map((p) => p.slice(0, -1).join("/"))),
		]
			.map((p) => (p ? (p.split("/") as TreePath) : []))
			.filter((p) => p.length > 0);

		await this.withDiff(
			rootName,
			(tree) => tree.deleteNotes(paths),
			parentPaths,
		);
	}

	getSnapshot(rootName: RootName): NoteSnapshot | null {
		const tree = this.trees[rootName];
		return tree ? tree.snapshot() : null;
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
				this.actionQueue.pushMany(actions);
			}
		}

		await this.actionQueue.flushNow();
	}

	// ─── Private Helpers ──────────────────────────────────────────────

	private generateUniqueNoteName(section: {
		children: Array<{ name: string }>;
	}): string {
		const baseName = "New_Note";
		const existingNames = new Set(
			section.children
				.filter((child) => child.name.startsWith(baseName))
				.map((child) => child.name),
		);

		if (!existingNames.has(baseName)) return baseName;

		let counter = 1;
		let candidate = `${baseName}_${counter}`;
		while (existingNames.has(candidate)) {
			counter++;
			candidate = `${baseName}_${counter}`;
		}

		return candidate;
	}

	private getPathFromSection(
		section: {
			name: string;
			parent: { name: string; parent: unknown } | null;
		},
		tree: LibraryTree,
	): TreePath {
		const path: TreePath = [];
		let current = section;

		while (current && current !== tree.root) {
			path.unshift(current.name);
			if (!current.parent) break;
			// Type assertion needed due to recursive type
			current = current.parent as typeof section;
		}

		return path;
	}

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

	private getAffectedTree(path: FullPath): LibraryTree | null;
	private getAffectedTree(path: string): LibraryTree | null;
	private getAffectedTree(path: FullPath | string): LibraryTree | null {
		const fullPath =
			typeof path === "string" ? fullPathFromSystemPath(path) : path;
		const rootName = fullPath.pathParts[0] ?? "";
		return this.trees[rootName] ?? null;
	}
}

function treePathFromFullPath(fullPath: FullPath): TreePath {
	return [...fullPath.pathParts.slice(1), fullPath.basename];
}

function arePathPartsEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((value, idx) => value === b[idx]);
}
