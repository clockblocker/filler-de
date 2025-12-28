import z from "zod";
import {
	type NodeNameChain,
	NodeNameChainSchema,
} from "../../../types/schemas/node-name";
import {
	type SeparatedSuffixedBasename,
	SeparatedSuffixedBasenameSchema,
} from "../../types/suffixed/separated-suffixed";

/**
 * Zod codec from SeparatedSuffixedBasename to NodeNameChain.
 * Converts parsed basename to node name chain.
 *
 * @example
 * // Decode: { nodeName: "child", splitSuffix: ["parent"] } -> ["parent", "child"]
 * // Encode: ["parent", "child"] -> { nodeName: "child", splitSuffix: ["parent"] }
 *
 * Reads settings internally to get suffix delimiter.
 */
const separatedSuffixedBasenameToNodeNameChainCodec = z.codec(
	SeparatedSuffixedBasenameSchema,
	NodeNameChainSchema,
	{
		decode: ({ splitSuffix, nodeName }) => {
			return [...splitSuffix].reverse().concat(nodeName);
		},
		encode: (chain) => {
			if (chain.length === 0) {
				return { nodeName: "", splitSuffix: [] };
			}

			const nodeName = chain[chain.length - 1];
			if (!nodeName) {
				return { nodeName: "", splitSuffix: [] };
			}

			const splitSuffix = chain.slice(0, -1).reverse();
			return { nodeName, splitSuffix };
		},
	},
);

export const makeSeparatedSuffixedBasenameFromNodeNameChain = (
	chain: NodeNameChain,
): SeparatedSuffixedBasename => {
	return separatedSuffixedBasenameToNodeNameChainCodec.encode(chain);
};

export const makeNodeNameChainFromSeparatedSuffixedBasename = (
	separated: SeparatedSuffixedBasename,
): NodeNameChain => {
	return separatedSuffixedBasenameToNodeNameChainCodec.decode(separated);
};
