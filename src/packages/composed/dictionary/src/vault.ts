import { WORTER_FOLDER } from "@textfresser/lemma-note-codec";
import {
	type AnySplitPath,
	type SplitPathToFile,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	type VaultActionManager,
	VaultPath,
} from "@textfresser/vault-action-manager";

/**
 * The part of VAM the store uses. The store is the only writer under
 * `Worter/`: VAM suppresses its own writes as Self Events, so a write that
 * bypassed the store would be invisible to the index.
 */
export type DictionaryVault = Pick<
	VaultActionManager,
	| "dispatchStopOnFirstFailure"
	| "exists"
	| "readContentWithStat"
	| "scanWithStat"
	| "subscribeToBulk"
	| "subscribeToMdModifications"
>;

export const WORTER_SPLIT_PATH: SplitPathToFolder = {
	basename: WORTER_FOLDER,
	kind: "Folder",
	pathParts: [],
};

/** A vault path as the index keys it: `Worter/…/name.md`. */
export const formatPath = (splitPath: AnySplitPath): string =>
	splitPathCodec.format(splitPath);

export function mdSplitPath(path: string): SplitPathToMdFile {
	const splitPath = splitPathCodec.parse(path);
	if (splitPath.kind !== "MdFile")
		throw new Error(`Not a Markdown path: ${path}`);
	return splitPath;
}

/**
 * A Markdown path as a plain File, for `CreateFile`: Obsidian's
 * `vault.create` fails when the file exists, so a create never overwrites.
 */
export function createOnlySplitPath(path: string): SplitPathToFile {
	const { basename, pathParts } = mdSplitPath(path);
	return { basename, extension: "md", kind: "File", pathParts };
}

export function folderSplitPath(path: string): SplitPathToFolder {
	const splitPath = splitPathCodec.parse(path);
	if (splitPath.kind !== "Folder") throw new Error(`Not a folder: ${path}`);
	return splitPath;
}

/**
 * Whether a path lies below `Worter/`, the store's scope. Case-sensitive, as
 * the index keys paths and as Obsidian's lookup finds them.
 */
export const inScope = (path: string): boolean =>
	VaultPath.caseSensitive.isUnder(path, WORTER_FOLDER, { inclusive: false });

/** Whether a path is `folder` itself or below it, case-sensitively. */
export const isUnder = (path: string, folder: string): boolean =>
	VaultPath.caseSensitive.isUnder(path, folder, { inclusive: true });
