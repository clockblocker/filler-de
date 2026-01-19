import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { serializeSeparatedSuffix } from "../codecs/internal/suffix/serialize";
import type { CodecRules } from "../codecs/rules";
import type { NodeName } from "../types/schemas/node-name";
import { PAGE_INDEX_DIGITS, PAGE_PREFIX } from "./types";

const MAX_PAGE_INDEX = 10 ** PAGE_INDEX_DIGITS - 1; // 999 for 3 digits

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

/**
 * Pattern to find page index in full basename.
 * Matches: "_Page_001" anywhere in string.
 */
const PAGE_INDEX_IN_BASENAME_PATTERN = new RegExp(
	`_${PAGE_PREFIX}_(\\d{${PAGE_INDEX_DIGITS}})`,
);

/**
 * Returns split path to next page, or null if current is last page (999).
 */
export function getNextPageSplitPath(
	currentPage: SplitPathToMdFile,
): SplitPathToMdFile | null {
	const match = currentPage.basename.match(PAGE_INDEX_IN_BASENAME_PATTERN);
	if (!match?.[1]) return null;

	const currentIndex = Number.parseInt(match[1], 10);
	if (currentIndex >= MAX_PAGE_INDEX) return null;

	const nextIndex = currentIndex + 1;
	const paddedNext = String(nextIndex).padStart(PAGE_INDEX_DIGITS, "0");
	const newBasename = currentPage.basename.replace(
		PAGE_INDEX_IN_BASENAME_PATTERN,
		`_${PAGE_PREFIX}_${paddedNext}`,
	);

	return { ...currentPage, basename: newBasename };
}

/**
 * Returns split path to previous page, or null if current is first page (000).
 */
export function getPrevPageSplitPath(
	currentPage: SplitPathToMdFile,
): SplitPathToMdFile | null {
	const match = currentPage.basename.match(PAGE_INDEX_IN_BASENAME_PATTERN);
	if (!match?.[1]) return null;

	const currentIndex = Number.parseInt(match[1], 10);
	if (currentIndex <= 0) return null;

	const prevIndex = currentIndex - 1;
	const paddedPrev = String(prevIndex).padStart(PAGE_INDEX_DIGITS, "0");
	const newBasename = currentPage.basename.replace(
		PAGE_INDEX_IN_BASENAME_PATTERN,
		`_${PAGE_PREFIX}_${paddedPrev}`,
	);

	return { ...currentPage, basename: newBasename };
}
