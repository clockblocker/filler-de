import { TFile, TFolder, type Vault } from "obsidian";
import { pathToFolderFromPathParts } from "../../../helpers/pathfinder";
import type { AnySplitPath } from "../../../types/split-path";
import { SplitPathKind } from "../../../types/split-path";

export async function getExistingBasenamesInFolder<SPF extends AnySplitPath>(
	target: SPF,
	vault: Vault,
): Promise<Set<string>> {
	const folderPath = pathToFolderFromPathParts(target.pathParts);
	const targetFolder = vault.getAbstractFileByPath(folderPath);

	const existingBasenames = new Set<string>();

	if (!targetFolder || !(targetFolder instanceof TFolder)) {
		return existingBasenames;
	}

	if (target.type === SplitPathKind.Folder) {
		// For folders, collect all folder basenames
		for (const child of targetFolder.children) {
			if (child instanceof TFolder) {
				existingBasenames.add(child.name);
			}
		}
	} else {
		// For files, collect basenames matching the extension
		const targetExtension =
			target.type === SplitPathKind.MdFile
				? "md"
				: target.type === SplitPathKind.File
					? target.extension
					: undefined;

		if (targetExtension) {
			for (const child of targetFolder.children) {
				if (
					child instanceof TFile &&
					child.extension.toLowerCase() ===
						targetExtension.toLowerCase()
				) {
					existingBasenames.add(child.basename);
				}
			}
		}
	}

	return existingBasenames;
}

export type CollisionStrategy = "rename" | "skip";
