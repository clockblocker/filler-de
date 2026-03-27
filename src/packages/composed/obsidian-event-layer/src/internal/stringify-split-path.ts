import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";

export function stringifySplitPath(splitPath: SplitPathToMdFile): string {
	return [
		...splitPath.pathParts,
		`${splitPath.basename}.${splitPath.extension}`,
	].join("/");
}
