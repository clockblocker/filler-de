import { err, ok, type Result } from "neverthrow";
import type {
	SplitPathToFolder,
	SplitPathWithReader,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import { extractMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { TreeNodeStatus } from "../../librarin-shared/types/tree-node";
import { LibraryTree } from "../library-tree";
import { tryParseJoinedSuffixedBasenameForCodex } from "../naming/codecs/atomic/parsers";
import { splitPathToLeafDeprecated } from "../utils/split-path-to-leaf";

/**
 * Read tree from split files with readers.
 * Builds a LibraryTree from provided files.
 * Reads libraryRoot and suffixDelimiter from global settings.
 */
export async function readTreeFromSplitFilesWithReaders({
	splitPathToLibraryRoot,
	files,
}: {
	splitPathToLibraryRoot: SplitPathToFolder;
	files: SplitPathWithReader[];
}): Promise<Result<LibraryTree, string>> {
	if (splitPathToLibraryRoot.type !== SplitPathType.Folder) {
		return err(
			`Library root is not a folder: ${splitPathToLibraryRoot.basename}`,
		);
	}

	// Filter out codex files (generated, not source data)
	const fileEntries = files.filter(
		(entry) =>
			(entry.type === SplitPathType.File ||
				entry.type === SplitPathType.MdFile) &&
			tryParseJoinedSuffixedBasenameForCodex(entry.basename).isOk(),
	);

	// Create leaves and read content using read() from SplitPathWithReader
	const leaves = await Promise.all(
		fileEntries.map(async (entry) => {
			const leaf = splitPathToLeafDeprecated(entry);

			// Read content if md file (has read function)
			if (entry.type === SplitPathType.MdFile && "read" in entry) {
				const contentResult = await entry.read();
				if (contentResult.isOk()) {
					const meta = extractMetaInfo(contentResult.value);
					if (meta && "status" in meta) {
						leaf.status =
							meta.status === "Done"
								? TreeNodeStatus.Done
								: TreeNodeStatus.NotStarted;
					}
				}
			}

			return leaf;
		}),
	);

	return ok(new LibraryTree(leaves));
}
