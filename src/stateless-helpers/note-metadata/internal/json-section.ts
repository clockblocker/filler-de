/**
 * Internal JSON section format for metadata.
 * Not exported from the module - use public API instead.
 */

import type { z } from "zod";
import type { Transform } from "../../../managers/obsidian/vault-action-manager/types/vault-action";

// ─── Constants ───

const META_SECTION_ID = "textfresser_meta_keep_me_invisible";
const SECTION = "section";

// Escape special regex chars
const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Pattern to match metadata section (captures JSON content)
// Matches both id={...} (legacy) and id="..." (new) formats
const PATTERN = new RegExp(
	`\\n*<${SECTION}\\s+id=[\\{"]${reEscape(META_SECTION_ID)}[\\}"]>([\\s\\S]*?)<\\/${SECTION}>\\n*`,
);

/** Find the start index of the metadata section (excluding preceding whitespace), or null if none. */
export function findMetaSectionStart(content: string): number | null {
	const match = content.match(PATTERN);
	if (match?.index == null) return null;

	// Skip preceding whitespace
	let pos = match.index;
	while (pos > 0 && /\s/.test(content[pos - 1] ?? "")) {
		pos--;
	}
	return pos;
}

// ─── Extract ───

/**
 * Extract JSON section as raw string.
 * Returns the body without JSON section and the JSON section itself.
 */
export function extractJsonSection(content: string): {
	body: string;
	jsonSection: string;
} {
	const match = content.match(PATTERN);
	if (!match || match.index === undefined)
		return { body: content, jsonSection: "" };
	return {
		body: content.slice(0, match.index),
		jsonSection: match[0],
	};
}

// ─── Types ───

export type Metadata = Record<string, unknown>;

// ─── Read ───

/**
 * Read JSON metadata from note content.
 * Returns null if no metadata or parse fails.
 */
export function readJsonSection<T extends Metadata>(
	contentOfNote: string,
	schema: z.ZodSchema<T>,
): T | null {
	const match = contentOfNote.match(PATTERN);
	if (!match?.[1]) return null;

	try {
		const parsed = schema.safeParse(JSON.parse(match[1].trim()));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

// ─── Write ───

/**
 * Format metadata as section string.
 */
function formatMetadata(metadata: Metadata): string {
	return `<${SECTION} id="${META_SECTION_ID}">\n${JSON.stringify(metadata)}\n</${SECTION}>`;
}

/**
 * Upsert JSON metadata in note content.
 * Returns Transform function for use with ProcessMdFile.
 */
export function writeJsonSection(metadata: Metadata): Transform {
	return (content: string) => {
		// Remove existing metadata section
		const contentWithoutMeta = content.replace(PATTERN, "").trimEnd();

		// Add metadata at end with padding to push it below visible area
		const metaSection = formatMetadata(metadata);
		const PADDING = "\n".repeat(20);
		return `${contentWithoutMeta}${PADDING}${metaSection}\n`;
	};
}

// ─── Strip ───

/**
 * Strip internal metadata section from content.
 */
export function stripJsonSection(content: string): string {
	return content.replace(PATTERN, "").trimEnd();
}
