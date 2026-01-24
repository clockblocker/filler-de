import type { WikilinkPayload } from "../../../../managers/obsidian/user-event-interceptor";
import type { Codecs } from "../../codecs";
import { CODEX_CORE_NAME } from "../../types/consts/literals";

/**
 * Handle wikilink completion: add alias for library files.
 * If basename has suffix parts (delimiter-separated), it's a library file.
 * Returns modified payload with aliasToInsert, or null if no alias needed.
 */
export function handleWikilinkCompleted(
	payload: WikilinkPayload,
	codecs: Codecs,
): WikilinkPayload | null {
	const { linkContent } = payload;

	// Parse basename to extract suffix parts
	const parseResult = codecs.suffix.parseSeparatedSuffix(linkContent);
	if (parseResult.isErr()) return null;

	const { coreName, suffixParts } = parseResult.value;

	// Skip codex files (start with __)
	if (coreName.startsWith(CODEX_CORE_NAME)) return null;

	// No suffix = not a library file (or root-level file without hierarchy)
	if (suffixParts.length === 0) return null;

	// Has suffix parts = library file, add alias
	return {
		...payload,
		aliasToInsert: coreName,
	};
}
