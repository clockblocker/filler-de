import type { TFolder } from "obsidian";
import { systemPathFromSplitPath } from "../../../obsidian-vault-action-manager/helpers/pathfinder";
import type {
	SplitPathToFile,
	SplitPathToFileWithTRef,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathToMdFileWithTRef,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import { extractMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { LibraryTree } from "../library-tree";
import { isCodexBasename } from "../utils/codex-utils";
import {
	splitPathToLeaf,
	withStatusFromMeta,
} from "../utils/split-path-to-leaf";

/**
 * Read tree from existing vault.
 * Lists all files in the library root and builds a LibraryTree.
 */
export async function readTreeFromVault(
	libraryRoot: string,
	suffixDelimiter: string,
	context: TreeReaderContext,
): Promise<LibraryTree> {
	const rootSplitPath = context.splitPath(libraryRoot);
	if (rootSplitPath.type !== SplitPathType.Folder) {
		throw new Error(`Library root is not a folder: ${libraryRoot}`);
	}

	const rootFolder = await context.getAbstractFile(rootSplitPath);
	if (!rootFolder) {
		throw new Error(`Library root not found: ${libraryRoot}`);
	}

	const allEntries = await context.listAll(rootSplitPath);
	const fileEntries = allEntries.filter(
		(entry): entry is SplitPathToFileWithTRef | SplitPathToMdFileWithTRef =>
			(entry.type === SplitPathType.File ||
				entry.type === SplitPathType.MdFile) &&
			// Skip codex files - they're generated, not source data
			!isCodexBasename(entry.basename),
	);

	// Create leaves and preserve original paths for reading content
	const leavesWithPaths = fileEntries.map((entry) => {
		const leaf = splitPathToLeaf(entry, libraryRoot, suffixDelimiter);
		// Build original path from splitPath (includes suffix in basename)
		// Use systemPathFromSplitPath to correctly construct the path
		const originalPath = systemPathFromSplitPath(entry);
		return { leaf, originalPath };
	});

	// Read content using original paths (not reconstructed from tree)
	const readContent = (path: string) => {
		const sp = context.splitPath(path);
		if (sp.type !== SplitPathType.MdFile) {
			return Promise.resolve("");
		}
		return context.readContent(sp);
	};

	const leaves = await Promise.all(
		leavesWithPaths.map(({ leaf, originalPath }) =>
			withStatusFromMeta(
				leaf,
				originalPath,
				readContent,
				extractMetaInfo,
			),
		),
	);

	return new LibraryTree(leaves, rootFolder);
}

export type TreeReaderContext = {
	splitPath: (
		path: string,
	) => SplitPathToFolder | SplitPathToFile | SplitPathToMdFile;
	getAbstractFile: (splitPath: SplitPathToFolder) => Promise<TFolder | null>;
	listAll: (
		splitPath: SplitPathToFolder,
	) => Promise<
		Array<
			| SplitPathToFileWithTRef
			| SplitPathToMdFileWithTRef
			| SplitPathToFolder
		>
	>;
	readContent: (splitPath: SplitPathToMdFile) => Promise<string>;
};
