import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { stringifySplitPath } from "../internal/stringify-split-path";

export function toSourcePath(
	splitPath?: SplitPathToMdFile,
): string | undefined {
	return splitPath ? stringifySplitPath(splitPath) : undefined;
}
