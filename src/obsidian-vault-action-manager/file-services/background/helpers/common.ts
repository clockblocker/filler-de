import { TFile, TFolder, type Vault } from "obsidian";
import { pathToFolderFromPathParts } from "../../../helpers/pathfinder";
import {
	type SplitPathToFile,
	type SplitPathToMdFile,
	SplitPathType,
} from "../../../types/split-path";

export async function getExistingBasenamesInFolder<
	SPF extends SplitPathToMdFile | SplitPathToFile,
>(target: SPF, vault: Vault): Promise<Set<string>> {
	const folderPath = pathToFolderFromPathParts(target.pathParts);
	const targetFolder = vault.getAbstractFileByPath(folderPath);

	const existingBasenames = new Set<string>();
	const targetExtension =
		target.type === SplitPathType.MdFile
			? "md"
			: target.type === SplitPathType.File
				? target.extension
				: undefined;

	if (targetFolder && targetFolder instanceof TFolder && targetExtension) {
		for (const child of targetFolder.children) {
			if (
				child instanceof TFile &&
				child.extension.toLowerCase() === targetExtension.toLowerCase()
			) {
				existingBasenames.add(child.basename);
			}
		}
	}

	return existingBasenames;
}

export type CollisionStrategy = "rename" | "skip";
