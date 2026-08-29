import {
	splitPathFromSystemPathInternal,
	systemPathFromSplitPathInternal,
} from "./helpers/pathfinder/path-codecs/system-and-any-split/system-path-and-split-path-codec";
import { SPLIT_PATH_TO_ROOT_FOLDER } from "./helpers/pathfinder/path-utils";
import type {
	AnySplitPath,
	SplitPathToFolder,
} from "./types/split-path";

/**
 * The public seam for translating vault-scoped identities to and from system
 * paths. Obsidian objects are deliberately excluded from this interface.
 */
export type SplitPathCodec = {
	readonly format: (splitPath: AnySplitPath) => string;
	readonly parse: (systemPath: string) => AnySplitPath;
	readonly root: SplitPathToFolder;
};

export const splitPathCodec: SplitPathCodec = Object.freeze({
	format: systemPathFromSplitPathInternal,
	parse: splitPathFromSystemPathInternal,
	root: SPLIT_PATH_TO_ROOT_FOLDER,
});
