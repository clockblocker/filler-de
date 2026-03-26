import { TFile, TFolder, type Vault } from "obsidian";
import { pathfinder } from "../../../helpers/pathfinder";
import { MD } from "../../../types/literals";
import type { AnySplitPath } from "../../../types/split-path";
import { SplitPathKind } from "../../../types/split-path";

export async function getExistingBasenamesInFolder<SPF extends AnySplitPath>(
	target: SPF,
	vault: Vault,
): Promise<Set<string>> {
	const folderPath = pathfinder.pathToFolderFromPathParts(target.pathParts);
	const targetFolder = vault.getAbstractFileByPath(folderPath);

	const existingBasenames = new Set<string>();

	if (!targetFolder || !(targetFolder instanceof TFolder)) {
		return existingBasenames;
	}

	if (target.kind === SplitPathKind.Folder) {
		// For folders, collect all folder basenames
		for (const child of targetFolder.children) {
			if (child instanceof TFolder) {
				existingBasenames.add(child.name);
			}
		}
	} else {
		// For files, collect basenames matching the extension
		const targetExtension =
			target.kind === SplitPathKind.MdFile
				? MD
				: target.kind === SplitPathKind.File
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
