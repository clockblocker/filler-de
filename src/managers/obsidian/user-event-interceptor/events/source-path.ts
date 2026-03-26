import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { stringifySplitPath } from "../../../../stateless-helpers/split-path-comparison";

export function toSourcePath(splitPath?: SplitPathToMdFile): string | undefined {
	return splitPath ? stringifySplitPath(splitPath) : undefined;
}
