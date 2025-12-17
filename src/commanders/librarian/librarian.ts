import { TFolder } from "obsidian";
import type { ObsidianVaultActionManager } from "../../obsidian-vault-action-manager";
import type {
	SplitPathToFileWithTRef,
	SplitPathToMdFileWithTRef,
} from "../../obsidian-vault-action-manager/types/split-path";
import { LibraryTree } from "./library-tree";
import type { TreeLeaf } from "./types/tree-leaf";
import { splitPathToLeaf } from "./utils/split-path-to-leaf";

export class Librarian {
	constructor(
		private readonly vaultActionManager: ObsidianVaultActionManager,
		private readonly libraryRoot: string,
		private readonly suffixDelimiter: string = "-",
	) {}

	/**
	 * Read tree from existing vault.
	 * Lists all files in the library root and builds a LibraryTree.
	 */
	async readTreeFromVault(): Promise<LibraryTree> {
		const rootSplitPath = this.vaultActionManager.splitPath(
			this.libraryRoot,
		);
		if (rootSplitPath.type !== "Folder") {
			throw new Error(
				`Library root is not a folder: ${this.libraryRoot}`,
			);
		}

		const rootFolder =
			await this.vaultActionManager.getAbstractFile(rootSplitPath);
		if (!(rootFolder instanceof TFolder)) {
			throw new Error(`Library root not found: ${this.libraryRoot}`);
		}

		const allEntries = await this.vaultActionManager.listAll(rootSplitPath);
		const fileEntries = allEntries.filter(
			(
				entry,
			): entry is SplitPathToFileWithTRef | SplitPathToMdFileWithTRef =>
				entry.type === "File" || entry.type === "MdFile",
		);

		const leaves: TreeLeaf[] = fileEntries.map((entry) =>
			splitPathToLeaf(entry, this.libraryRoot, this.suffixDelimiter),
		);

		return new LibraryTree(leaves, rootFolder);
	}
}
