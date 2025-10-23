import type { PrettyPathToMdFile } from "../../../../../types/common-interface/dtos";
import type { SplitPathToFile } from "../types";

export function prettyPathToSplitPath(
	prettyPath: PrettyPathToMdFile,
): SplitPathToFile {
	return {
		...prettyPath,
		extension: "md",
		type: "file",
	};
}
