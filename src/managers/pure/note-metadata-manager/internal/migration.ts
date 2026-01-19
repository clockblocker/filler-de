/**
 * Migration transforms for converting between metadata formats.
 * Only imported by build-initial-actions.ts for initialization.
 */

import type { Transform } from "../../../obsidian/vault-action-manager/types/vault-action";
import {
	frontmatterToInternal,
	internalToFrontmatter,
	parseFrontmatter,
	type ScrollMetadataWithImport,
	stripFrontmatter,
} from "./frontmatter";
import { stripJsonSection, writeJsonSection } from "./json-section";

// ─── Types ───

export type MigrateFrontmatterOptions = {
	/** Whether to strip YAML frontmatter after conversion. Default: true */
	stripYaml?: boolean;
};

// ─── Migrations ───

/**
 * Create transform that migrates YAML frontmatter to internal JSON format.
 * @param options.stripYaml - If true (default), removes YAML frontmatter. If false, keeps it.
 */
export function migrateFrontmatter(
	options?: MigrateFrontmatterOptions,
): Transform {
	const stripYaml = options?.stripYaml ?? true;

	return (content: string) => {
		const fm = parseFrontmatter(content);
		if (!fm) return content;

		const baseContent = stripYaml ? stripFrontmatter(content) : content;
		const meta = frontmatterToInternal(fm);
		return writeJsonSection(meta)(baseContent);
	};
}

/**
 * Create transform that converts internal JSON metadata to YAML frontmatter.
 * Strips internal section and prepends YAML frontmatter.
 */
export function migrateToFrontmatter(
	meta: ScrollMetadataWithImport,
): Transform {
	return (content: string) => {
		const stripped = stripJsonSection(content);
		const withoutFm = stripFrontmatter(stripped);
		const yaml = internalToFrontmatter(meta);
		return `${yaml}\n${withoutFm}`;
	};
}

/**
 * Create transform that adds YAML frontmatter with given status.
 * Used when file has no metadata at all.
 */
export function addFrontmatter(meta: ScrollMetadataWithImport): Transform {
	return (content: string) => {
		const withoutFm = stripFrontmatter(content);
		const yaml = internalToFrontmatter(meta);
		return `${yaml}\n${withoutFm}`;
	};
}

// Re-export types needed by consumers
export type { ScrollMetadataWithImport };
