import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import {
	PathPartsSchema,
	type SplitPath,
} from "../../../../obsidian-vault-action-manager/types/split-path";
import type { NodeNameChain } from "../..";
import { NodeNameChainSchema } from "../types/node-name";

/**
 * Zod codec from PathParts to NodeNameChain.
 * Converts filesystem path parts (with library root) to node name chain (without library root).
 *
 * @example
 * // Decode: ["Library", "parent", "child"] -> ["parent", "child"]
 * // Encode: ["parent", "child"] -> ["Library", "parent", "child"]
 *
 * Reads settings internally to get library root basename.
 */
const pathPartsToNodeNameChainCodec = z.codec(
	PathPartsSchema,
	NodeNameChainSchema,
	{
		decode: (pathParts) => {
			return pathParts.slice(1);
		},
		encode: (chain) => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			return [libraryRoot, ...chain];
		},
	},
);

export const makePathPartsFromNodeNameChain = (
	chain: NodeNameChain,
): SplitPath["pathParts"] => {
	return pathPartsToNodeNameChainCodec.encode(chain);
};

export const makeNodeNameChainFromPathParts = (
	pathParts: SplitPath["pathParts"],
): NodeNameChain => {
	return pathPartsToNodeNameChainCodec.decode(pathParts);
};
