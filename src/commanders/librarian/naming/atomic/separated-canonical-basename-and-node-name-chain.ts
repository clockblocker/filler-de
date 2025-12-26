import z from "zod";
import type { NodeNameChain } from "../..";
import {
	type SeparatedCanonicalBasename,
	SeparatedCanonicalBasenameSchema,
} from "../types/canonical/separated-canonical";
import { NodeNameChainSchema } from "../types/node-name";

/**
 * Zod codec from SeparatedCanonicalBasename to NodeNameChain.
 * Converts parsed basename to node name chain.
 *
 * @example
 * // Decode: { nodeName: "child", splitSuffix: ["parent"] } -> ["parent", "child"]
 * // Encode: ["parent", "child"] -> { nodeName: "child", splitSuffix: ["parent"] }
 *
 * Reads settings internally to get suffix delimiter.
 */
const separatedCanonicalBasenameToNodeNameChainCodec = z.codec(
	SeparatedCanonicalBasenameSchema,
	NodeNameChainSchema,
	{
		decode: ({ splitSuffix, nodeName }) => {
			return [...splitSuffix, nodeName];
		},
		encode: (chain) => {
			if (chain.length === 0) {
				return { nodeName: "", splitSuffix: [] };
			}

			const nodeName = chain[chain.length - 1];
			if (!nodeName) {
				return { nodeName: "", splitSuffix: [] };
			}

			const splitSuffix = chain.slice(0, -1);
			return { nodeName, splitSuffix };
		},
	},
);

export const makeSeparatedCanonicalBasenameFromNodeNameChain = (
	chain: NodeNameChain,
): SeparatedCanonicalBasename => {
	return separatedCanonicalBasenameToNodeNameChainCodec.encode(chain);
};

export const makeNodeNameChainFromSeparatedCanonicalBasename = (
	separated: SeparatedCanonicalBasename,
): NodeNameChain => {
	return separatedCanonicalBasenameToNodeNameChainCodec.decode(separated);
};
