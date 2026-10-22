import type { AnySplitPath, SplitPathToFolder } from "../../types/split-path";
import { SplitPathKind } from "../../types/split-path";

export function pathToFolderFromPathParts(pathParts: string[]): string {
	const cleaned = pathParts
		.filter(Boolean)
		.map((p) => p.replace(/(^[\\/]+)|([\\/]+$)/g, ""))
		.filter((p) => p.length > 0);
	return cleaned.join("/");
}

export const SPLIT_PATH_TO_ROOT_FOLDER: SplitPathToFolder = Object.freeze({
	basename: "",
	kind: SplitPathKind.Folder,
	pathParts: [],
});

/**
 * The first indexed variant of `target` that `isTaken` lets through:
 * `1_<basename>`, then `2_<basename>`, ….
 */
export function findFirstAvailableIndexedPath<SP extends AnySplitPath>(
	target: SP,
	isTaken: (candidate: SP) => boolean,
): SP {
	for (let index = 1; ; index += 1) {
		const candidate = {
			...target,
			basename: `${index}_${target.basename}`,
		};
		if (!isTaken(candidate)) return candidate;
	}
}
