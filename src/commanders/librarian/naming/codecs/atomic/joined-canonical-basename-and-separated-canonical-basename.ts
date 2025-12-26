import z from "zod";
import type { SeparatedCanonicalBasename } from "../../..";
import {
	type JoinedCanonicalBasename,
	JoinedCanonicalBasenameSchema,
} from "../../types/canonical/joined-canonical";
import { SeparatedCanonicalBasenameSchema } from "../../types/canonical/separated-canonical";
import {
	joinSeparatedCanonicalBasename,
	separateJoinedCanonicalBasename,
} from "../../types/transformers";

/**
 * Zod codec from JoinedCanonicalBasename to SeparatedCanonicalBasename.
 * Converts suffixed basename string to parsed basename object.
 *
 * @example
 * // Decode: "NoteName-child-parent" -> { nodeName: "NoteName", splitSuffix: ["child", "parent"] }
 * // Encode: { nodeName: "NoteName", splitSuffix: ["child", "parent"] } -> "NoteName-child-parent"
 *
 * Reads settings internally to get suffix delimiter.
 */
const joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec = z.codec(
	JoinedCanonicalBasenameSchema,
	SeparatedCanonicalBasenameSchema,
	{
		decode: (joined) => separateJoinedCanonicalBasename(joined),
		encode: (separated) => joinSeparatedCanonicalBasename(separated),
	},
);

export const makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename = (
	joined: JoinedCanonicalBasename,
): SeparatedCanonicalBasename => {
	return joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode(
		joined,
	);
};

export const makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename = (
	separated: SeparatedCanonicalBasename,
): JoinedCanonicalBasename => {
	return joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode(
		separated,
	);
};
