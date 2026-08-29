import { Effect } from "effect";
import { TFile, TFolder } from "obsidian";
import { VaultIo } from "../../../effect/ports";
import { pathfinder } from "../../../helpers/pathfinder";
import { MD } from "../../../types/literals";
import type { AnySplitPath } from "../../../types/split-path";
import { SplitPathKind } from "../../../types/split-path";

export const getExistingBasenamesInFolder = Effect.fn(
	"getExistingBasenamesInFolder",
)(function* <SPF extends AnySplitPath>(target: SPF) {
	const vault = yield* VaultIo;
	const folderPath = pathfinder.pathToFolderFromPathParts(target.pathParts);
	const targetFolder = yield* vault.getAbstractFileByPath(folderPath);
	const existingBasenames = new Set<string>();

	if (!(targetFolder instanceof TFolder)) return existingBasenames;

	if (target.kind === SplitPathKind.Folder) {
		for (const child of targetFolder.children) {
			if (child instanceof TFolder) existingBasenames.add(child.name);
		}
		return existingBasenames;
	}

	const targetExtension =
		target.kind === SplitPathKind.MdFile
			? MD
			: target.kind === SplitPathKind.File
				? target.extension
				: undefined;
	if (!targetExtension) return existingBasenames;

	for (const child of targetFolder.children) {
		if (
			child instanceof TFile &&
			child.extension.toLowerCase() === targetExtension.toLowerCase()
		) {
			existingBasenames.add(child.basename);
		}
	}

	return existingBasenames;
});

export type CollisionStrategy = "rename" | "skip";
