import type { AnySplitPath } from "@textfresser/vault-action-manager";

export function splitPathsEqual(a: AnySplitPath, b: AnySplitPath): boolean {
	if (a.kind !== b.kind) return false;
	if (a.basename !== b.basename) return false;
	if (a.pathParts.length !== b.pathParts.length) return false;

	for (let i = 0; i < a.pathParts.length; i++) {
		if (a.pathParts[i] !== b.pathParts[i]) {
			return false;
		}
	}

	if ("extension" in a && "extension" in b && a.extension !== b.extension) {
		return false;
	}

	return true;
}
