import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";

export class Librarian {
	private backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	private openedFileService: TexfresserObsidianServices["openedFileService"];

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

	async test() {
		const prettyPwd = await this.openedFileService.prettyPwd();
		const content = await this.backgroundFileService.readContent(prettyPwd);
		console.log(content);
	}

	// async ls() {
	// 	const files = await this.backgroundFileService.deepListFiles({
	// 		basename: "Library",
	// 		pathParts: [],
	// 		type: "folder",
	// 	});
	// 	console.log(files);
	// }
}
