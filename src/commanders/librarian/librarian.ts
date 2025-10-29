import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";

export class Librarian {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];

	constructor({
		backgroundFileService,
		openedFileService,
	}: Pick<
		TexfresserObsidianServices,
		"backgroundFileService" | "openedFileService"
	>) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;
	}

	async ls() {
		const files = await this.backgroundFileService.ls({
			basename: "Library",
			pathParts: [],
			type: "folder",
		});
		console.log(files);
	}
}
