/**
 * Pure wikilink alias resolution.
 * No framework dependencies - behaviors add library-specific logic.
 */

import type { AliasResult, SuffixParser } from "./types";

/**
 * Resolve alias from link content using a suffix parser.
 * Returns the core name if the link has suffix parts, null otherwise.
 *
 * @param linkContent - The raw wikilink content (basename)
 * @param suffixParser - Parser for extracting suffix parts
 * @param isCodexName - Optional predicate to skip codex files (default: starts with __)
 */
export function resolveAliasFromSuffix(
	linkContent: string,
	suffixParser: SuffixParser,
	isCodexName: (name: string) => boolean = (name) => name.startsWith("__"),
): AliasResult {
	// Parse basename to extract suffix parts
	const parseResult = suffixParser.parseSeparatedSuffix(linkContent);
	if (parseResult.isErr()) return null;

	const { coreName, suffixParts } = parseResult.value;

	// Skip codex files
	if (isCodexName(coreName)) return null;

	// No suffix = not a library file (or root-level file without hierarchy)
	if (suffixParts.length === 0) return null;

	// Has suffix parts = library file, add alias
	return { alias: coreName };
}
