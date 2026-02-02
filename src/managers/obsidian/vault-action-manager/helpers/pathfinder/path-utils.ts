import type { AnySplitPath, SplitPathToFolder } from "../../types/split-path";
import { SplitPathKind } from "../../types/split-path";

export function pathToFolderFromPathParts(pathParts: string[]): string {
	const cleaned = pathParts
		.filter(Boolean)
		.map((p) => p.replace(/(^[\\/]+)|([\\/]+$)/g, ""))
		.filter((p) => p.length > 0);
	return cleaned.join("/");
}

export const SPLIT_PATH_TO_ROOT_FOLDER: SplitPathToFolder = {
	basename: "",
	kind: SplitPathKind.Folder,
	pathParts: [],
} as const;

/**
 * Finds the first available indexed filename in the target folder.
 * Pattern: `${index}_${basename}.md` (e.g., `1_file.md`, `2_file.md`)
 */
export async function findFirstAvailableIndexedPath<SP extends AnySplitPath>(
	target: SP,
	existingBasenames: Set<string>,
): Promise<SP> {
	let index = 1;
	let indexedBasename: string;

	while (true) {
		indexedBasename = `${index}_${target.basename}`;
		if (!existingBasenames.has(indexedBasename)) {
			break;
		}
		index += 1;
	}

	return {
		...target,
		basename: indexedBasename,
	};
}
