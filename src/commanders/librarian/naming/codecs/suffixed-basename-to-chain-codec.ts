import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import {
	type CoreNameChainFromRoot,
	CoreNameChainFromRootSchema,
} from "../../types/split-basename";

/**
 * Zod codec from section basename (without prefix) to CoreNameChainFromRoot.
 * Decodes section basename (e.g., "Library" or "Child-Parent") to section chain.
 * Reads settings internally.
 */
export const suffixedBasenameToChainCodec = z.codec(
	z.string(),
	CoreNameChainFromRootSchema,
	{
		decode: (cleanBasename: string): CoreNameChainFromRoot => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			if (cleanBasename === libraryRoot) {
				return [];
			}

			const parts = cleanBasename.split(settings.suffixDelimiter);
			return parts.toReversed();
		},
		encode: (chain: CoreNameChainFromRoot): string => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			if (chain.length === 0) {
				return libraryRoot;
			}

			const sectionCoreName = chain[chain.length - 1];
			if (!sectionCoreName) {
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
				? `${sectionCoreName}${settings.suffixDelimiter}${suffix}`
				: sectionCoreName;
		},
	},
);
