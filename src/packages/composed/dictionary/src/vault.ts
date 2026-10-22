import { WORTER_FOLDER } from "@textfresser/lemma-note-codec";
import {
	type AnySplitPath,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	type VamSubscribeOptions,
	type VaultActionManager,
	VaultPath,
} from "@textfresser/vault-action-manager";

/** The store's name in VAM, for its dispatches and its subscriptions. */
export const DICTIONARY_CALLER = "dictionary";

/**
 * What the store hears: every change under `Worter/` but its own writes,
 * so other callers (the reset, the metadata migration, Textfresser's
 * commands) may write there and the index follows. Handling is
 * idempotent: an event names paths, and the store reads them again.
 */
export const DICTIONARY_EVENTS: VamSubscribeOptions = {
	caller: DICTIONARY_CALLER,
	from: "allButMine",
};

/** The part of VAM the store uses. */
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
