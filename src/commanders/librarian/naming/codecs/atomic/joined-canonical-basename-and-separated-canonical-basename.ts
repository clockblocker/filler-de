import z from "zod";
import type { SeparatedSuffixedBasename } from "../../..";
import {
	type JoinedSuffixedBasename,
	JoinedSuffixedBasenameSchema,
} from "../../types/suffixed/joined-canonical";
import { SeparatedSuffixedBasenameSchema } from "../../types/suffixed/separated-canonical";
import {
	joinSeparatedSuffixedBasename,
	separateJoinedSuffixedBasename,
} from "../../types/transformers";

/**
 * Zod codec from JoinedSuffixedBasename to SeparatedSuffixedBasename.
 * Converts suffixed basename string to parsed basename object.
 *
 * @example
 * // Decode: "NoteName-child-parent" -> { nodeName: "NoteName", splitSuffix: ["child", "parent"] }
 * // Encode: { nodeName: "NoteName", splitSuffix: ["child", "parent"] } -> "NoteName-child-parent"
 *
 * Reads settings internally to get suffix delimiter.
 */
const joinedCanonicalBasenameToSeparatedSuffixedBasenameCodec = z.codec(
	JoinedSuffixedBasenameSchema,
	SeparatedSuffixedBasenameSchema,
	{
		decode: (joined) => separateJoinedSuffixedBasename(joined),
		encode: (separated) => joinSeparatedSuffixedBasename(separated),
	},
);

export const makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename = (
	joined: JoinedSuffixedBasename,
): SeparatedSuffixedBasename => {
	return joinedCanonicalBasenameToSeparatedSuffixedBasenameCodec.decode(
		joined,
	);
};

export const makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename = (
	separated: SeparatedSuffixedBasename,
): JoinedSuffixedBasename => {
	return joinedCanonicalBasenameToSeparatedSuffixedBasenameCodec.encode(
		separated,
	);
};
