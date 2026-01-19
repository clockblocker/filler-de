/**
 * Note Metadata Manager - Public API
 *
 * Format-agnostic API for reading and writing note metadata.
 * Consumers don't know if metadata is stored as YAML frontmatter or internal JSON.
 */

import type { z } from "zod";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { Transform } from "../../obsidian/vault-action-manager/types/vault-action";
import {
	frontmatterToInternal,
	parseFrontmatter,
	stripFrontmatter,
	writeFrontmatter,
} from "./internal/frontmatter";
import {
	META_SECTION_PATTERN,
	type Metadata,
	readJsonSection,
	stripJsonSection,
	writeJsonSection,
} from "./internal/json-section";

// ─── Public API ───

/**
 * Read metadata from note content.
 * Tries internal JSON format first (authoritative), falls back to YAML frontmatter.
 * Returns null if no metadata or parse fails.
 */
export function readMetadata<T extends Metadata>(
	content: string,
	schema: z.ZodSchema<T>,
): T | null {
	// Try internal JSON first (authoritative)
	const internal = readJsonSection(content, schema);
	if (internal) return internal;

	// Fallback to frontmatter
	const fm = parseFrontmatter(content);
	if (!fm) return null;

	const converted = frontmatterToInternal(fm);
	const parsed = schema.safeParse(converted);
	return parsed.success ? parsed.data : null;
}

/**
 * Upsert metadata in note content.
 * Writes to appropriate format based on hideMetadata setting.
 * Returns Transform function for use with ProcessMdFile.
 */
export function upsertMetadata(metadata: Metadata): Transform {
	const { hideMetadata } = getParsedUserSettings();
	return hideMetadata
		? writeJsonSection(metadata)
		: writeFrontmatter(metadata);
}

/**
 * Get clean content body without any metadata.
 * Strips both internal JSON section and YAML frontmatter.
 * Returns Transform function for use with ProcessMdFile.
 */
export function getContentBody(): Transform {
	return (content: string) => {
		const withoutJson = stripJsonSection(content);
		const withoutFm = stripFrontmatter(withoutJson);
		return withoutFm.trim();
	};
}

// ─── Clipboard Support ───

/** Pattern for stripping metadata from copied text */
export { META_SECTION_PATTERN };
