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
import { DiffToActions } from "./diffing/diff-to-actions";
import type { NoteSnapshot } from "./diffing/note-differ";
import { noteDiffer } from "./diffing/note-differ";
import {
	pageNumberFromInt,
	toNodeName,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "./indexing/codecs";
import { prettyFilesWithReaderToLibraryFiles } from "./indexing/libraryFileAdapters";
import {
	canonicalizePrettyPath,
	isCanonical,
} from "./invariants/path-canonicalizer";
import { LibraryTree } from "./library-tree/library-tree";
import { noteDtosFromLibraryFiles } from "./pure-functions/note-dtos-from-library-file-dtos";
import { splitTextIntoP_ages } from "./text-splitter/text-splitter";
import type { LibraryFile, NoteDto, TreePath } from "./types";
import { NodeType } from "./types";

export class Librarian {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];
	trees: Record<RootName, LibraryTree>;

	private actionQueue: VaultActionQueue | null = null;
	private diffMappers: Map<RootName, DiffToActions> = new Map();
	private _skipReconciliation = false;
	private selfEventKeys: Set<string> = new Set();

	constructor({
		backgroundFileService,
		openedFileService,
		actionQueue,
	}: { actionQueue?: VaultActionQueue } & Pick<
		TexfresserObsidianServices,
		"backgroundFileService" | "openedFileService"
	>) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;
		this.actionQueue = actionQueue ?? null;

		for (const rootName of LIBRARY_ROOTS) {
			this.diffMappers.set(rootName, new DiffToActions(rootName));
		}
	}

	_setSkipReconciliation(skip: boolean): void {
		this._skipReconciliation = skip;
	}

	setActionQueue(queue: VaultActionQueue): void {
		this.actionQueue = queue;
	}

	private toSystemKey(prettyPath: PrettyPath): string {
		return [...prettyPath.pathParts, `${prettyPath.basename}.md`].join("/");
	}

	private registerSelfActions(actions: VaultAction[]): void {
		for (const action of actions) {
			switch (action.type) {
				case VaultActionType.RenameFile: {
					this.selfEventKeys.add(
						this.toSystemKey(action.payload.from),
					);
					this.selfEventKeys.add(this.toSystemKey(action.payload.to));
					break;
				}
				case VaultActionType.TrashFile:
				case VaultActionType.UpdateOrCreateFile:
				case VaultActionType.ProcessFile:
				case VaultActionType.WriteFile: {
					this.selfEventKeys.add(
						this.toSystemKey(action.payload.prettyPath),
					);
					break;
				}
				default:
					break;
			}
		}
	}

	private popSelfKey(path: string): boolean {
		const normalized = path.replace(/^[\\/]+|[\\/]+$/g, "");
		if (this.selfEventKeys.has(normalized)) {
			this.selfEventKeys.delete(normalized);
			return true;
		}
		return false;
	}

	private createFolderActionsForPathParts(
		pathParts: string[],
		seen: Set<string>,
	): VaultAction[] {
		const actions: VaultAction[] = [];

		for (let depth = 1; depth < pathParts.length; depth++) {
			const key = pathParts.slice(0, depth + 1).join("/");
			if (seen.has(key)) continue;
			seen.add(key);

			const basename = pathParts[depth] ?? "";
			const parentParts = pathParts.slice(0, depth);

			actions.push({
				payload: { prettyPath: { basename, pathParts: parentParts } },
				type: VaultActionType.UpdateOrCreateFolder,
			});
		}

		return actions;
	}

	private async healRootFilesystem(rootName: RootName): Promise<void> {
		const fileReaders =
			await this.backgroundFileService.getReadersToAllMdFilesInFolder({
				basename: rootName,
				pathParts: [],
				type: "folder",
			});

		const actions: VaultAction[] = [];
		const seenFolders = new Set<string>();
		const folderContents = new Map<
			string,
			{ hasCodex: boolean; hasNote: boolean; codexPaths: PrettyPath[] }
		>();

		for (const reader of fileReaders) {
			const prettyPath: PrettyPath = {
				basename: reader.basename,
				pathParts: reader.pathParts,
			};

			if (isInUntracked(prettyPath.pathParts)) {
				continue;
			}

			const canonical = canonicalizePrettyPath({ prettyPath, rootName });
			let targetPath: PrettyPath;

			if ("reason" in canonical) {
				targetPath = canonical.destination;
				actions.push(
					...this.createFolderActionsForPathParts(
						canonical.destination.pathParts,
						seenFolders,
					),
					{
						payload: {
							from: prettyPath,
							to: canonical.destination,
						},
						type: VaultActionType.RenameFile,
					},
				);
				continue;
			}

			if (isCanonical(prettyPath, canonical.canonicalPrettyPath)) {
				targetPath = prettyPath;
				continue;
			}

			targetPath = canonical.canonicalPrettyPath;
			actions.push(
				...this.createFolderActionsForPathParts(
					canonical.canonicalPrettyPath.pathParts,
					seenFolders,
				),
				{
					payload: {
						from: prettyPath,
						to: canonical.canonicalPrettyPath,
					},
					type: VaultActionType.RenameFile,
				},
			);
		}

		// Codex cleanup: remove codex files in folders without notes
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

		// Add meta info to notes missing it
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
			if (meta !== null) continue;

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
					canonical.treePath[canonical.treePath.length - 1] ?? "0";
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
		}

		for (const [folderKey, info] of folderContents.entries()) {
			// Skip root codex cleanup
			if (folderKey === rootName) continue;
			if (info.hasNote) continue;
			if (!info.hasCodex) continue;

			for (const codexPath of info.codexPaths) {
				actions.push({
					payload: { prettyPath: codexPath },
					type: VaultActionType.TrashFile,
				});
			}
		}

		if (actions.length === 0) {
			return;
		}

		if (!this.actionQueue) {
			return;
		}

		this.actionQueue.pushMany(actions);
		await this.actionQueue.flushNow();
	}

	// ─── Tree Initialization ──────────────────────────────────────────

	async initTrees(): Promise<void> {
		this.trees = {} as Record<RootName, LibraryTree>;
		for (const rootName of LIBRARY_ROOTS) {
			await this.healRootFilesystem(rootName);
			const notes = await this.readNotesFromFilesystem(rootName);
			this.trees[rootName] = new LibraryTree(notes, rootName);
		}

		// Regenerate all codexes to ensure sync with tree state
		await this.regenerateAllCodexes();
	}

	// ─── Reconciliation ───────────────────────────────────────────────

	private async reconcileSubtree(
		rootName: RootName,
		subtreePath: TreePath = [],
	): Promise<void> {
		const tree = this.trees[rootName];
		if (!tree) return;

		const filesystemNotes = await this.readNotesFromFilesystem(
			rootName,
			subtreePath,
		);

		// Get current notes in subtree
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

	// ─── Diff-Based Mutations ─────────────────────────────────────────

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

		const mapper = this.diffMappers.get(rootName);

		const getNode = (path: TreePath) => {
			const mbNode = tree.getMaybeNode({ path });
			if (mbNode.error) {
				return undefined;
			}
			return mbNode.data;
		};

		const actions = mapper ? mapper.mapDiffToActions(diff, getNode) : [];

		if (this.actionQueue && actions.length > 0) {
			this.actionQueue.pushMany(actions);
		}

		return { actions, result };
	}

	// ─── Filesystem Reading ───────────────────────────────────────────

	private async readLibraryFilesInFolder(
		dirBasename: string,
		pathParts: string[] = [],
	): Promise<LibraryFile[]> {
		const fileReaders =
			await this.backgroundFileService.getReadersToAllMdFilesInFolder({
				basename: dirBasename,
				pathParts,
				type: "folder",
			});

		return await prettyFilesWithReaderToLibraryFiles(fileReaders);
	}

	private async readNotesFromFilesystem(
		rootName: RootName,
		subtreePath: TreePath = [],
	): Promise<NoteDto[]> {
		const folderBasename =
			subtreePath.length > 0
				? (subtreePath[subtreePath.length - 1] ?? rootName)
				: rootName;

		const pathParts =
			subtreePath.length > 1
				? [rootName, ...subtreePath.slice(0, -1)]
				: subtreePath.length === 1
					? [rootName]
					: [];

		const libraryFiles = await this.readLibraryFilesInFolder(
			folderBasename,
			pathParts,
		);

		const trackedLibraryFiles = libraryFiles.filter(
			(file) => !isInUntracked(file.fullPath.pathParts),
		);

		return noteDtosFromLibraryFiles(trackedLibraryFiles, subtreePath);
	}

	// ─── Vault Event Handlers ─────────────────────────────────────────

	async onFileCreated(file: TAbstractFile): Promise<void> {
		if (this.popSelfKey(file.path)) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(fullPath.pathParts)) return;

		const prettyPath: PrettyPath = {
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		};

		const canonical = canonicalizePrettyPath({ prettyPath, rootName });

		if ("reason" in canonical) {
			const actions = [
				...this.createFolderActionsForPathParts(
					canonical.destination.pathParts,
					new Set<string>(),
				),
				{
					payload: {
						from: prettyPath,
						to: canonical.destination,
					},
					type: VaultActionType.RenameFile,
				},
			];

			if (this.actionQueue) {
				this.registerSelfActions(actions);
				this.actionQueue.pushMany(actions);
				await this.actionQueue.flushNow();
			}
			return;
		}

		if (!isCanonical(prettyPath, canonical.canonicalPrettyPath)) {
			const actions = [
				...this.createFolderActionsForPathParts(
					canonical.canonicalPrettyPath.pathParts,
					new Set<string>(),
				),
				{
					payload: {
						from: prettyPath,
						to: canonical.canonicalPrettyPath,
					},
					type: VaultActionType.RenameFile,
				},
			];

			if (this.actionQueue) {
				this.registerSelfActions(actions);
				this.actionQueue.pushMany(actions);
				await this.actionQueue.flushNow();
			}
		}

		if (!this.trees[rootName]) return;

		const parentPath = canonical.treePath.slice(0, -1);
		await this.reconcileSubtree(rootName, parentPath);
		await this.regenerateAllCodexes();
	}

	async onFileRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
		if (this.popSelfKey(oldPath) || this.popSelfKey(file.path)) return;
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;

		const newFull = fullPathFromSystemPath(file.path);
		const rootName = newFull.pathParts[0];

		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(newFull.pathParts)) return;
		if (!this.trees[rootName]) return;

		const newPrettyPath: PrettyPath = {
			basename: newFull.basename,
			pathParts: newFull.pathParts,
		};
		const currentPrettyPath = newPrettyPath;

		const canonical = canonicalizePrettyPath({
			prettyPath: newPrettyPath,
			rootName,
		});

		if ("reason" in canonical) {
			const actions = [
				...this.createFolderActionsForPathParts(
					canonical.destination.pathParts,
					new Set<string>(),
				),
				{
					payload: {
						from: currentPrettyPath,
						to: canonical.destination,
					},
					type: VaultActionType.RenameFile,
				},
			];
			if (this.actionQueue) {
				this.registerSelfActions(actions);
				this.actionQueue.pushMany(actions);
				await this.actionQueue.flushNow();
			}
			return;
		}

		if (!isCanonical(newPrettyPath, canonical.canonicalPrettyPath)) {
			const actions = [
				...this.createFolderActionsForPathParts(
					canonical.canonicalPrettyPath.pathParts,
					new Set<string>(),
				),
				{
					payload: {
						from: currentPrettyPath,
						to: canonical.canonicalPrettyPath,
					},
					type: VaultActionType.RenameFile,
				},
			];

			if (this.actionQueue) {
				this.registerSelfActions(actions);
				this.actionQueue.pushMany(actions);
				await this.actionQueue.flushNow();
			}
		}

		const parentPath = canonical.treePath.slice(0, -1);

		await this.reconcileSubtree(rootName, parentPath);
		await this.regenerateAllCodexes();

		if (this.actionQueue) await this.actionQueue.flushNow();
	}

	async onFileDeleted(file: TAbstractFile): Promise<void> {
		if (this.popSelfKey(file.path)) return;
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

		const parentPath = canonical.treePath.slice(0, -1);
		await this.reconcileSubtree(rootName, parentPath);
		await this.regenerateAllCodexes();
	}

	// ─── Public API ───────────────────────────────────────────────────

	logDeepLs(): void {
		for (const rootName of LIBRARY_ROOTS) {
			const tree = this.trees[rootName];
			if (!tree) continue;

			const lines: string[] = [];

			const walk = (
				node: {
					name: string;
					type: NodeType;
					children?: unknown[];
				},
				indent: string,
			): void => {
				const marker = node.type === NodeType.Section ? "📁" : "📄";
				lines.push(`${indent}${marker} ${node.name}`);

				if (node.type === NodeType.Section) {
					lines.push(`${indent}  📜 __${node.name ?? rootName}`);
					for (const child of node.children ?? []) {
						walk(
							child as {
								name: string;
								type: NodeType;
								children?: unknown[];
							},
							`${indent}  `,
						);
					}
				}
			};

			walk(tree.root, "");

			console.log(
				`[Librarian] Deep LS for ${rootName}:\n${lines.join("\n")}`,
			);
		}
	}

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

		if (this.actionQueue) {
			await this.actionQueue.flushNow();
		}

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

		const affectedTree = this.getAffectedTree(fullPath);
		if (!affectedTree) {
			logWarning({
				description: "Could not find tree for this folder.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		const content = await this.backgroundFileService.readContent({
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		});

		if (!content.trim()) {
			logWarning({
				description: "File is empty.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		const textName = toNodeName(fullPath.basename);
		const { pages, isBook } = splitTextIntoP_ages(content, textName);
		const sectionPath = fullPath.pathParts.slice(1);

		// Create notes for each page
		const notesToAdd: NoteDto[] = [];
		if (!isBook) {
			// Scroll: single note
			notesToAdd.push({
				path: [...sectionPath, textName],
				status: TextStatus.NotStarted,
			});
		} else {
			// Book: multiple notes under a section
			for (let i = 0; i < pages.length; i++) {
				notesToAdd.push({
					path: [
						...sectionPath,
						textName,
						pageNumberFromInt.encode(i),
					],
					status: TextStatus.NotStarted,
				});
			}
		}

		await this.withDiff(rootName, (tree) => tree.addNotes(notesToAdd), [
			sectionPath,
		]);

		if (this.actionQueue) {
			await this.actionQueue.flushNow();
		}

		// Write content to files
		for (let i = 0; i < pages.length; i++) {
			const pageContent = pages[i] ?? "";

			if (!isBook) {
				const scrollPath = {
					basename: treePathToScrollBasename.encode([
						...sectionPath,
						textName,
					]),
					pathParts: [rootName, ...sectionPath],
				};
				await this.backgroundFileService.replaceContent(
					scrollPath,
					pageContent,
				);
			} else {
				const fullPagePath: TreePath = [
					...sectionPath,
					textName,
					pageNumberFromInt.encode(i),
				];
				const pagePath = {
					basename: treePathToPageBasename.encode(fullPagePath),
					pathParts: [rootName, ...sectionPath, textName],
				};
				await this.backgroundFileService.replaceContent(
					pagePath,
					pageContent,
				);
			}
		}

		await this.backgroundFileService.trash({
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		});

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
			(tree) => {
				return tree.setStatus({ path, status });
			},
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

	/**
	 * Regenerate all codex files from current tree state.
	 * Use when codexes are out of sync (e.g., after migration).
	 */
	async regenerateAllCodexes(): Promise<void> {
		for (const rootName of LIBRARY_ROOTS) {
			const tree = this.trees[rootName];
			if (!tree) continue;

			const mapper = this.diffMappers.get(rootName);
			if (!mapper) continue;

			const getNode = (path: TreePath) => {
				const mbNode = tree.getMaybeNode({ path });
				return mbNode.error ? undefined : mbNode.data;
			};

			const sectionPaths = tree.getAllSectionPaths();
			const actions = mapper.regenerateAllCodexes(sectionPaths, getNode);

			if (this.actionQueue && actions.length > 0) {
				this.actionQueue.pushMany(actions);
			}
		}

		if (this.actionQueue) {
			await this.actionQueue.flushNow();
		}
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
