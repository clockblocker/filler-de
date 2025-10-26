import type { Librarian } from "../commanders/librarian/librarian";

export class LibrarianTester {
	private librarian: Librarian;

	constructor(librarian: Librarian) {
		this.librarian = librarian;
	}

	async testFileMethods() {
		await this.createAvatar();
		await sleep(10);
		await this.moveAll();

		// await this.moveOnePage();
		// await this.moveOtherPages();
	}

	private async createAvatar() {
		// const prettyPwd = await this.librarian.openedFileService.prettyPwd();

		// const content =
		// 	await this.librarian.backgroundFileService.readContent(prettyPwd);
		// console.log(content);

		this.librarian.backgroundFileService.create([
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
					basename: "__Avatar-Season_1",
					pathParts: ["Tests", "Library", "Avatar", "Season_1"],
				},
			},
			{
				prettyPath: {
					basename: "__Avatar-Season_1-Episode_1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_1",
					],
				},
			},
			{
				prettyPath: {
					basename: "000-Avatar-Season_1-Episode_1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_1",
						"Pages",
					],
				},
			},
			{
				prettyPath: {
					basename: "001-Avatar-Season_1-Episode_1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_1",
						"Pages",
					],
				},
			},
		]);
	}

	private async moveAllPages() {
		this.librarian.backgroundFileService.move([
			{
				from: {
					basename: "000-Avatar-Season_1-Episode_1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_1",
						"Pages",
					],
				},
				to: {
					basename: "000-Avatar-Season_1-Episode_2",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_2",
						"Pages",
					],
				},
			},
			{
				from: {
					basename: "001-Avatar-Season_1-Episode_1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_1",
						"Pages",
					],
				},
				to: {
					basename: "001-Avatar-Season_1-Episode_2",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_2",
						"Pages",
					],
				},
			},
		]);
	}

	private async moveAll() {
		this.librarian.backgroundFileService.move([
			{
				from: {
					basename: "__Avatar-Season_1-Episode_1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_1",
					],
				},
				to: {
					basename: "__Avatar-Season_1-Episode_2",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_2",
					],
				},
			},
			{
				from: {
					basename: "000-Avatar-Season_1-Episode_1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_1",
						"Pages",
					],
				},
				to: {
					basename: "000-Avatar-Season_1-Episode_2",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_2",
						"Pages",
					],
				},
			},
			{
				from: {
					basename: "001-Avatar-Season_1-Episode_1",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_1",
						"Pages",
					],
				},
				to: {
					basename: "001-Avatar-Season_1-Episode_2",
					pathParts: [
						"Tests",
						"Library",
						"Avatar",
						"Season_1",
						"Episode_2",
						"Pages",
					],
				},
			},
		]);
	}
}

// async ls() {
// 	const files = await this.librarian.backgroundFileService.deepListFiles({
// 		basename: "Library",
// 		pathParts: [],
// 		type: "folder",
// 	});
// 	console.log(files);
// }
