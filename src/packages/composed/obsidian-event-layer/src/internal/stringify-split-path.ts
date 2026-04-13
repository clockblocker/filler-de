import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";

export function stringifySplitPath(splitPath: SplitPathToMdFile): string {
	return [
		...splitPath.pathParts,
		`${splitPath.basename}.${splitPath.extension}`,
	].join("/");
}
