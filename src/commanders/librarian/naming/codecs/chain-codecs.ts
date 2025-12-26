import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import { PathPartsSchema } from "../../../../obsidian-vault-action-manager/types/split-path";
import { JoinedCanonicalBasenameSchema } from "../types/canonical/joined-canonical";
import { SeparatedCanonicalBasenameSchema } from "../types/canonical/separated-canonical";
import { NodeNameChainSchema } from "../types/node-name";
import {
	joinSeparatedCanonicalBasename,
	separateJoinedCanonicalBasename,
} from "../types/transformers";

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
export const pathPartsToNodeNameChainCodec = z.codec(
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
export const separatedCanonicalBasenameToNodeNameChainCodec = z.codec(
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

/**
 * Zod codec from CanonicalBasename to SeparatedCanonicalBasename.
 * Converts suffixed basename string to parsed basename object.
 *
 * @example
 * // Decode: "NoteName-child-parent" -> { nodeName: "NoteName", splitSuffix: ["child", "parent"] }
 * // Encode: { nodeName: "NoteName", splitSuffix: ["child", "parent"] } -> "NoteName-child-parent"
 *
 * Reads settings internally to get suffix delimiter.
 */
export const joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec = z.codec(
	JoinedCanonicalBasenameSchema,
	SeparatedCanonicalBasenameSchema,
	{
		decode: (joined) => {
			return separateJoinedCanonicalBasename(joined);
		},
		encode: (separated) => {
			return joinSeparatedCanonicalBasename(separated);
		},
	},
);
