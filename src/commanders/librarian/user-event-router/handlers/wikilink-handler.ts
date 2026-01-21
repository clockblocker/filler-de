import type { WikilinkCompletedEvent } from "../../../../managers/obsidian/user-event-interceptor";
import { logger } from "../../../../utils/logger";
import type { Codecs } from "../../codecs";

/**
 * Handle wikilink completion: add alias for library files.
 * If basename has suffix parts (delimiter-separated), it's a library file.
 */
export function handleWikilinkCompleted(
	event: WikilinkCompletedEvent,
	codecs: Codecs,
): void {
	const { linkContent, closePos, insertAlias } = event;

	logger.info(
		"[Librarian] handleWikilinkCompleted received:",
		JSON.stringify({ closePos, linkContent }),
	);

	// Parse basename to extract suffix parts
	const parseResult = codecs.suffix.parseSeparatedSuffix(linkContent);
	if (parseResult.isErr()) {
		logger.info(
			"[Librarian] parseSeparatedSuffix failed:",
			JSON.stringify({ error: parseResult.error, linkContent }),
		);
		return;
	}

	const { coreName, suffixParts } = parseResult.value;
	logger.info(
		"[Librarian] parsed suffix:",
		JSON.stringify({ coreName, suffixParts }),
	);

	// Skip codex files (start with __)
	if (coreName.startsWith("__")) {
		logger.info("[Librarian] skipping codex file (__ prefix)");
		return;
	}

	// No suffix = not a library file (or root-level file without hierarchy)
	if (suffixParts.length === 0) {
		logger.info("[Librarian] no suffix parts, skipping");
		return;
	}

	// Has suffix parts = library file, add alias
	logger.info(
		"[Librarian] inserting alias:",
		JSON.stringify({ alias: coreName, closePos }),
	);

	insertAlias(coreName);

	logger.info(
		"[Librarian] Inserted wikilink alias:",
		JSON.stringify({ coreName, linkContent }),
	);
}
