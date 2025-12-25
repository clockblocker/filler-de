import z from "zod";
import { CODEX_CORE_NAME } from "../../types/literals";
import { CoreNameChainFromRootSchema } from "../../types/split-basename";
import { suffixedBasenameToChainCodec } from "./suffixed-basename-to-chain-codec";

/**
 * Zod schema for codex basenames.
 * Validates that string starts with CODEX_PREFIX and has content after it.
 */
export const SuffixedBasenameForСodexSchema = z
	.string()
	.refine((val) => val.startsWith(CODEX_CORE_NAME), {
		message: `Must start with "${CODEX_CORE_NAME}"`,
	})
	.refine((val) => val.slice(CODEX_CORE_NAME.length).length > 0, {
		message: "Empty after prefix",
	});

/**
 * Zod codec from codex basename to CoreNameChainFromRoot.
 * Decodes codex basename (e.g., "__-Library" or "__-Child-Parent") to section chain.
 * Uses sectionBasenameToChainCodec internally.
 * Reads settings internally.
 *
 */
export const suffixedBasenameForСodexToParentSectionChainCodec = z.codec(
	SuffixedBasenameForСodexSchema,
	CoreNameChainFromRootSchema,
	{
		decode: (SuffixedBasenameForСodex) => {
			return suffixedBasenameToChainCodec
				.decode(SuffixedBasenameForСodex)
				.slice(0, -1);
		},
		encode: (chain) => {
			// Codex is just a regular file with coreName "__"
			return suffixedBasenameToChainCodec.encode([
				...chain,
				CODEX_CORE_NAME,
			]);
		},
	},
);
