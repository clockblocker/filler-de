import type { WikilinkCompletedEvent } from "../../../../managers/obsidian/user-event-interceptor";
import type { Codecs } from "../../codecs";

/**
 * Handle wikilink completion: add alias for library files.
 * If basename has suffix parts (delimiter-separated), it's a library file.
 */
export function handleWikilinkCompleted(
	event: WikilinkCompletedEvent,
	codecs: Codecs,
): void {
	const { linkContent, insertAlias } = event;

	// Parse basename to extract suffix parts
	const parseResult = codecs.suffix.parseSeparatedSuffix(linkContent);
	if (parseResult.isErr()) return;

	const { coreName, suffixParts } = parseResult.value;

	// Skip codex files (start with __)
	if (coreName.startsWith("__")) return;

	// No suffix = not a library file (or root-level file without hierarchy)
	if (suffixParts.length === 0) return;

	// Has suffix parts = library file, add alias
	insertAlias(coreName);
}
