import z from "zod";
import { getParsedUserSettings } from "../../../../../global-state/global-state";
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
 * // Decode: { nodeName: "child", splitSuffix: ["parent"] } -> ["Library", "parent", "child"]
 * // Encode: ["Library", "parent", "child"] -> { nodeName: "child", splitSuffix: ["parent"] }
 *
 * Reads settings internally to get suffix delimiter.
 */
const separatedSuffixedBasenameToNodeNameChainCodec = z.codec(
	SeparatedSuffixedBasenameSchema,
	NodeNameChainSchema,
	{
		decode: ({ splitSuffix, nodeName }): NodeNameChain => {
			const {
				splitPathToLibraryRoot: { basename: libraryRoot },
			} = getParsedUserSettings();

			const reversedSuffix = [...splitSuffix].reverse();
			return [libraryRoot, ...reversedSuffix, nodeName];
		},
		encode: (chain: NodeNameChain): SeparatedSuffixedBasename => {
			const {
				splitPathToLibraryRoot: { basename: libraryRoot },
			} = getParsedUserSettings();

			const chainWithoutLibraryRoot =
				chain.length > 0 && chain[0] === libraryRoot
					? chain.slice(1)
					: chain;

			const nodeName =
				chainWithoutLibraryRoot[chainWithoutLibraryRoot.length - 1];
			if (!nodeName) {
				throw new Error("Empty chain cannot be encoded");
			}

			const parentChain = chainWithoutLibraryRoot.slice(0, -1);
			const splitSuffix = [...parentChain].reverse();

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
