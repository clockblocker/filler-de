import { extractMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import { TextStatus } from "../../types/common-interface/enums";
import { LibraryTree } from "./library-tree/library-tree";
import type { PageDto, TextDto } from "./types";

export class Librarian {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];
	trees: {
		Library: LibraryTree;
	};

	constructor({
		backgroundFileService,
		openedFileService,
	}: Pick<
		TexfresserObsidianServices,
		"backgroundFileService" | "openedFileService"
	>) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;
		this.trees = {
			Library: new LibraryTree([], "Library"),
		};
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

	private groupUpPages(pages: PageDto[]): Map<string, TextDto[]> {
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

		const bucketedTexts: Map<string, TextDto[]> = new Map();

		for (const [rootName, bucket] of buckets.entries()) {
			for (const [joinedPathToParent, pages] of bucket.entries()) {
				const path = joinedPathToParent.split("-");
				const textDto: TextDto = {
					pageStatuses: Object.fromEntries(
						pages.map((page) => [page.name, page.status]),
					),
					path,
				};
				bucketedTexts[rootName].push(textDto);
			}
		}

		return bucketedTexts;
	}

	private async initTrees() {
		const pages: PageDto[] = [];
		for (const name of Object.keys(this.trees)) {
			const pagesInFolder = await this.readPagesInFolder(name);
			pages.concat(pagesInFolder);
		}

		const bucketedTexts = this.groupUpPages(pages);
		for (const [rootName, textDtos] of bucketedTexts.entries()) {
			const tree = this.trees[rootName];
			if (!tree) {
				this.trees[rootName] = new LibraryTree([], rootName);
			}
			tree.addTexts(textDtos);
		}
	}
}
