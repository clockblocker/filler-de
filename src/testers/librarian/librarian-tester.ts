import type { Librarian } from "../../commanders/librarian/librarian";
import { testLibrary } from "./consts";

export class LibrarianTester {
	private librarian: Librarian;

	constructor(librarian: Librarian) {
		this.librarian = librarian;
	}

	async testFileMethods() {
		await this.createAvatarS1E1();
		await sleep(100);
		await this.moveE1ToE2();
		await sleep(100);
		await this.trashE2();
	}

	private async createAvatarS1E1() {
		this.librarian.backgroundFileService.create([
			testLibrary.avatar.codex,
			testLibrary.avatar.s1.codex,
			testLibrary.avatar.s1.e1.codex,
			testLibrary.avatar.s1.e1.page000,
			testLibrary.avatar.s1.e1.page001,
		]);
	}

	private async moveE1ToE2() {
		this.librarian.backgroundFileService.move([
			{
				from: testLibrary.avatar.s1.e1.codex,
				to: testLibrary.avatar.s1.e2.codex,
			},
			{
				from: testLibrary.avatar.s1.e1.page000,
				to: testLibrary.avatar.s1.e2.page000,
			},
			{
				from: testLibrary.avatar.s1.e1.page001,
				to: testLibrary.avatar.s1.e2.page001,
			},
		]);
	}

	private async trashE2() {
		this.librarian.backgroundFileService.trash([
			testLibrary.avatar.s1.e2.codex,
			testLibrary.avatar.s1.e2.page000,
			testLibrary.avatar.s1.e2.page001,
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
