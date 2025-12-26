import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import { type NodeNameChain, NodeNameChainSchema } from "../schemas/node-name";

/**
 * Zod codec from section basename (without prefix) to NodeNameChain.
 * Decodes section basename (e.g., "Library" or "Child-Parent") to section chain.
 * Reads settings internally.
 */
export const canonicalBasenameToChainCodec = z.codec(
	z.string(),
	NodeNameChainSchema,
	{
		decode: (cleanBasename: string): NodeNameChain => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			if (cleanBasename === libraryRoot) {
				return [];
			}

			const parts = cleanBasename.split(settings.suffixDelimiter);
			return parts.toReversed();
		},
		encode: (chain: NodeNameChain): string => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			if (chain.length === 0) {
				return libraryRoot;
			}

			const sectionNodeName = chain[chain.length - 1];
			if (!sectionNodeName) {
				// Fallback (should not happen, but type-safe)
				return libraryRoot;
			}

			const suffix =
				chain.length > 1
					? chain
							.slice(0, -1)
							.reverse()
							.join(settings.suffixDelimiter)
					: "";

			return suffix
				? `${sectionNodeName}${settings.suffixDelimiter}${suffix}`
				: sectionNodeName;
		},
	},
);
