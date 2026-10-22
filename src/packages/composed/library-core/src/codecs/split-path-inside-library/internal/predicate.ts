import {
	type AnySplitPath,
	SplitPathKind,
} from "@textfresser/vault-action-manager";
import type { CodecRules } from "../../rules";

/**
 * Quick predicate to check if a vault-scoped split path is inside the library.
 * Inside means the Library root folder itself, or any path whose folders start
 * with the root's full path (`[...libraryRootPathParts, libraryRootName]`).
 */
export function checkIfInsideLibrary(
	rules: CodecRules,
	sp: AnySplitPath,
): boolean {
	const { pathParts } = sp;
	const rootParentParts = rules.libraryRootPathParts;
	const libraryPrefix = [...rootParentParts, rules.libraryRootName];

	const isLibraryRootFolder =
		sp.kind === SplitPathKind.Folder &&
		sp.basename === rules.libraryRootName &&
		pathParts.length === rootParentParts.length &&
		rootParentParts.every((part, index) => pathParts[index] === part);
	if (isLibraryRootFolder) return true;

	if (pathParts.length < libraryPrefix.length) return false;
	return libraryPrefix.every((part, index) => pathParts[index] === part);
}
