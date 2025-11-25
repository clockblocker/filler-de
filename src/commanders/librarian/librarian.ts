import type { App, TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import { editOrAddMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import type { BackgroundVaultAction } from "../../services/obsidian-services/file-services/background/background-vault-actions";
import {
	splitPathFromSystemPath,
	systemPathFromSplitPath,
} from "../../services/obsidian-services/file-services/pathfinder";
import type { SplitPath } from "../../services/obsidian-services/file-services/types";
import type { VaultActionQueue } from "../../services/obsidian-services/file-services/background/vault-action-queue";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import { TextStatus } from "../../types/common-interface/enums";
import { DiffToActionsMapper } from "./diffing/diff-to-actions";
import { treeDiffer } from "./diffing/tree-differ";
import type { TreeSnapshot } from "./diffing/types";
import {
	getLibraryFileToFileFromNode,
	getTreePathFromLibraryFile,
	prettyFilesWithReaderToLibraryFileDtos,
} from "./indexing/libraryFileAdapters";
import { makeTextsFromTree } from "./library-tree/helpers/serialization";
import { LibraryTree } from "./library-tree/library-tree";
import { getTreePathFromNode } from "./pure-functions/node";
import type { LibraryFileDto, TextDto, TreePath } from "./types";

// [TODO]: Read this from settings
const ROOTS = ["Library"] as const;
type RootName = (typeof ROOTS)[number];

// Moving Pages is not allowed
// We can only move Texts / Scrolls and Sections

export class Librarian {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];
	trees: Record<RootName, LibraryTree>;

	private actionQueue: VaultActionQueue | null = null;
	private diffMappers: Map<RootName, DiffToActionsMapper> = new Map();

	constructor({
		app,
		backgroundFileService,
		openedFileService,
		actionQueue,
	}: { app: App; actionQueue?: VaultActionQueue } & Pick<
		TexfresserObsidianServices,
		"backgroundFileService" | "openedFileService"
	>) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;
		this.actionQueue = actionQueue ?? null;

		// Initialize diff mappers for each root
		for (const rootName of ROOTS) {
			this.diffMappers.set(rootName, new DiffToActionsMapper(rootName));
		}

		app.vault.on("delete", (tAbstarctFile) => {
			this.onDelete(tAbstarctFile);
		});

		app.vault.on("rename", (newTAbstarctFile, oldSystemPath) => {
			this.onRename(newTAbstarctFile, oldSystemPath);
		});
	}

	/**
	 * Set the action queue (for deferred initialization).
	 */
	setActionQueue(queue: VaultActionQueue): void {
		this.actionQueue = queue;
	}

	/**
	 * Execute a mutation on a tree with automatic diff and action queuing.
	 * Returns the result of the mutation function.
	 */
	private withDiff<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
	): { actions: BackgroundVaultAction[]; result: T } {
		const tree = this.trees[rootName];
		if (!tree) {
			throw new Error(`Tree not found for root: ${rootName}`);
		}

		const before = tree.snapshot();
		const result = mutation(tree);
		const after = tree.snapshot();

		const diff = treeDiffer.diff(before, after);
		const mapper = this.diffMappers.get(rootName);
		const actions = mapper ? mapper.mapDiffToActions(diff) : [];

		if (this.actionQueue && actions.length > 0) {
			this.actionQueue.pushMany(actions);
		}

		return { actions, result };
	}

	/**
	 * Execute an async mutation with diff tracking.
	 * Note: The mutation itself should be synchronous tree operations.
	 * Async work (like reading files) should happen before calling this.
	 */
	private withDiffAsync<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
	): Promise<{ actions: BackgroundVaultAction[]; result: T }> {
		return Promise.resolve(this.withDiff(rootName, mutation));
	}

	async moveText({
		from,
		to,
	}: {
		from: TreePath;
		to: TreePath;
	}): Promise<void> {
		// TODO: Implement with withDiff
	}

	private async readLibraryFileDtosInFolder(
		dirBasename: string,
	): Promise<LibraryFileDto[]> {
		const fileReaders =
			await this.backgroundFileService.getReadersToAllMdFilesInFolder({
				basename: dirBasename,
				pathParts: [],
				type: "folder",
			});

		return await prettyFilesWithReaderToLibraryFileDtos(fileReaders);
	}

	async initTrees() {
		console.log("[Librarian] [initTrees] starting");
		this.trees = {} as Record<RootName, LibraryTree>;
		for (const rootName of ROOTS) {
			console.log("[Librarian] [initTrees] processing root:", rootName);
			const libraryFileDtosInFolder =
				await this.readLibraryFileDtosInFolder(rootName);

			console.log(
				"[Librarian] [initTrees] libraryFileDtosInFolder",
				libraryFileDtosInFolder,
			);

			const grouppedUpTexts = grouppedUpTextsFromLibraryFileDtos(
				libraryFileDtosInFolder,
				rootName,
			);
			console.log(
				"[Librarian] [initTrees] grouppedUpTexts entries:",
				grouppedUpTexts,
			);

			for (const [
				groupedRootName,
				textDtos,
			] of grouppedUpTexts.entries()) {
				console.log(
					"[Librarian] [initTrees] groupedRootName:",
					groupedRootName,
					"rootName:",
					rootName,
					"match:",
					groupedRootName === rootName,
				);
				if (groupedRootName === rootName) {
					this.trees[rootName] = new LibraryTree(textDtos, rootName);
					console.log(
						"[Librarian] [initTrees] created tree for",
						rootName,
						"with",
						textDtos.length,
						"texts",
					);
				}
			}
		}
		console.log(
			"[Librarian] [initTrees] completed, trees keys:",
			Object.keys(this.trees),
		);
	}

	async сreateNewTextInTheCurrentFolderAndOpenIt() {
		const pwd = await this.openedFileService.prettyPwd();
		console.log("[Librarian] pwd", pwd);

		if (Object.keys(this.trees).length === 0) {
			await this.initTrees();
		}

		const treePathToPwd = treePathFromSplitPath(pwd);
		const rootName = pwd.pathParts[0] as RootName | undefined;
		const affectedTree = this.getAffectedTree(pwd);

		if (!affectedTree || !rootName) {
			return;
		}

		console.log(
			"[Librarian] affectedTree",
			makeTextsFromTree(affectedTree),
		);

		const nearestSectionNode =
			affectedTree.getNearestSectionNode(treePathToPwd);

		console.log("[Librarian] nearestSectionNode", nearestSectionNode);
		const newTextName = this.generateUniqueTextName(nearestSectionNode);

		const textPath: TreePath = [
			...getTreePathFromNode(nearestSectionNode),
			newTextName,
		];

		console.log("[Librarian] textPath", textPath);

		// Use withDiff to track changes and queue actions
		const { result: mbTextNode } = this.withDiff(rootName, (tree) =>
			tree.getOrCreateTextNode({
				pageStatuses: { "000": TextStatus.NotStarted },
				path: textPath,
			}),
		);

		if (mbTextNode.error) {
			return;
		}

		const textNode = mbTextNode.data;

		console.log("[Librarian] textNode", textNode);

		// Get file info from node
		const libraryFileDto = getLibraryFileToFileFromNode(textNode);
		const { splitPath, metaInfo } = libraryFileDto;

		// Add root name to pathParts
		const fullSplitPath: SplitPath = {
			...splitPath,
			pathParts: [affectedTree.root.name, ...splitPath.pathParts],
		};

		console.log("[Librarian] fullSplitPath", fullSplitPath);

		// Create file with metainfo (direct call - queue handles the actual file ops)
		const content = editOrAddMetaInfo("", metaInfo);
		await this.backgroundFileService.create({
			...fullSplitPath,
			content,
		});

		// Get the created file and open it
		const app = this.openedFileService.getApp();
		const systemPath = systemPathFromSplitPath(fullSplitPath);
		const file = app.vault.getAbstractFileByPath(systemPath);

		console.log("[Librarian] file", file);
		if (file instanceof TFile) {
			await this.openedFileService.openFile(file);
		}
	}

	/**
	 * Set status for a node (page, text, or section).
	 * Automatically queues Codex updates for affected ancestors.
	 */
	setStatus(
		rootName: RootName,
		path: TreePath,
		status: "Done" | "NotStarted",
	): void {
		this.withDiff(rootName, (tree) => tree.setStatus({ path, status }));
	}

	/**
	 * Add texts to a tree with automatic diff tracking.
	 */
	addTexts(rootName: RootName, texts: TextDto[]): void {
		this.withDiff(rootName, (tree) => tree.addTexts(texts));
	}

	/**
	 * Delete texts from a tree with automatic diff tracking.
	 */
	deleteTexts(rootName: RootName, paths: TreePath[]): void {
		this.withDiff(rootName, (tree) =>
			tree.deleteTexts(paths.map((path) => ({ path }))),
		);
	}

	/**
	 * Get snapshot of a tree (for external diffing if needed).
	 */
	getSnapshot(rootName: RootName): TreeSnapshot | null {
		const tree = this.trees[rootName];
		return tree ? tree.snapshot() : null;
	}

	private generateUniqueTextName(sectionNode: {
		children: Array<{ name: string }>;
	}): string {
		const baseName = "New Text";
		const existingNames = new Set(
			sectionNode.children
				.filter((child) => child.name.startsWith(baseName))
				.map((child) => child.name),
		);

		if (!existingNames.has(baseName)) {
			return baseName;
		}

		let counter = 1;
		let candidate = `${baseName} ${counter}`;
		while (existingNames.has(candidate)) {
			counter++;
			candidate = `${baseName} ${counter}`;
		}

		return candidate;
	}

	private async onDelete(file: TAbstractFile) {
		const lastOpenedFile = this.openedFileService.getLastOpenedFile();
		console.log("[Librarian] [onDelete] file", file);
		// TODO: Use withDiff to track deletion
	}

	private async onRename(
		newTAbstarctFile: TAbstractFile,
		oldSystemPath: string,
	) {
		console.log(
			"[Librarian] [onRename] newTAbstarctFile",
			newTAbstarctFile,
		);
		console.log("[Librarian] [onRename] oldSystemPath", oldSystemPath);
		// TODO: Use withDiff to track rename
	}

	private getAffectedTree(path: SplitPath): LibraryTree | null;
	private getAffectedTree(path: string): LibraryTree | null;
	private getAffectedTree(path: SplitPath | string): LibraryTree | null {
		const splitPath =
			typeof path === "string" ? splitPathFromSystemPath(path) : path;

		const rootName = splitPath.pathParts[0] ?? "";

		console.log(
			"[Librarian] [getAffectedTree] rootName",
			rootName,
			"available trees:",
			Object.keys(this.trees),
		);

		return this.trees[rootName] ?? null;
	}
}

function isRootName(name: string): name is RootName {
	return ROOTS.includes(name as RootName);
}

function treePathFromSplitPath(splitPath: SplitPath): TreePath {
	return [...splitPath.pathParts.slice(1), splitPath.basename];
}

function grouppedUpTextsFromLibraryFileDtos(
	libraryFileDtos: LibraryFileDto[],
	folderRootName: RootName,
): Map<RootName, TextDto[]> {
	// Group files by their text path (all pages of the same text go together)
	const buckets: Map<string, LibraryFileDto[]> = new Map();
	for (const libraryFileDto of libraryFileDtos) {
		// Skip Codex files - they're organizational nodes, not texts
		if (libraryFileDto.metaInfo.fileType === "Codex") {
			continue;
		}

		const treePath = getTreePathFromLibraryFile(libraryFileDto);
		const isPage = libraryFileDto.metaInfo.fileType === "Page";
		const textPath = isPage ? treePath.slice(0, -1) : treePath;
		const joinedTextPath = textPath.join("-");
		const mbBook = buckets.get(joinedTextPath);
		if (!mbBook) {
			buckets.set(joinedTextPath, [libraryFileDto]);
		} else {
			mbBook.push(libraryFileDto);
		}
	}

	const grouppedUpTexts: Map<RootName, TextDto[]> = new Map();

	if (!isRootName(folderRootName)) {
		return grouppedUpTexts;
	}

	for (const [joinedTextPath, libraryFileDtos] of buckets.entries()) {
		const firstFile = libraryFileDtos[0];
		if (!firstFile) {
			continue;
		}
		const firstTreePath = getTreePathFromLibraryFile(firstFile);
		const isFirstPage = firstFile.metaInfo.fileType === "Page";
		const path = isFirstPage ? firstTreePath.slice(0, -1) : firstTreePath;

		const textDto: TextDto = {
			pageStatuses: Object.fromEntries(
				libraryFileDtos.map((libraryFileDto) => {
					const treePath = getTreePathFromLibraryFile(libraryFileDto);
					let name = treePath[treePath.length - 1];
					if (
						libraryFileDto.metaInfo.fileType === "Page" &&
						"index" in libraryFileDto.metaInfo
					) {
						name = String(libraryFileDto.metaInfo.index).padStart(
							3,
							"0",
						);
					}
					const status =
						libraryFileDto.metaInfo.status ?? TextStatus.NotStarted;
					return [name, status];
				}),
			),
			path,
		};
		const existingTextDtos = grouppedUpTexts.get(folderRootName);
		if (!existingTextDtos) {
			grouppedUpTexts.set(folderRootName, [textDto]);
		} else {
			existingTextDtos.push(textDto);
		}
	}

	return grouppedUpTexts;
}
