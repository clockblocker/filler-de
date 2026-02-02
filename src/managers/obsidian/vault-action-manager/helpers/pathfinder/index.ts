// Core split-path functions

// System path <-> split path conversion
export {
	splitPathFromSystemPathInternal,
	systemPathFromSplitPathInternal,
} from "./path-codecs/system-and-any-split/system-path-and-split-path-codec";
export type { MdFileWithContentDto } from "./path-utils";
// Path utilities
export {
	findFirstAvailableIndexedPath,
	pathToFolderFromPathParts,
	SPLIT_PATH_TO_ROOT_FOLDER,
} from "./path-utils";
export { splitPathFromAbstractInternal } from "./split-path-from-abstract";
export type {
	DiscriminatedSplitPath,
	DiscriminatedTAbstractFile,
} from "./types";
