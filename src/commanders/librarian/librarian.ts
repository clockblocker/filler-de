import type { TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import { editOrAddMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import type { VaultAction } from "../../services/obsidian-services/file-services/background/background-vault-actions";
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
import { pageNameFromTreePath, toGuardedNodeName } from "./indexing/formatters";
import {
	getLibraryFileToFileFromNode,
	getTreePathFromLibraryFile,
	prettyFilesWithReaderToLibraryFileDtos,
} from "./indexing/libraryFileAdapters";
import { LibraryTree } from "./library-tree/library-tree";
import { getTreePathFromNode } from "./pure-functions/node";
import {
	formatPageIndex,
	splitTextIntoP_ages,
} from "./text-splitter/text-splitter";
import type { LibraryFileDto, TextDto, TreePath } from "./types";

// [TODO]: Read this from settings
const ROOTS = ["Library"] as const;
type RootName = (typeof ROOTS)[number];

// Moving Page is not allowed
// We can only move Texts / Scrolls and Sections

export class Librarian {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];
	trees: Record<RootName, LibraryTree>;

	private actionQueue: VaultActionQueue | null = null;
	private diffMappers: Map<RootName, DiffToActionsMapper> = new Map();

	/**
	 * When true, skips filesystem reconciliation before mutations.
	 * Useful for testing where tree state is set manually.
	 */
	private _skipReconciliation = false;

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
	 * Set whether to skip reconciliation (for testing).
	 * @internal
	 */
	_setSkipReconciliation(skip: boolean): void {
		this._skipReconciliation = skip;
	}

	/**
	 * Set the action queue (for deferred initialization).
	 */
	setActionQueue(queue: VaultActionQueue): void {
		this.actionQueue = queue;
	}

	/**
	 * Reconcile a subtree with filesystem state.
	 * Reads files from disk and syncs the in-memory tree to match.
	 *
	 * @param rootName - The root tree to reconcile in
	 * @param subtreePath - Path within the root to reconcile (empty = whole tree)
	 */
	private async reconcileSubtree(
		rootName: RootName,
		subtreePath: TreePath = [],
	): Promise<void> {
		const tree = this.trees[rootName];
		if (!tree) {
			return;
		}

		const filesystemTexts = await this.readSubtreeFromFilesystem(
			rootName,
			subtreePath,
		);

		tree.reconcileSubtree(subtreePath, filesystemTexts);
	}

	/**
	 * Execute a mutation on a tree with automatic diff and action queuing.
	 * Returns the result of the mutation function.
	 */
	private withDiff<T>(
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
		console.log("[Librarian] [withDiff] actions", actions);
		if (this.actionQueue && actions.length > 0) {
			this.actionQueue.pushMany(actions);
		}

		return { actions, result };
	}

	/**
	 * Execute an async mutation with diff tracking and optional pre-reconciliation.
	 * Reconciles affected paths with filesystem before taking snapshot.
	 *
	 * @param rootName - The root tree to operate on
	 * @param mutation - Synchronous tree mutation function
	 * @param affectedPaths - Paths to reconcile with filesystem before mutation
	 */
	private async withDiffAsync<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
		affectedPaths?: TreePath[],
	): Promise<{ actions: VaultAction[]; result: T }> {
		// Reconcile affected paths before taking snapshot (unless skipped for testing)
		if (
			!this._skipReconciliation &&
			affectedPaths &&
			affectedPaths.length > 0
		) {
			for (const path of affectedPaths) {
				await this.reconcileSubtree(rootName, path);
			}
		}

		return this.withDiff(rootName, mutation);
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
		pathParts: string[] = [],
	): Promise<LibraryFileDto[]> {
		const fileReaders =
			await this.backgroundFileService.getReadersToAllMdFilesInFolder({
				basename: dirBasename,
				pathParts,
				type: "folder",
			});

		return await prettyFilesWithReaderToLibraryFileDtos(fileReaders);
	}

	/**
	 * Read TextDtos from filesystem for a subtree.
	 * @param rootName - The root folder name (e.g., "Library")
	 * @param subtreePath - Path within the root to read (empty = entire root)
	 */
	async readSubtreeFromFilesystem(
		rootName: RootName,
		subtreePath: TreePath = [],
	): Promise<TextDto[]> {
		// Determine folder to read
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

		const libraryFileDtos = await this.readLibraryFileDtosInFolder(
			folderBasename,
			pathParts,
		);

		// Filter to only files within the subtree path
		const textDtos = textDtosFromLibraryFileDtos(
			libraryFileDtos,
			subtreePath,
		);

		return textDtos;
	}

	async initTrees() {
		this.trees = {} as Record<RootName, LibraryTree>;
		for (const rootName of ROOTS) {
			const textDtos = await this.readSubtreeFromFilesystem(rootName);
			this.trees[rootName] = new LibraryTree(textDtos, rootName);
		}
	}

	async сreateNewTextInTheCurrentFolderAndOpenIt() {
		const pwd = await this.openedFileService.prettyPwd();

		if (Object.keys(this.trees).length === 0) {
			await this.initTrees();
		}

		const treePathToPwd = treePathFromSplitPath(pwd);
		const rootName = pwd.pathParts[0] as RootName | undefined;
		const affectedTree = this.getAffectedTree(pwd);

		if (!affectedTree || !rootName) {
			return;
		}

		const nearestSectionNode =
			affectedTree.getNearestSectionNode(treePathToPwd);

		const newTextName = this.generateUniqueTextName(nearestSectionNode);

		const sectionPath = getTreePathFromNode(nearestSectionNode);
		const textPath: TreePath = [...sectionPath, newTextName];

		// Use withDiffAsync to reconcile the section before mutation
		const { result: mbTextNode } = await this.withDiffAsync(
			rootName,
			(tree) =>
				tree.getOrCreateTextNode({
					pageStatuses: { "000": TextStatus.NotStarted },
					path: textPath,
				}),
			[sectionPath],
		);

		if (mbTextNode.error) {
			return;
		}

		const textNode = mbTextNode.data;

		// Get file info from node
		const libraryFileDto = getLibraryFileToFileFromNode(textNode);
		const { splitPath, metaInfo } = libraryFileDto;

		// Add root name to pathParts
		const fullSplitPath: SplitPath = {
			...splitPath,
			pathParts: [affectedTree.root.name, ...splitPath.pathParts],
		};

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
		const { pages, isBook } = splitTextIntoP_ages(content, textName);
		const sectionPath = splitPath.pathParts.slice(1); // Remove root
		const textPath: TreePath = [...sectionPath, textName];

		// Build pageStatuses
		const pageStatuses: Record<string, TextStatus> = {};
		for (let i = 0; i < pages.length; i++) {
			pageStatuses[formatPageIndex(i)] = TextStatus.NotStarted;
		}

		// Add to tree with diff tracking, reconciling section first
		await this.withDiffAsync(
			rootName,
			(tree) => {
				tree.addTexts([{ pageStatuses, path: textPath }]);
			},
			[sectionPath],
		);

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
				// Book page: in Page subfolder, 000-Page-TextName-Parent.md
				const fullPagePath: TreePath = [...textPath, pageIndex];
				const pagePath = {
					basename: pageNameFromTreePath.encode(fullPagePath),
					pathParts: [rootName, ...sectionPath, textName, "Page"],
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
	async setStatus(
		rootName: RootName,
		path: TreePath,
		status: "Done" | "NotStarted",
	): Promise<void> {
		// Reconcile the parent section before setting status
		const parentPath = path.slice(0, -1);
		await this.withDiffAsync(
			rootName,
			(tree) => tree.setStatus({ path, status }),
			parentPath.length > 0 ? [parentPath] : [],
		);
	}

	/**
	 * Add texts to a tree with automatic diff tracking.
	 */
	async addTexts(rootName: RootName, texts: TextDto[]): Promise<void> {
		// Collect unique parent section paths to reconcile (filter empty = root-level)
		const parentPaths = [
			...new Set(texts.map((t) => t.path.slice(0, -1).join("/"))),
		]
			.map((p) => p.split("/").filter(Boolean) as TreePath)
			.filter((p) => p.length > 0);

		await this.withDiffAsync(
			rootName,
			(tree) => tree.addTexts(texts),
			parentPaths,
		);
	}

	/**
	 * Delete texts from a tree with automatic diff tracking.
	 */
	async deleteTexts(rootName: RootName, paths: TreePath[]): Promise<void> {
		// Collect unique parent section paths to reconcile (filter empty = root-level)
		const parentPaths = [
			...new Set(paths.map((p) => p.slice(0, -1).join("/"))),
		]
			.map((p) => p.split("/").filter(Boolean) as TreePath)
			.filter((p) => p.length > 0);

		await this.withDiffAsync(
			rootName,
			(tree) => tree.deleteTexts(paths.map((path) => ({ path }))),
			parentPaths,
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

		return this.trees[rootName] ?? null;
	}
}

function isRootName(name: string): name is RootName {
	return ROOTS.includes(name as RootName);
}

function treePathFromSplitPath(splitPath: SplitPath): TreePath {
	return [...splitPath.pathParts.slice(1), splitPath.basename];
}

/**
 * Convert LibraryFileDtos to TextDtos, filtering by subtree path.
 * Groups pages of the same text together.
 */
function textDtosFromLibraryFileDtos(
	libraryFileDtos: LibraryFileDto[],
	subtreePath: TreePath = [],
): TextDto[] {
	// Group files by their text path (all pages of the same text go together)
	const buckets: Map<string, LibraryFileDto[]> = new Map();

	for (const libraryFileDto of libraryFileDtos) {
		// Skip Codex files - they're organizational nodes, not texts
		if (libraryFileDto.metaInfo.fileType === "Codex") {
			continue;
		}

		const treePath = getTreePathFromLibraryFile(libraryFileDto);

		// Filter: only include files under subtreePath
		if (subtreePath.length > 0) {
			const matchesSubtree = subtreePath.every(
				(segment, i) => treePath[i] === segment,
			);
			if (!matchesSubtree) {
				continue;
			}
		}

		const isPage = libraryFileDto.metaInfo.fileType === "Page";
		const textPath = isPage ? treePath.slice(0, -1) : treePath;
		const joinedTextPath = textPath.join("-");

		const bucket = buckets.get(joinedTextPath);
		if (!bucket) {
			buckets.set(joinedTextPath, [libraryFileDto]);
		} else {
			bucket.push(libraryFileDto);
		}
	}

	const textDtos: TextDto[] = [];

	for (const [, fileDtos] of buckets.entries()) {
		const firstFile = fileDtos[0];
		if (!firstFile) {
			continue;
		}

		const firstTreePath = getTreePathFromLibraryFile(firstFile);
		const isFirstPage = firstFile.metaInfo.fileType === "Page";
		const path = isFirstPage ? firstTreePath.slice(0, -1) : firstTreePath;

		const textDto: TextDto = {
			pageStatuses: Object.fromEntries(
				fileDtos.map((libraryFileDto) => {
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

		textDtos.push(textDto);
	}

	return textDtos;
}
