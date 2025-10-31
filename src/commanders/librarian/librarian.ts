import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import { LibraryTree } from "./library-tree/library-tree";

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

	private async read(dirBasename: string) {
		const files = await this.backgroundFileService.getReadersToAllMdFilesInFolder({
			basename: dirBasename,
			pathParts: [],
			type: "folder",
		});

		// for (const tFile of tFiles) {
		// 	const content = await this.backgroundFileService.readContent({
		// 		basename: tFile.basename,
		// 		pathParts: tFile.pathParts,
		// 		type: "file",
		// 	});
		// 	console.log(content);
		// }
	}

	private async initTrees() {
		// for (const name of Object.keys(this.trees)) {
		// 	const tFiles = await this.backgroundFileService.ls({
		// 		basename: name,
		// 		pathParts: [],
		// 		type: "folder",
		// 	});

		// 	for (const tFile of tFiles) {
		// 		const content = await this.backgroundFileService.readContent({
		// 			basename: tFile.basename,
		// 			pathParts: tFile.pathParts,
		// 			type: "file",
		// 		});
		// 		console.log(content);
		// 	}
		// }
	}

	async ls() {
		// const files = await this.backgroundFileService.ls({
		// 	basename: "Library",
		// 	pathParts: [],
		// 	type: "folder",
		// });
		// console.log(files);
	}
}
