import type { App, TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import { editOrAddMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import type { PrettyFileFromTo } from "../../services/obsidian-services/file-services/background/background-file-service";
import {
	splitPathFromSystemPath,
	systemPathFromSplitPath,
} from "../../services/obsidian-services/file-services/pathfinder";
import type { SplitPath } from "../../services/obsidian-services/file-services/types";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import { TextStatus } from "../../types/common-interface/enums";
import {
	getLibraryFileToFileFromNode,
	getTreePathFromLibraryFile,
	prettyFilesWithReaderToLibraryFileDtos,
} from "./indexing/libraryFileAdapters";
import { makeTextsFromTree } from "./library-tree/helpers/serialization";
import { LibraryTree } from "./library-tree/library-tree";
import { getTreePathFromNode } from "./pure-functions/node";
import type { LibraryFileDto, PageNode, TextDto, TreePath } from "./types";

// [TODO]: Read this from settings
const ROOTS = ["Library"] as const;
type RootName = (typeof ROOTS)[number];

// Moving Pages is not allowed
// We can only move Texts / Scrolls and Sections

export class Librarian {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];
	trees: Record<RootName, LibraryTree>;

	constructor({
		app,
		backgroundFileService,
		openedFileService,
	}: { app: App } & Pick<
		TexfresserObsidianServices,
		"backgroundFileService" | "openedFileService"
	>) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;

		app.vault.on("delete", (tAbstarctFile) => {
			this.onDelete(tAbstarctFile);
		});

		app.vault.on("rename", (newTAbstarctFile, oldSystemPath) => {
			this.onRename(newTAbstarctFile, oldSystemPath);
		});
	}

	async moveText({
		from,
		to,
	}: {
		from: TreePath;
		to: TreePath;
	}): Promise<void> {
		// const fromSplitPath = splitPathFromTreePath(from);
		// const toSplitPath = splitPathFromTreePath(to);
		// await this.backgroundFileService.move({
		// 	from: fromSplitPath,
		// 	to: toSplitPath,
		// });
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
		const affectedTree = this.getAffectedTree(pwd);

		if (!affectedTree) {
			return;
		}

		console.log(
			"[Librarian] affectedTree",
			makeTextsFromTree(affectedTree),
		);

		const nearestSectionNode =
			affectedTree.getNearestSectionNode(treePathToPwd);

		console.log("[Librarian] nearestSectionNode", nearestSectionNode);
		// Generate unique text name
		const newTextName = this.generateUniqueTextName(nearestSectionNode);

		// Create text node with one child (page "000")
		const textPath: TreePath = [
			...getTreePathFromNode(nearestSectionNode),
			newTextName,
		];

		console.log("[Librarian] textPath", textPath);

		const mbTextNode = affectedTree.getOrCreateTextNode({
			pageStatuses: { "000": TextStatus.NotStarted },
			path: textPath,
		});

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

		// Create file with metainfo
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
	// For ScrollNodes: treePath = ['Avatar', 'Season_1', 'Episode_1'], textPath = ['Avatar', 'Season_1', 'Episode_1']
	// For BookNodes: treePath = ['Avatar', 'Season_1', 'Episode_2', '000'], textPath = ['Avatar', 'Season_1', 'Episode_2']
	const buckets: Map<string, LibraryFileDto[]> = new Map();
	for (const libraryFileDto of libraryFileDtos) {
		// Skip Codex files - they're organizational nodes, not texts
		if (libraryFileDto.metaInfo.fileType === "Codex") {
			continue;
		}

		const treePath = getTreePathFromLibraryFile(libraryFileDto);
		// For pages, the last element is the page number/name, so text path is everything except the last element
		// For scrolls, the last element is the text name, so text path is the full path
		// We need to determine if it's a page or scroll based on the metaInfo
		const isPage = libraryFileDto.metaInfo.fileType === "Page";
		const textPath = isPage ? treePath.slice(0, -1) : treePath;
		// Join the text path to use as the grouping key
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
		// Reconstruct the path from the first file's treePath to ensure correctness
		// Use the textPath we already computed during grouping
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
					// For Page files, preserve the original page number format from the basename
					// The decode function converts "000" to "0", but we want to keep "000"
					if (
						libraryFileDto.metaInfo.fileType === "Page" &&
						"index" in libraryFileDto.metaInfo
					) {
						// Use the index from metaInfo, padded to 3 digits
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
