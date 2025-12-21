import type { TFolder } from "obsidian";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import { extractMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { LibraryTree } from "../library-tree";
import { TreeNodeStatus } from "../types/tree-node";
import { isCodexBasename } from "../utils/codex-utils";
import { splitPathToLeaf } from "../utils/split-path-to-leaf";

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

	// Get all files with readers (single call)
	const allEntries = await context.listAllFilesWithMdReaders(rootSplitPath);
	const fileEntries = allEntries.filter(
		(entry): entry is SplitPathWithReader =>
			(entry.type === SplitPathType.File ||
				entry.type === SplitPathType.MdFile) &&
			// Skip codex files - they're generated, not source data
			!isCodexBasename(entry.basename),
	);

	// Create leaves and read content using read() from SplitPathWithReader
	const leaves = await Promise.all(
		fileEntries.map(async (entry) => {
			const leaf = splitPathToLeaf(entry, libraryRoot, suffixDelimiter);

			// Read content if md file (has read function)
			if (entry.type === SplitPathType.MdFile && "read" in entry) {
				const content = await entry.read();
				const meta = extractMetaInfo(content);
				if (meta && "status" in meta) {
					leaf.status =
						meta.status === "Done"
							? TreeNodeStatus.Done
							: TreeNodeStatus.NotStarted;
				}
			}

			return leaf;
		}),
	);

	return new LibraryTree(leaves, rootFolder);
}

export type TreeReaderContext = {
	splitPath: (
		path: string,
	) => SplitPathToFolder | SplitPathToFile | SplitPathToMdFile;
	getAbstractFile: (splitPath: SplitPathToFolder) => Promise<TFolder | null>;
	listAllFilesWithMdReaders: (
		splitPath: SplitPathToFolder,
	) => Promise<SplitPathWithReader[]>;
};
