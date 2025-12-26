import { Result, ResultAsync } from "neverthrow";
import z, { type ZodError } from "zod";
import {
	type SplitPath,
	SplitPathSchema,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import {
	type CanonicalSplitPath,
	CanonicalSplitPathSchema,
} from "../../types/canonical/split-path/canonical-split-paths";
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

export const makeCanonicalSplitPathFromSplitPathAsync = (
	splitPath: SplitPath,
) =>
	Result.fromThrowable(
		() => splitPathToCanonicalSplitPathCodec.decode(splitPath),
		(e) => e as ZodError,
	)();

export const makeSplitPathFromCanonicalSplitPath = (
	canonical: CanonicalSplitPath,
) =>
	Result.fromThrowable(
		() => splitPathToCanonicalSplitPathCodec.encode(canonical),
		(e) => e as ZodError,
	)();
