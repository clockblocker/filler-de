// Core split-path functions

export type {
	AbstractFileForSplitPath,
	MdFileWithContentDto,
} from "./path-utils";

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
export {
	makeSystemPathForSplitPath,
	splitPathFromAbstract,
	splitPathFromString,
} from "./split-path-core";
// Zod codec for system path <-> split path conversion
export {
	splitPathFromSystemPath,
	systemPathFromSplitPath,
	systemPathToSplitPath,
} from "./system-path-and-split-path-codec";
