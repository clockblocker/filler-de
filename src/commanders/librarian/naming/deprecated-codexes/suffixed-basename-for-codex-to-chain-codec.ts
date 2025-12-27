import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import { CODEX_CORE_NAME } from "../../types/literals";
import { type NodeNameChain, NodeNameChainSchema } from "../types/node-name";
import { canonicalBasenameToChainCodec } from "./suffixed-basename-to-chain-codec";

/**
 * Zod schema for codex basenames.
 * Validates that string starts with CODEX_PREFIX and has content after it.
 */
export const CanonicalBasenameForСodexSchema = z
	.string()
	.refine((val) => val.startsWith(CODEX_CORE_NAME), {
		message: `must start with "${CODEX_CORE_NAME}"`,
	})
	.refine(
		(val) => {
			// After CODEX_CORE_NAME, must have suffix delimiter + content (like any regular filename)
			const afterNodeName = val.slice(CODEX_CORE_NAME.length);
			if (afterNodeName.length === 0) {
				return false;
			}
			const settings = getParsedUserSettings();
			return afterNodeName.startsWith(settings.suffixDelimiter);
		},
		{
			message: "Empty after prefix",
		},
	);

/**
 * Zod codec from codex basename to NodeNameChain (parent section chain).
 * Decodes codex basename (e.g., "__-Library" or "__-Child-Parent") to parent section chain.
 * Uses sectionBasenameToChainCodec internally.
 * Reads settings internally.
 */
export const suffixedBasenameForСodexToParentSectionChainCodec = z.codec(
	CanonicalBasenameForСodexSchema,
	NodeNameChainSchema,
	{
		decode: (CanonicalBasenameForСodex) => {
			return canonicalBasenameToChainCodec
				.decode(CanonicalBasenameForСodex)
				.slice(0, -1);
		},
		encode: (chain) => {
			// Codex is just a regular file with nodeName "__"
			return canonicalBasenameToChainCodec.encode([
				...chain,
				CODEX_CORE_NAME,
			]);
		},
	},
);

/**
 * Zod codec from codex basename to NodeNameChain (full section chain).
 * Decodes codex basename (e.g., "__-Library" or "__-Child-Parent") to full section chain.
 * Handles root case, library validation, delimiter parsing.
 * Reads settings internally.
 */
export const codexBasenameToSectionChainCodec = z.codec(
	CanonicalBasenameForСodexSchema,
	NodeNameChainSchema,
	{
		decode: (codexBasename: string): NodeNameChain => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			const fullChain =
				canonicalBasenameToChainCodec.decode(codexBasename);

			const sectionChain = fullChain.slice(0, -1);

			// Handle root case: if section chain is [libraryRoot], return []
			if (sectionChain.length === 1 && sectionChain[0] === libraryRoot) {
				return [];
			}

			return sectionChain;
		},
		encode: (sectionChain: NodeNameChain): string => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			// For root (empty chain), encode as libraryRoot
			const fullChain =
				sectionChain.length === 0
					? [libraryRoot, CODEX_CORE_NAME]
					: [...sectionChain, CODEX_CORE_NAME];

			return canonicalBasenameToChainCodec.encode(fullChain);
		},
	},
);
