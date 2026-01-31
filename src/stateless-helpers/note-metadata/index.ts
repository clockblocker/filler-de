/**
 * Note Metadata Manager - Public API
 *
 * Format-agnostic API for reading and writing note metadata.
 * Consumers don't know if metadata is stored as YAML frontmatter or internal JSON.
 */

import type { z } from "zod";
import { getParsedUserSettings } from "../../global-state/global-state";
import type { Transform } from "../../managers/obsidian/vault-action-manager/types/vault-action";
import {
	frontmatterToInternal,
	parseFrontmatter,
	stripFrontmatter as stripFm,
	upsertFrontmatterStatus,
	writeFrontmatter,
} from "./internal/frontmatter";
import {
	findMetaSectionStart,
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
function read<T extends Metadata>(
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
function upsert(metadata: Metadata): Transform {
	const { hideMetadata } = getParsedUserSettings();
	return hideMetadata
		? writeJsonSection(metadata)
		: writeFrontmatter(metadata);
}

/**
 * Strip all metadata from content (both JSON section and YAML frontmatter).
 * Returns clean body text with leading whitespace trimmed.
 */
function strip(content: string): string {
	const withoutJson = stripJsonSection(content);
	const withoutFm = stripFm(withoutJson);
	return withoutFm.trimStart();
}

/**
 * Strip only YAML frontmatter from content (for position calculation).
 * Does NOT strip JSON section. Use strip() to remove all metadata.
 */
function stripFrontmatter(content: string): string {
	return stripFm(content).trimStart();
}

// ─── Status Toggle ───

/**
 * Status type for tree nodes.
 */
export type StatusValue = "Done" | "NotStarted";

/**
 * Toggle status property in note metadata.
 * Works with both YAML frontmatter and internal JSON formats.
 * Returns Transform function for use with ProcessMdFile.
 *
 * @param checked - The new checkbox state (true = Done, false = NotStarted)
 */
function toggleStatus(checked: boolean): Transform {
	const status: StatusValue = checked ? "Done" : "NotStarted";
	const { hideMetadata } = getParsedUserSettings();

	if (hideMetadata) {
		// Internal JSON format
		return writeJsonSection({ status });
	}
	// YAML frontmatter format
	return upsertFrontmatterStatus(status);
}

/**
 * Note metadata helper object with grouped functions.
 */
export const noteMetadataHelper = {
	findSectionStart: findMetaSectionStart,
	read,
	strip,
	stripFrontmatter,
	toggleStatus,
	upsert,
};
