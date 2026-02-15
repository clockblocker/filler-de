import {
	abstractFromSplitPathInternal,
	splitPathFromAbstractInternal,
} from "./path-codecs/split-and-abstract";
import {
	splitPathFromSystemPathInternal,
	systemPathFromSplitPathInternal,
} from "./path-codecs/system-and-any-split/system-path-and-split-path-codec";
import {
	findFirstAvailableIndexedPath,
	pathToFolderFromPathParts,
	SPLIT_PATH_TO_ROOT_FOLDER,
} from "./path-utils";

export const pathfinder = {
	abstractFromSplitPath: abstractFromSplitPathInternal,
	findFirstAvailableIndexedPath,
	pathToFolderFromPathParts,
	SPLIT_PATH_TO_ROOT_FOLDER,
	splitPathFromAbstract: splitPathFromAbstractInternal,
	splitPathFromSystemPath: splitPathFromSystemPathInternal,
	systemPathFromSplitPath: systemPathFromSplitPathInternal,
} as const;

// Types
export type {
	DiscriminatedSplitPath,
	DiscriminatedTAbstractFile,
	MdFileWithContentDto,
} from "./types";
