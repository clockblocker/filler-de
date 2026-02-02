// Core split-path functions

export type {
	AbstractFileForSplitPath,
	MdFileWithContentDto,
} from "./path-utils";

export type {
	DiscriminatedSplitPath,
	DiscriminatedTAbstractFile,
} from "./types";

// Path utilities
export {
	findFirstAvailableIndexedPath,
	getSplitPathForAbstractFile,
	joinPosix,
	pathToFolderFromPathParts,
	SPLIT_PATH_TO_ROOT_FOLDER,
	safeFileName,
	splitPathToFolderFromCore,
	splitPathToMdFileFromCore,
} from "./path-utils";
export { splitPathFromAbstractInternal } from "./split-path-from-abstract";
// System path <-> split path conversion
export {
	splitPathFromSystemPathInternal,
	systemPathFromSplitPathInternal,
} from "./system-path-and-split-path-codec";
