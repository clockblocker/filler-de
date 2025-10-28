import type { Librarian } from "../../commanders/librarian/librarian";
import type { PrettyPath } from "../../types/common-interface/dtos";
import { testFile } from "./consts";

export class LibrarianTester {
	private librarian: Librarian;

	constructor(librarian: Librarian) {
		this.librarian = librarian;
	}

	async testFileMethods() {
		await this.createAvatar();
		await sleep(100);
		await this.moveAll();
	}

	private async createAvatar() {
		this.librarian.backgroundFileService.create([
			testFile.avatarCodex,
			testFile.avatarSeason1Codex,
			testFile.avatarSeason1Episode1Codex,
			testFile.avatarSeason1Episode1Page000,
			testFile.avatarSeason1Episode1Page001,
		]);
	}

	private async moveAllPages() {
		this.librarian.backgroundFileService.move([
			{
				from: testFile.avatarSeason1Episode1Page000,
				to: testFile.avatarSeason1Episode2Page000,
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
// }
