import z from "zod";
import {
	type SplitPath,
	SplitPathSchema,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import {
	type CanonicalSplitPath,
	CanonicalSplitPathSchema,
} from "../../types/suffixed/suffixed-split-paths";
import {
	makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename,
	makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename,
} from "../atomic/joined-canonical-basename-and-separated-canonical-basename";

/**
 * Zod codec from SplitPath to CanonicalSplitPath.
 * Converts filesystem split path to canonical split path.
 * The only difference is the basename type (string → JoinedCanonicalBasename).
 *
 * @example
 * // Decode: { basename: "NoteName-child-parent", pathParts: ["Library"], type: "MdFile" }
 * //   → { basename: "NoteName-child-parent", pathParts: ["Library"], type: "MdFile" }
 * // Encode: { basename: "NoteName-child-parent", pathParts: ["Library"], type: "MdFile" }
 * //   → { basename: "NoteName-child-parent", pathParts: ["Library"], type: "MdFile" }
 */
const splitPathToCanonicalSplitPathCodec = z.codec(
	SplitPathSchema,
	CanonicalSplitPathSchema,
	{
		decode: (splitPath): CanonicalSplitPath => {
			return {
				...splitPath,
				basename:
					makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(
						makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
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

export const makeCanonicalSplitPathFromSplitPath = (
	splitPath: SplitPath,
): CanonicalSplitPath => {
	return splitPathToCanonicalSplitPathCodec.decode(splitPath);
};

export const makeSplitPathFromCanonicalSplitPath = (
	canonical: CanonicalSplitPath,
): SplitPath => {
	return splitPathToCanonicalSplitPathCodec.encode(canonical);
};
