import z from "zod";
import {
	type SplitPath,
	SplitPathSchema,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import {
	type SuffixedSplitPath,
	SuffixedSplitPathSchema,
} from "../../types/suffixed/suffixed-split-paths";
import {
	makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename,
	makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename,
} from "../atomic/joined-canonical-basename-and-separated-canonical-basename";

/**
 * Zod codec from SplitPath to SuffixedSplitPath.
 * Converts filesystem split path to canonical split path.
 * The only difference is the basename type (string → JoinedSuffixedBasename).
 *
 * @example
 * // Decode: { basename: "NoteName-child-parent", pathParts: ["Library"], type: "MdFile" }
 * //   → { basename: "NoteName-child-parent", pathParts: ["Library"], type: "MdFile" }
 * // Encode: { basename: "NoteName-child-parent", pathParts: ["Library"], type: "MdFile" }
 * //   → { basename: "NoteName-child-parent", pathParts: ["Library"], type: "MdFile" }
 */
const splitPathToSuffixedSplitPathCodec = z.codec(
	SplitPathSchema,
	SuffixedSplitPathSchema,
	{
		decode: (splitPath): SuffixedSplitPath => {
			return {
				...splitPath,
				basename:
					makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(
						makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
							splitPath.basename,
						),
					),
			};
		},
		encode: (canonical): SplitPath => {
			return canonical;
		},
	},
);

export const tryMakeSuffixedSplitPathFromSplitPath = (
	splitPath: SplitPath,
): SuffixedSplitPath => {
	return splitPathToSuffixedSplitPathCodec.decode(splitPath);
};

export const makeSplitPathFromSuffixedSplitPath = (
	canonical: SuffixedSplitPath,
): SplitPath => {
	return splitPathToSuffixedSplitPathCodec.encode(canonical);
};
