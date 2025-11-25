import type { TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import { editOrAddMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import type { BackgroundVaultAction } from "../../services/obsidian-services/file-services/background/background-vault-actions";
import type { VaultActionQueue } from "../../services/obsidian-services/file-services/background/vault-action-queue";
import {
	splitPathFromSystemPath,
	systemPathFromSplitPath,
} from "../../services/obsidian-services/file-services/pathfinder";
import type { SplitPath } from "../../services/obsidian-services/file-services/types";
import { logWarning } from "../../services/obsidian-services/helpers/issue-handlers";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import { TextStatus } from "../../types/common-interface/enums";
import { DiffToActionsMapper } from "./diffing/diff-to-actions";
import { treeDiffer } from "./diffing/tree-differ";
import type { TreeSnapshot } from "./diffing/types";
import { toGuardedNodeName } from "./indexing/formatters";
import {
	getLibraryFileToFileFromNode,
	getTreePathFromLibraryFile,
	prettyFilesWithReaderToLibraryFileDtos,
} from "./indexing/libraryFileAdapters";
import { makeTextsFromTree } from "./library-tree/helpers/serialization";
import { LibraryTree } from "./library-tree/library-tree";
import { getTreePathFromNode } from "./pure-functions/node";
import {
	formatPageIndex,
	splitTextIntoPages,
} from "./text-splitter/text-splitter";
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

		// Initialize diff mappers for each root
		for (const rootName of ROOTS) {
			this.diffMappers.set(rootName, new DiffToActionsMapper(rootName));
		}
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

		// Provide getNode callback for Codex content generation
		const getNode = (path: TreePath) => {
			const mbNode = tree.getMaybeNode({ path });
			if (mbNode.error) return undefined;
			const node = mbNode.data;
			// Only return section or text nodes (not pages)
			if (node.type === "Section" || node.type === "Text") {
				return node;
			}
			return undefined;
		};

		const actions = mapper ? mapper.mapDiffToActions(diff, getNode) : [];

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
	 * Convert the current note into a managed text (scroll or book).
	 * Only works on files in librarian-maintained folders.
	 */
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

		const splitPath = splitPathFromSystemPath(currentFile.path);
		const rootName = splitPath.pathParts[0];

		// Check if file is in a librarian-maintained folder
		if (!rootName || !isRootName(rootName)) {
			logWarning({
				description: `File must be in a Library folder. Found: ${rootName}`,
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		const affectedTree = this.getAffectedTree(splitPath);
		if (!affectedTree) {
			logWarning({
				description: "Could not find tree for this folder.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		// Read file content
		const content = await this.backgroundFileService.readContent({
			basename: splitPath.basename,
			pathParts: splitPath.pathParts,
		});

		if (!content.trim()) {
			logWarning({
				description: "File is empty.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		// Derive tree path from file location
		// E.g., Library/Section/MyNote.md → ["Section", "MyNote"]
		const textName = toGuardedNodeName(splitPath.basename);

		// Split content into pages with formatted sentences
		const { pages, isBook } = splitTextIntoPages(content, textName);
		const sectionPath = splitPath.pathParts.slice(1); // Remove root
		const textPath: TreePath = [...sectionPath, textName];

		// Build pageStatuses
		const pageStatuses: Record<string, TextStatus> = {};
		for (let i = 0; i < pages.length; i++) {
			pageStatuses[formatPageIndex(i)] = TextStatus.NotStarted;
		}

		// Add to tree with diff tracking
		this.withDiff(rootName, (tree) => {
			tree.addTexts([{ pageStatuses, path: textPath }]);
		});

		// Flush queue to ensure files are created before writing content
		if (this.actionQueue) {
			await this.actionQueue.flushNow();
		}

		// Write page content (the diff/queue handles structure, we handle content)
		for (let i = 0; i < pages.length; i++) {
			const pageIndex = formatPageIndex(i);
			const pageContent = pages[i] ?? "";

			// For scroll: content goes to the scroll file directly
			// For book: content goes to individual page files
			if (!isBook) {
				// Scroll: single file with reversed name
				const scrollPath = {
					basename: textPath.toReversed().join("-"),
					pathParts: [rootName, ...sectionPath],
				};
				await this.backgroundFileService.replaceContent(
					scrollPath,
					pageContent,
				);
			} else {
				// Book page: in Pages subfolder, NNN-reversed-path.md
				const pagePath = {
					basename: `${pageIndex}-${textPath.toReversed().join("-")}`,
					pathParts: [rootName, ...sectionPath, textName, "Pages"],
				};
				await this.backgroundFileService.replaceContent(
					pagePath,
					pageContent,
				);
			}
		}

		// Trash original file (it's now replaced by the managed text)
		await this.backgroundFileService.trash({
			basename: splitPath.basename,
			pathParts: splitPath.pathParts,
		});

		console.log(
			`[Librarian] ${isBook ? `Created book "${textName}" with ${pages.length} pages.` : `Created scroll "${textName}".`}`,
		);

		return true;
	}

	/**
	 * Check if file is in a librarian-maintained folder.
	 */
	isInLibraryFolder(file: TFile): boolean {
		const splitPath = splitPathFromSystemPath(file.path);
		const rootName = splitPath.pathParts[0];
		return !!rootName && isRootName(rootName);
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

	// ─── Vault Event Handlers ────────────────────────────────────────
	// Called by VaultEventService when files change

	/**
	 * Handle file deletion in library folders.
	 */
	onFileDeleted(file: TAbstractFile): void {
		console.log("[Librarian] [onFileDeleted]", file.path);
		// TODO: Remove from tree, update parent Codex
	}

	/**
	 * Handle file rename/move in library folders.
	 */
	onFileRenamed(file: TAbstractFile, oldPath: string): void {
		console.log("[Librarian] [onFileRenamed]", oldPath, "→", file.path);
		// TODO: Update tree, rename files, update Codexes
	}

	/**
	 * Handle file creation in library folders.
	 */
	onFileCreated(file: TAbstractFile): void {
		console.log("[Librarian] [onFileCreated]", file.path);
		// TODO: Check if needs to be added to tree
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
