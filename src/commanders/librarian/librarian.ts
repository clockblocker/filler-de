import type { App, TAbstractFile } from "obsidian";
import { extractMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import {
	splitPathFromAbstractFile,
	splitPathFromSystemPath,
} from "../../services/obsidian-services/file-services/pathfinder";
import type { SplitPath } from "../../services/obsidian-services/file-services/types";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import { TextStatus } from "../../types/common-interface/enums";
import { LibraryTree } from "./library-tree/library-tree";
import type { PageDto, TextDto, TreePath } from "./types";

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

	private async readPagesInFolder(dirBasename: string) {
		const fileReaders =
			await this.backgroundFileService.getReadersToAllMdFilesInFolder({
				basename: dirBasename,
				pathParts: [],
				type: "folder",
			});

		const pageDtos = await Promise.all(
			fileReaders.map(async (fileReader) => {
				const content = await fileReader.readContent();
				const metaInfo = extractMetaInfo(content);
				if (metaInfo?.fileType === "Page") {
					return {
						name: fileReader.basename,
						pathToParent: fileReader.pathParts.slice(1),
						status: metaInfo?.status ?? TextStatus.NotStarted,
					};
				}
				return null;
			}),
		);

		return pageDtos.filter((pageDto) => pageDto !== null);
	}

	async initTrees() {
		const pages: PageDto[] = [];
		for (const name of ROOTS) {
			const pagesInFolder = await this.readPagesInFolder(name);
			pages.concat(pagesInFolder);
		}

		const grouppedUpTexts = grouppedUpTextsFromPages(pages);
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

		nearestSectionNode

		this.openedFileService.cd(file);

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

function treePathFromSplitPath(splitPath: SplitPath): TreePath {
	return [...splitPath.pathParts.slice(1), splitPath.basename];
}

function grouppedUpTextsFromPages(pages: PageDto[]): Map<RootName, TextDto[]> {
	const buckets: Map<string, Map<string, PageDto[]>> = new Map();
	for (const page of pages) {
		const pathToParent = page.pathToParent;
		const rootName = pathToParent[0];
		if (!rootName) {
			continue;
		}
		const joinedPathToParent = pathToParent.slice(1).join("-");
		const mbBucket = buckets.get(rootName);
		if (!mbBucket) {
			buckets.set(rootName, new Map([[joinedPathToParent, [page]]]));
		} else {
			const mbBook = mbBucket.get(joinedPathToParent);
			if (!mbBook) {
				mbBucket.set(joinedPathToParent, [page]);
			} else {
				mbBook.push(page);
			}
		}
	}

	const grouppedUpTexts: Map<RootName, TextDto[]> = new Map();

	for (const [rootName, bucket] of buckets.entries()) {
		for (const [joinedPathToParent, pages] of bucket.entries()) {
			const path = joinedPathToParent.split("-");
			const textDto: TextDto = {
				pageStatuses: Object.fromEntries(
					pages.map((page) => [page.name, page.status]),
				),
				path,
			};
			grouppedUpTexts[rootName].push(textDto);
		}
	}

	return grouppedUpTexts;
}
