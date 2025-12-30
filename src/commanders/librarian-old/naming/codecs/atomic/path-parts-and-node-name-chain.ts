import z from "zod";
import {
	PathPartsSchema,
	type SplitPath,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import type { NodeNameChainDeprecated } from "../../..";
import { NodeNameChainSchemaDeprecated } from "../../../types/schemas/node-name";

/**
 * Zod codec from PathParts to NodeNameChain.
 * Converts filesystem path parts (with library root) to node name chain (with library root).
 * After refactor: nodeNameChain now includes library root internally.
 *
 * @example
 * // Decode: ["Library", "parent", "child"] -> ["Library", "parent", "child"]
 * // Encode: ["Library", "parent", "child"] -> ["Library", "parent", "child"]
 *
 * Note: This is now a direct pass-through (no-op) since both include library root.
 */
const pathPartsToNodeNameChainCodec = z.codec(
	PathPartsSchema,
	NodeNameChainSchemaDeprecated,
	{
		decode: (pathParts) => {
			return pathParts;
		},
		encode: (chain) => {
			return chain;
		},
	},
);

export const makePathPartsFromNodeNameChain = (
	chain: NodeNameChainDeprecated,
): SplitPath["pathParts"] => {
	return pathPartsToNodeNameChainCodec.encode(chain);
};

export const makeNodeNameChainFromPathParts = (
	pathParts: SplitPath["pathParts"],
): NodeNameChainDeprecated => {
	return pathPartsToNodeNameChainCodec.decode(pathParts);
};
