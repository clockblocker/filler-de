import { serializeSeparatedSuffix } from "../codecs/internal/suffix/serialize";
import type { CodecRules } from "../codecs/rules";
import type { NodeName } from "../types/schemas/node-name";
import { PAGE_INDEX_DIGITS, PAGE_PREFIX } from "./types";

/**
 * Builds page basename from page index and source file info.
 *
 * @example
 * buildPageBasename(1, "Aschenputtel", ["Märchen"], rules)
 * // → "Page001-Aschenputtel-Märchen"
 */
export function buildPageBasename(
	pageIndex: number,
	coreName: NodeName,
	suffixParts: NodeName[],
	rules: CodecRules,
): string {
	const pagePrefix = `${PAGE_PREFIX}${String(pageIndex).padStart(PAGE_INDEX_DIGITS, "0")}`;
	return serializeSeparatedSuffix(rules, {
		coreName: pagePrefix,
		suffixParts: [coreName, ...suffixParts],
	});
}

/**
 * Builds folder basename for pages (same as source coreName).
 *
 * @example
 * buildPageFolderBasename("Aschenputtel")
 * // → "Aschenputtel"
 */
export function buildPageFolderBasename(coreName: NodeName): string {
	return coreName;
}

/**
 * Pattern to detect page prefix in basename.
 */
export const PAGE_PREFIX_PATTERN = new RegExp(
	`^${PAGE_PREFIX}(\\d{${PAGE_INDEX_DIGITS}})$`,
);

/**
 * Parses page index from a node name if it matches page prefix pattern.
 */
export function parsePageIndex(
	nodeName: string,
): { isPage: true; pageIndex: number } | { isPage: false } {
	const match = nodeName.match(PAGE_PREFIX_PATTERN);
	if (match?.[1]) {
		return { isPage: true, pageIndex: Number.parseInt(match[1], 10) };
	}
	return { isPage: false };
}
