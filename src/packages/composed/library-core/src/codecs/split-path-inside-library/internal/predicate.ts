import {
	type AnySplitPath,
	SplitPathKind,
	splitPathCodec,
	VaultPath,
} from "@textfresser/vault-action-manager";
import {
	type CodecRules,
	isUnderLibraryRoot,
	libraryRootPath,
} from "../../rules";

/**
 * Quick predicate to check if a vault-scoped split path is inside the library.
 * Inside means the Library root folder itself, or any path whose folders start
 * with the root's full path (`[...libraryRootPathParts, libraryRootName]`).
 */
export function checkIfInsideLibrary(
	rules: CodecRules,
	sp: AnySplitPath,
): boolean {
	const path = splitPathCodec.format(sp);
	const root = libraryRootPath(rules);
	if (
		sp.kind === SplitPathKind.Folder &&
		VaultPath.caseSensitive.same(path, root)
	)
		return true;
	return isUnderLibraryRoot(path, root);
}
