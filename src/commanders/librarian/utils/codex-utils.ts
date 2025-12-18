import { CODEX_PREFIX } from "../types/literals";

/**
 * Check if a basename represents a codex file.
 * Codex files start with "__" prefix.
 *
 * @example
 * isCodexBasename("__Library") // true
 * isCodexBasename("__A") // true
 * isCodexBasename("Note") // false
 * isCodexBasename("_Note") // false (single underscore)
 */
export function isCodexBasename(basename: string): boolean {
	return basename.startsWith(CODEX_PREFIX);
}

/**
 * Get the section name from a codex basename.
 * Strips the "__" prefix.
 *
 * @example
 * getCodexSectionName("__Library") // "Library"
 * getCodexSectionName("__A") // "A"
 */
export function getCodexSectionName(codexBasename: string): string {
	if (!isCodexBasename(codexBasename)) {
		return codexBasename;
	}
	return codexBasename.slice(CODEX_PREFIX.length);
}

/**
 * Build codex basename from section name.
 *
 * @example
 * buildCodexBasename("Library") // "__Library"
 * buildCodexBasename("A") // "__A"
 */
export function buildCodexBasename(sectionName: string): string {
	return `${CODEX_PREFIX}${sectionName}`;
}
