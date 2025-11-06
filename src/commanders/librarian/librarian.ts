import type { App, TAbstractFile } from "obsidian";
import { splitPathFromSystemPath } from "../../services/obsidian-services/file-services/pathfinder";
import type { SplitPath } from "../../services/obsidian-services/file-services/types";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import { TextStatus } from "../../types/common-interface/enums";
import {
	getTreePathFromLibraryFile,
	prettyFilesWithReaderToLibraryFileDtos,
} from "./indexing/libraryFileAdapters";
import { LibraryTree } from "./library-tree/library-tree";
import type { LibraryFileDto, TextDto, TreePath } from "./types";

// [TODO]: Read this from settings
const ROOTS = ["Library"] as const;
type RootName = (typeof ROOTS)[number];

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
		const libraryFileDtos: LibraryFileDto[] = [];
		for (const name of ROOTS) {
			const libraryFileDtosInFolder =
				await this.readLibraryFileDtosInFolder(name);
			libraryFileDtos.push(...libraryFileDtosInFolder);
		}

		const grouppedUpTexts =
			grouppedUpTextsFromLibraryFileDtos(libraryFileDtos);

		for (const [rootName, textDtos] of grouppedUpTexts.entries()) {
			this.trees[rootName] = new LibraryTree(textDtos, rootName);
		}
	}

	async сreateNewTextInTheCurrentFolderAndOpenIt() {
		const pwd = await this.openedFileService.prettyPwd();
		// Parse as tree path
		const treePathToPwd = treePathFromSplitPath(pwd);
		// find the nearest text node
		const affectedTree = this.getAffectedTree(pwd);
		if (!affectedTree) {
			return;
		}

		const nearestSectionNode =
			affectedTree.getNearestSectionNode(treePathToPwd);

		// const backgroundFileService = this.openedFileService.prettyPwd();

		// console.log("[Librarian] [onCreate] file", file);
		// console.log("[Librarian] [onCreate] lastOpenedFile", lastOpenedFile);
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
): Map<RootName, TextDto[]> {
	const buckets: Map<string, Map<string, LibraryFileDto[]>> = new Map();
	for (const libraryFileDto of libraryFileDtos) {
		const treePath = getTreePathFromLibraryFile(libraryFileDto);
		const pathToParent = treePath.slice(0, -1);
		const rootName = pathToParent[0];
		if (!rootName) {
			continue;
		}
		const joinedPathToParent = pathToParent.slice(1).join("-");
		const mbBucket = buckets.get(rootName);
		if (!mbBucket) {
			buckets.set(
				rootName,
				new Map([[joinedPathToParent, [libraryFileDto]]]),
			);
		} else {
			const mbBook = mbBucket.get(joinedPathToParent);
			if (!mbBook) {
				mbBucket.set(joinedPathToParent, [libraryFileDto]);
			} else {
				mbBook.push(libraryFileDto);
			}
		}
	}

	const grouppedUpTexts: Map<RootName, TextDto[]> = new Map();

	for (const [rootName, bucket] of buckets.entries()) {
		if (!isRootName(rootName)) {
			continue;
		}
		for (const [joinedPathToParent, libraryFileDtos] of bucket.entries()) {
			const path = joinedPathToParent.split("-");
			const textDto: TextDto = {
				pageStatuses: Object.fromEntries(
					libraryFileDtos.map((libraryFileDto) => {
						const treePath =
							getTreePathFromLibraryFile(libraryFileDto);
						const name = treePath[treePath.length - 1];
						const status =
							libraryFileDto.metaInfo.status ??
							TextStatus.NotStarted;
						return [name, status];
					}),
				),
				path,
			};
			const existingTextDtos = grouppedUpTexts.get(rootName);
			if (!existingTextDtos) {
				grouppedUpTexts.set(rootName, [textDto]);
			} else {
				existingTextDtos.push(textDto);
			}
		}
	}

	return grouppedUpTexts;
}
