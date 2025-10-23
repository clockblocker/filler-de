import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";

export class Librarian {
	private backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	private openedFileService: TexfresserObsidianServices["openedFileService"];

	constructor({
		backgroundFileService,
		openedFileService,
	}: TexfresserObsidianServices) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;
	}

	async ls() {
		const files = await this.backgroundFileService.deepListFiles({
			basename: "Library",
			pathParts: [],
			type: "folder",
		});
		console.log(files);
	}
}
