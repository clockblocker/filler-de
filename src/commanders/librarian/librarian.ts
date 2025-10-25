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

	async testCreate() {
		const prettyPwd = await this.openedFileService.prettyPwd();
		console.log("prettyPwd", prettyPwd);
		const content = await this.backgroundFileService.readContent(prettyPwd);
		console.log(content);

		this.backgroundFileService.create([
			{
				prettyPath: {
					basename: "__Library",
					pathParts: ["Tests", "Library"],
				},
			},
			{
				prettyPath: {
					basename: "__Avatar",
					pathParts: ["Tests", "Library", "Avatar"],
				},
			},
			{
				prettyPath: {
					basename: "__Avatar-Season1",
					pathParts: ["Tests", "Library", "Avatar", "Season1"],
				},
			},
			{
				prettyPath: {
					basename: "__Avatar-Season1-Episode1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season1",
						"Episode1",
					],
				},
			},
			{
				prettyPath: {
					basename: "000-Avatar-Season1-Episode1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season1",
						"Episode1",
						"Pages",
					],
				},
			},
			{
				prettyPath: {
					basename: "001-Avatar-Season1-Episode1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season1",
						"Episode1",
						"Pages",
					],
				},
			},
		]);
	}

	async testMove() {
		const prettyPwd = await this.openedFileService.prettyPwd();
		console.log("prettyPwd", prettyPwd);
		const content = await this.backgroundFileService.readContent(prettyPwd);
		console.log(content);

		this.backgroundFileService.move([
			{
				from: {
					basename: "000-Avatar-Season1-Episode1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season1",
						"Episode1",
						"Pages",
					],
				},
				to: {
					basename: "000-Avatar-Season1-Episode1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season1",
						"Episode2",
						"Pages",
					],
				},
			},
		]);
	}
}

// async ls() {
// 	const files = await this.backgroundFileService.deepListFiles({
// 		basename: "Library",
// 		pathParts: [],
// 		type: "folder",
// 	});
// 	console.log(files);
// }
