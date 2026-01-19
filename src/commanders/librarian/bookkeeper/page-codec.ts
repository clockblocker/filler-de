import { serializeSeparatedSuffix } from "../codecs/internal/suffix/serialize";
import type { CodecRules } from "../codecs/rules";
import type { NodeName } from "../types/schemas/node-name";
import { PAGE_INDEX_DIGITS, PAGE_PREFIX } from "./types";

/**
 * Builds page basename from page index and source file info.
 *
 * @example
 * buildPageBasename(1, "Aschenputtel", ["Märchen"], rules)
 * // → "Aschenputtel_Page_001-Aschenputtel-Märchen"
 */
export function buildPageBasename(
	pageIndex: number,
	coreName: NodeName,
	suffixParts: NodeName[],
	rules: CodecRules,
): string {
	const paddedIndex = String(pageIndex).padStart(PAGE_INDEX_DIGITS, "0");
	const pagePrefix = `${coreName}_${PAGE_PREFIX}_${paddedIndex}`;
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
 * Matches: "Aschenputtel_Page_001" (coreName_Page_NNN)
 */
export const PAGE_PREFIX_PATTERN = new RegExp(
	`^(.+)_${PAGE_PREFIX}_(\\d{${PAGE_INDEX_DIGITS}})$`,
);

/**
 * Parses page index from a node name if it matches page prefix pattern.
 */
export function parsePageIndex(
	nodeName: string,
): { isPage: true; pageIndex: number; coreName: string } | { isPage: false } {
	const match = nodeName.match(PAGE_PREFIX_PATTERN);
	if (match?.[1] && match?.[2]) {
		return {
			coreName: match[1],
			isPage: true,
			pageIndex: Number.parseInt(match[2], 10),
		};
	}
	return { isPage: false };
}
