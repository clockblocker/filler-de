import type { Librarian } from "../../commanders/librarian/librarian";
import {
	type ObsidianVaultActionManager,
	splitPath,
} from "../../obsidian-vault-action-manager";
import type { SplitPathToMdFile } from "../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../obsidian-vault-action-manager/types/vault-action";
import { testLibrary } from "./consts";

export class LibrarianTester {
	private librarian: Librarian;
	private manager: ObsidianVaultActionManager;

	constructor(librarian: Librarian) {
		this.librarian = librarian;
		this.manager = librarian.manager;
	}

	async testFileMethods() {
		await this.createAvatarS1E1();
		await sleep(100);
		await this.moveE1ToE2();
		await sleep(100);
		await this.trashE2();
	}

	async createAvatar() {
		await this.createAvatarS1E1();
		await sleep(100);
		await this.moveE1ToE2();
	}

	private async createAvatarS1E1() {
		const actions: VaultAction[] = [
			testLibrary.avatar.codex,
			testLibrary.avatar.s1.codex,
			testLibrary.avatar.s1.e1.codex,
			testLibrary.avatar.s1.e1.page000,
			testLibrary.avatar.s1.e1.page001,
		].map((p) => ({
			payload: this.toMd(p),
			type: VaultActionType.CreateMdFile,
		}));
		await this.manager.dispatch(actions);
	}

	private async moveE1ToE2() {
		const actions: VaultAction[] = [
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
		].map((p) => ({
			payload: {
				from: this.toMd(p.from),
				to: this.toMd(p.to),
			},
			type: VaultActionType.RenameMdFile,
		}));
		await this.manager.dispatch(actions);
	}

	private async trashE2() {
		const actions: VaultAction[] = [
			testLibrary.avatar.s1.e2.codex,
			testLibrary.avatar.s1.e2.page000,
			testLibrary.avatar.s1.e2.page001,
		].map((p) => ({
			payload: this.toMd(p),
			type: VaultActionType.TrashMdFile,
		}));
		await this.manager.dispatch(actions);
	}

	private toMd(p: {
		basename: string;
		pathParts: string[];
	}): SplitPathToMdFile {
		const path = [...p.pathParts, `${p.basename}.md`].join("/");
		return splitPath(path) as SplitPathToMdFile;
	}
}

// async ls() {
// 	const files = await this.librarian.backgroundFileService.deepListFiles({
// 		basename: "Library",
// 		pathParts: [],
// 		type: "folder",
// 	});
// }
